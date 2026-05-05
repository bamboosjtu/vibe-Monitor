from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = PROJECT_DIR / "frontend"
BUILD_DIR = PROJECT_DIR / "build_offline"
PACKAGE_DIR = BUILD_DIR / "vibe-Monitor"
ZIP_FILE = PROJECT_DIR / "offline_package.zip"

EXCLUDE_DIR_NAMES = {
    "__pycache__",
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "build_offline",
    "coverage",
    "data",
    "dist",
    "dist-ssr",
    "node_modules",
    "venv",
}
EXCLUDE_FILE_NAMES = {
    ".env",
    ".env.development.local",
    ".env.local",
    ".env.production.local",
    ".env.test.local",
    "offline_package.zip",
}
EXCLUDE_SUFFIXES = {
    ".db",
    ".lcov",
    ".local",
    ".log",
    ".pyc",
    ".pyo",
    ".sqlite",
    ".sqlite3",
    ".tmp",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="打包 vibe-Monitor 源码，不构建、不包含依赖、构建产物或数据。"
    )
    return parser.parse_args()


def should_exclude(path: Path) -> bool:
    if path == BUILD_DIR or BUILD_DIR in path.parents:
        return True
    if path == ZIP_FILE:
        return True
    if any(part in EXCLUDE_DIR_NAMES for part in path.parts):
        return True
    if path.name in EXCLUDE_FILE_NAMES:
        return True
    if path.suffix in EXCLUDE_SUFFIXES:
        return True
    return False


def clean_build_dir() -> None:
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    PACKAGE_DIR.mkdir(parents=True)


def assert_project_shape() -> None:
    if not FRONTEND_DIR.exists():
        raise FileNotFoundError(f"未找到 frontend 目录：{FRONTEND_DIR}")


def copy_project_files() -> None:
    for path in PROJECT_DIR.rglob("*"):
        if should_exclude(path):
            continue

        relative_path = path.relative_to(PROJECT_DIR)
        target_path = PACKAGE_DIR / relative_path
        if path.is_dir():
            target_path.mkdir(parents=True, exist_ok=True)
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target_path)


def write_package_notes() -> None:
    notes = """# vibe-Monitor source package

## Contents

- repository source files
- frontend Node.js source and package lock files
- backend Python source and lock/config files
- documentation and project config files

## Excluded by default

- node_modules
- Python virtual environments
- frontend/dist and other build outputs
- cache/test temp directories
- .env files
- runtime data and databases

## Frontend install and build

```powershell
cd frontend
npm ci
npm run build
```
"""
    (PACKAGE_DIR / "OFFLINE_PACKAGE.md").write_text(notes, encoding="utf-8")


def make_zip() -> None:
    if ZIP_FILE.exists():
        ZIP_FILE.unlink()

    with zipfile.ZipFile(ZIP_FILE, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in BUILD_DIR.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(BUILD_DIR))


def main() -> int:
    parse_args()
    try:
        clean_build_dir()
        assert_project_shape()
        copy_project_files()
        write_package_notes()
        make_zip()
        print(f"打包完成：{ZIP_FILE}")
        return 0
    finally:
        shutil.rmtree(BUILD_DIR, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
