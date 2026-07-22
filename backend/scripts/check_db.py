"""Verify live DB connectivity via app settings."""

import sys

from app.core.database import check_db, close_pool
from app.core.config import settings

def main() -> None:
    host = settings.database_url.split("@")[-1].split("/")[0]
    print(f"Checking DB at {host} ...")
    try:
        if check_db():
            print("DB health: ok")
        else:
            print("DB health: error", file=sys.stderr)
            sys.exit(1)
    finally:
        close_pool()


if __name__ == "__main__":
    main()
