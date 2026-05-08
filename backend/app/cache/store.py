from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


def _utcnow() -> datetime:
    return datetime.utcnow()


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class MonitorCacheStore:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self) -> None:
        with closing(self._connect()) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS monitor_cache_entries (
                    cache_key TEXT PRIMARY KEY,
                    cache_type TEXT NOT NULL,
                    filters_hash TEXT,
                    payload TEXT NOT NULL,
                    source_watermark TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_monitor_cache_entries_cache_type
                    ON monitor_cache_entries(cache_type);

                CREATE TABLE IF NOT EXISTS monitor_cache_state (
                    state_key TEXT PRIMARY KEY,
                    state_value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS project_read_models (
                    project_code TEXT PRIMARY KEY,
                    project_name TEXT,
                    status TEXT,
                    payload TEXT NOT NULL,
                    source_watermark TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            conn.commit()

    def upsert_cache_entry(
        self,
        *,
        cache_key: str,
        cache_type: str,
        payload: Any,
        filters_hash: str | None = None,
        source_watermark: str | None = None,
        ttl_seconds: int | None = None,
    ) -> dict[str, Any]:
        now = _utcnow()
        expires_at = now + timedelta(seconds=ttl_seconds) if ttl_seconds else None
        with closing(self._connect()) as conn:
            conn.execute(
                """
                INSERT INTO monitor_cache_entries (
                    cache_key, cache_type, filters_hash, payload, source_watermark, created_at, updated_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    cache_type = excluded.cache_type,
                    filters_hash = excluded.filters_hash,
                    payload = excluded.payload,
                    source_watermark = excluded.source_watermark,
                    updated_at = excluded.updated_at,
                    expires_at = excluded.expires_at
                """,
                (
                    cache_key,
                    cache_type,
                    filters_hash,
                    json.dumps(payload, ensure_ascii=False),
                    source_watermark,
                    now.isoformat(),
                    now.isoformat(),
                    expires_at.isoformat() if expires_at else None,
                ),
            )
            conn.commit()
        return self.get_cache_entry(cache_key) or {}

    def get_cache_entry(self, cache_key: str) -> dict[str, Any] | None:
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT * FROM monitor_cache_entries WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
        if row is None:
            return None
        entry = dict(row)
        entry["payload"] = json.loads(entry["payload"])
        entry["is_expired"] = self.is_cache_entry_expired(entry)
        return entry

    def list_cache_entries(self, cache_type: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM monitor_cache_entries"
        params: tuple[Any, ...] = ()
        if cache_type:
            query += " WHERE cache_type = ?"
            params = (cache_type,)
        query += " ORDER BY updated_at DESC"
        with closing(self._connect()) as conn:
            rows = conn.execute(query, params).fetchall()
        entries = []
        for row in rows:
            entry = dict(row)
            entry["payload"] = json.loads(entry["payload"])
            entry["is_expired"] = self.is_cache_entry_expired(entry)
            entries.append(entry)
        return entries

    def clear_cache(self, cache_type: str | None = None) -> int:
        with closing(self._connect()) as conn:
            if cache_type:
                cursor = conn.execute(
                    "DELETE FROM monitor_cache_entries WHERE cache_type = ?",
                    (cache_type,),
                )
            else:
                cursor = conn.execute("DELETE FROM monitor_cache_entries")
            conn.commit()
            return cursor.rowcount

    def count_cache_entries(self) -> int:
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT COUNT(*) AS count FROM monitor_cache_entries").fetchone()
        return int(row["count"]) if row else 0

    def set_state(self, state_key: str, state_value: Any) -> None:
        serialized = (
            state_value if isinstance(state_value, str) else json.dumps(state_value, ensure_ascii=False)
        )
        with closing(self._connect()) as conn:
            conn.execute(
                """
                INSERT INTO monitor_cache_state (state_key, state_value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(state_key) DO UPDATE SET
                    state_value = excluded.state_value,
                    updated_at = excluded.updated_at
                """,
                (state_key, serialized, _utcnow().isoformat()),
            )
            conn.commit()

    def get_state(self, state_key: str) -> dict[str, Any] | None:
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT * FROM monitor_cache_state WHERE state_key = ?",
                (state_key,),
            ).fetchone()
        if row is None:
            return None
        value = row["state_value"]
        try:
            parsed = json.loads(value)
        except (TypeError, json.JSONDecodeError):
            parsed = value
        return {
            "state_key": row["state_key"],
            "state_value": parsed,
            "updated_at": row["updated_at"],
        }

    def upsert_project_read_model(
        self,
        *,
        project_code: str,
        project_name: str | None,
        status: str | None,
        payload: Any,
        source_watermark: str | None,
    ) -> None:
        with closing(self._connect()) as conn:
            conn.execute(
                """
                INSERT INTO project_read_models (
                    project_code, project_name, status, payload, source_watermark, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_code) DO UPDATE SET
                    project_name = excluded.project_name,
                    status = excluded.status,
                    payload = excluded.payload,
                    source_watermark = excluded.source_watermark,
                    updated_at = excluded.updated_at
                """,
                (
                    project_code,
                    project_name,
                    status,
                    json.dumps(payload, ensure_ascii=False),
                    source_watermark,
                    _utcnow().isoformat(),
                ),
            )
            conn.commit()

    def list_project_read_models(self) -> list[dict[str, Any]]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT * FROM project_read_models ORDER BY project_code"
            ).fetchall()
        items = []
        for row in rows:
            item = dict(row)
            item["payload"] = json.loads(item["payload"])
            items.append(item)
        return items

    def clear_project_read_models(self) -> int:
        with closing(self._connect()) as conn:
            cursor = conn.execute("DELETE FROM project_read_models")
            conn.commit()
            return cursor.rowcount

    def cache_types(self) -> list[str]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT DISTINCT cache_type FROM monitor_cache_entries ORDER BY cache_type"
            ).fetchall()
        return [str(row["cache_type"]) for row in rows]

    @staticmethod
    def is_cache_entry_expired(entry: dict[str, Any]) -> bool:
        expires_at = _parse_timestamp(entry.get("expires_at"))
        return expires_at is not None and expires_at <= _utcnow()
