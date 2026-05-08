from __future__ import annotations

import json
from urllib import error, parse, request


class DataHubClientError(RuntimeError):
    pass


class DataHubClient:
    def __init__(self, *, base_url: str, timeout_seconds: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def _get_json(self, path: str, query: dict[str, str | int | None] | None = None) -> dict:
        url = f"{self.base_url}{path}"
        if query:
            filtered = {key: value for key, value in query.items() if value is not None}
            if filtered:
                url = f"{url}?{parse.urlencode(filtered)}"
        req = request.Request(url, headers={"Content-Type": "application/json"})
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as resp:
                if resp.status != 200:
                    raise DataHubClientError(f"DataHub request failed: {resp.status}")
                return json.loads(resp.read().decode("utf-8"))
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise DataHubClientError(str(exc)) from exc

    def get_health_summary(self) -> dict:
        return self._get_json("/health/v1/summary")

    def get_datasets_health(self) -> dict:
        return self._get_json("/health/v1/datasets")

    def get_domain_health(self) -> dict:
        return self._get_json("/health/v1/domain")

    def get_sandbox_skeleton(self) -> dict:
        return self._get_json("/api/v1/sandbox/map/skeleton")

    def get_sandbox_dates(self) -> dict:
        return self._get_json("/api/v1/sandbox/dates")

    def get_sandbox_summary(self, date: str | None = None) -> dict:
        return self._get_json("/api/v1/sandbox/map/summary", {"date": date})
