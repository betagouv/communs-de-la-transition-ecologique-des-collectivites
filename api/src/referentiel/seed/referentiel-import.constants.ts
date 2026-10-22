export const REFERENTIEL_IMPORT_MONITOR_SLUG = "referentiel-import";
// Schedule of the Sentry cron monitor: must match the command in cron.json at the repository root.
// Sunday 04:00 UTC, an hour after the TC opendata import (Sunday 03:00 UTC).
export const REFERENTIEL_IMPORT_CRON = "0 4 * * 0";
