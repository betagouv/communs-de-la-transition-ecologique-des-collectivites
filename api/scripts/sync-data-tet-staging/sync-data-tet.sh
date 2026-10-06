#!/bin/bash
# Replaces the data_tet schema of a non-production database with the content of production.
#
# Why: TeT restores its staging database from production every night, so its staging fiche
# ids are production ids. Without the matching fiches (and their labels) on our staging,
# GET /tet/v1/actions/:id/secteurs answers 404 for the whole stock.
#
# Why a full replace and not a merge: TeT's restore also resets its sequences to the
# production maximum, so an id handed out on staging today is reused by a different
# production fiche tomorrow. Keeping yesterday's staging rows would leave that external id
# pointing at a stale fiche whose classification is never recomputed.
#
# The copy is plain SQL (no API call): it triggers no classification job.
#
# Usage:
#   FROM_DB_URL=postgres://... TO_DB_URL=postgres://... EXPECTED_TO_DB_NAME=<target db name> \
#     bash sync-data-tet.sh
#
#   DRY_RUN=true            export and run every check, write nothing
#   MIN_SOURCE_FICHES=1000  refuse a source holding fewer fiches (guards against an empty source)
set -euo pipefail

SCHEMA="data_tet"
# Parents before the junction table that references them.
TABLES=(plans_transition fiches_action fiches_action_to_plans external_ids)
DRY_RUN="${DRY_RUN:-false}"
MIN_SOURCE_FICHES="${MIN_SOURCE_FICHES:-1000}"

missing_vars=()
[ -z "${FROM_DB_URL:-}" ] && missing_vars+=("FROM_DB_URL")
[ -z "${TO_DB_URL:-}" ] && missing_vars+=("TO_DB_URL")
[ -z "${EXPECTED_TO_DB_NAME:-}" ] && missing_vars+=("EXPECTED_TO_DB_NAME")
if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "Missing environment variables: ${missing_vars[*]}" >&2
    exit 1
fi

# Ignore local psql customizations, never prompt for a password, and propagate SQL errors.
PSQL=(psql -X --no-password -v ON_ERROR_STOP=1)
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"

# --- Target guard: fail-closed on the database name --------------------------------------
# Both databases are usually reached through local tunnels, so the URL says nothing about
# which database is behind it: ask the server.
from_db_name=$("${PSQL[@]}" -d "$FROM_DB_URL" -Atc "select current_database()")
to_db_name=$("${PSQL[@]}" -d "$TO_DB_URL" -Atc "select current_database()")

if [ "$to_db_name" != "$EXPECTED_TO_DB_NAME" ]; then
    echo "Refusing to sync: target database is '$to_db_name', expected '$EXPECTED_TO_DB_NAME'." >&2
    exit 1
fi
if [ "$to_db_name" = "$from_db_name" ]; then
    echo "Refusing to sync: source and target are the same database ('$to_db_name')." >&2
    exit 1
fi

echo "Syncing $SCHEMA: $from_db_name → $to_db_name"

# --- Schema compatibility: check everything before the first TRUNCATE --------------------
# The target usually runs ahead of the source (staging deploys main, production deploys
# releases). Columns are copied by name, restricted to those present on both sides:
# - a column that only exists on the target takes its default;
# - a column that only exists on the source is skipped with a warning (production carries
#   columns added outside migrations, which the application does not read);
# - a column the target requires and the source cannot fill is an incompatibility.
columns_query() {
    cat <<SQL
select column_name from information_schema.columns
where table_schema = '$SCHEMA' and table_name = '$1'
order by ordinal_position
SQL
}

incompatibilities=""
for table in "${TABLES[@]}"; do
    source_columns=$("${PSQL[@]}" -d "$FROM_DB_URL" -Atc "$(columns_query "$table")")
    target_columns=$("${PSQL[@]}" -d "$TO_DB_URL" -Atc "$(columns_query "$table")")

    # information_schema only lists what the connected user may read: an empty answer
    # means a missing table or a missing privilege.
    if [ -z "$source_columns" ]; then
        incompatibilities+="  $SCHEMA.$table is missing on the source, or the source user cannot read it"$'\n'
        continue
    fi
    if [ -z "$target_columns" ]; then
        incompatibilities+="  $SCHEMA.$table is missing on the target"$'\n'
        continue
    fi

    while IFS= read -r column; do
        if ! grep -Fxq "$column" <<< "$target_columns"; then
            echo "Warning: $SCHEMA.$table.$column exists on the source but not on the target, skipped."
        fi
    done <<< "$source_columns"

    required_target_columns=$("${PSQL[@]}" -d "$TO_DB_URL" -Atc "
        select column_name from information_schema.columns
        where table_schema = '$SCHEMA' and table_name = '$table'
          and is_nullable = 'NO' and column_default is null")
    while IFS= read -r column; do
        [ -z "$column" ] && continue
        if ! grep -Fxq "$column" <<< "$source_columns"; then
            incompatibilities+="  $SCHEMA.$table.$column is required on the target but absent from the source"$'\n'
        fi
    done <<< "$required_target_columns"
done

if [ -n "$incompatibilities" ]; then
    echo "Refusing to sync: incompatible schemas, nothing was changed." >&2
    printf '%s' "$incompatibilities" >&2
    exit 1
fi

# --- Export: one read-only snapshot of the source ----------------------------------------
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

# Columns present on both sides, in target order.
quoted_columns() {
    local source_columns
    source_columns=$("${PSQL[@]}" -d "$FROM_DB_URL" -Atc "
        select string_agg(quote_literal(column_name), ', ')
        from information_schema.columns
        where table_schema = '$SCHEMA' and table_name = '$1'")
    "${PSQL[@]}" -d "$TO_DB_URL" -Atc "
        select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
        from information_schema.columns
        where table_schema = '$SCHEMA' and table_name = '$1'
          and column_name in ($source_columns)"
}

export_sql="$WORK_DIR/export.sql"
load_sql="$WORK_DIR/load.sql"

COLUMN_LISTS=()
for table in "${TABLES[@]}"; do
    COLUMN_LISTS+=("$(quoted_columns "$table")")
done

{
    echo "begin transaction isolation level repeatable read read only;"
    for i in "${!TABLES[@]}"; do
        table="${TABLES[$i]}"
        echo "\\copy $SCHEMA.$table (${COLUMN_LISTS[$i]}) to '$WORK_DIR/$table.copy'"
        echo "select '$table', count(*) from $SCHEMA.$table;"
    done
    echo "commit;"
} > "$export_sql"

echo "Exporting from the source..."
source_counts=$("${PSQL[@]}" -q -At -F ' ' -d "$FROM_DB_URL" -f "$export_sql")
echo "$source_counts" | sed 's/^/  /'

count_of() {
    awk -v table="$1" '$1 == table { print $2 }' <<< "$source_counts"
}

source_fiches=$(count_of fiches_action)
if [ -z "$source_fiches" ] || [ "$source_fiches" -lt "$MIN_SOURCE_FICHES" ]; then
    echo "Refusing to sync: the source holds ${source_fiches:-0} fiches, below the minimum of $MIN_SOURCE_FICHES." >&2
    exit 1
fi

if [ "$DRY_RUN" = "true" ]; then
    echo "Dry run: checks passed, the target was not modified."
    exit 0
fi

# --- Load: truncate and reload in a single transaction -----------------------------------
# Readers never see an empty schema, and any failure leaves the previous content in place.
# No CASCADE on purpose: an unexpected foreign key onto data_tet must fail loudly.
truncate_list=""
for table in "${TABLES[@]}"; do
    truncate_list+="${truncate_list:+, }$SCHEMA.$table"
done

{
    echo "begin;"
    echo "set local lock_timeout = '60s';"
    echo "truncate table $truncate_list;"
    for i in "${!TABLES[@]}"; do
        table="${TABLES[$i]}"
        echo "\\copy $SCHEMA.$table (${COLUMN_LISTS[$i]}) from '$WORK_DIR/$table.copy'"
    done
    # Commit only when every table holds exactly the exported row count.
    checks=""
    for table in "${TABLES[@]}"; do
        checks+="${checks:+ and }(select count(*) from $SCHEMA.$table) = $(count_of "$table")"
    done
    echo "select ($checks) as counts_match \\gset"
    echo "\\if :counts_match"
    echo "  commit;"
    echo "  \\echo SYNC_COMMITTED"
    echo "\\else"
    echo "  rollback;"
    echo "  \\echo SYNC_ROLLED_BACK"
    echo "\\endif"
} > "$load_sql"

echo "Loading into the target..."
load_output=$("${PSQL[@]}" -q -d "$TO_DB_URL" -f "$load_sql")

if ! grep -Fxq "SYNC_COMMITTED" <<< "$load_output"; then
    echo "Sync failed: row counts on the target do not match the export, transaction rolled back." >&2
    exit 1
fi

"${PSQL[@]}" -q -d "$TO_DB_URL" -c "analyze $truncate_list;"

echo "Sync complete: $source_fiches fiches on $to_db_name."
