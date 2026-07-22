from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        conninfo = settings.database_url
        if "connect_timeout" not in conninfo:
            sep = "&" if "?" in conninfo else "?"
            conninfo = f"{conninfo}{sep}connect_timeout=15"
        _pool = ConnectionPool(
            conninfo=conninfo,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
        )
    return _pool


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    pool = get_pool()
    with pool.connection() as conn:
        yield conn


def check_db() -> bool:
    try:
        with get_connection() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
