"""Shared helpers for the classification bench (env loading, DB access)."""

import os
from pathlib import Path

BENCH_DIR = Path(__file__).parent
DATA_DIR = BENCH_DIR / "data"
RESULTS_DIR = BENCH_DIR / "results"

SEED = "jev-bench-2026"


def load_env() -> None:
    """Load bench-local .env into os.environ (no external dependency)."""
    env_file = BENCH_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def get_db_conn():
    import psycopg

    load_env()
    url = os.environ.get("BENCH_DATABASE_URL")
    if not url:
        raise SystemExit("BENCH_DATABASE_URL missing — see bench/classification/.env")
    conn = psycopg.connect(url)
    # Belt and braces: this session must never write.
    conn.execute("SET default_transaction_read_only = on")
    return conn
