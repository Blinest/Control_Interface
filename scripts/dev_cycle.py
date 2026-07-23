from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REMOVE_DIRS = {"build", "dist", "__pycache__", ".pytest_cache", ".mypy_cache", "htmlcov"}


def clean_workspace() -> list[str]:
    removed: list[str] = []
    for path in ROOT.rglob("*"):
        if path.is_dir() and path.name in REMOVE_DIRS:
            shutil.rmtree(path, ignore_errors=True)
            removed.append(str(path))
        elif path.is_file() and path.suffix == ".pyc":
            try:
                path.unlink()
                removed.append(str(path))
            except FileNotFoundError:
                pass
    return removed


def run_app() -> int:
    return subprocess.call([sys.executable, str(ROOT / "main.py")], cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean old build artifacts and launch SoftUI.")
    parser.add_argument("--no-run", action="store_true", help="Only clean; do not launch the app.")
    args = parser.parse_args()

    removed = clean_workspace()
    print(f"cleaned {len(removed)} artifacts")

    if args.no_run:
        return 0

    return run_app()


if __name__ == "__main__":
    raise SystemExit(main())
