from __future__ import annotations

import json
from urllib import error, parse, request


class DataHubClientError(RuntimeError):
    pass


class DataHubClient:
    def __init__(self, *, base_url: str, timeout_seconds: int = 30):
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

    def get_domain_projects(
        self,
        *,
        keyword: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> dict:
        return self._get_json(
            "/api/v1/domain/projects",
            {"keyword": keyword, "limit": limit, "offset": offset},
        )

    def get_domain_project(
        self,
        project_code: str,
        *,
        date: str | None = None,
        include_work_points: bool = True,
        include_towers: bool = True,
        include_stations: bool = True,
        include_line_sections: bool = True,
        limit: int = 10000,
    ) -> dict:
        return self._get_json(
            f"/api/v1/domain/projects/{parse.quote(project_code)}",
            {
                "date": date,
                "include_work_points": str(include_work_points).lower(),
                "include_towers": str(include_towers).lower(),
                "include_stations": str(include_stations).lower(),
                "include_line_sections": str(include_line_sections).lower(),
                "limit": limit,
            },
        )

    def get_domain_line_sections(
        self,
        *,
        project_code: str | None = None,
        single_project_code: str | None = None,
        bidding_section_code: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> dict:
        return self._get_json(
            "/api/v1/domain/line-sections",
            {
                "project_code": project_code,
                "single_project_code": single_project_code,
                "bidding_section_code": bidding_section_code,
                "limit": limit,
                "offset": offset,
            },
        )

    def get_domain_year_progress(
        self,
        *,
        project_code: str | None = None,
        status: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> dict:
        return self._get_json(
            "/api/v1/domain/year-progress",
            {
                "project_code": project_code,
                "status": status,
                "limit": limit,
                "offset": offset,
            },
        )

    def get_domain_project_view(
        self,
        project_code: str,
        *,
        date: str | None = None,
        include_work_points: bool = True,
        limit: int = 10000,
    ) -> dict:
        return self._get_json(
            f"/api/v1/domain/project-view/{parse.quote(project_code)}",
            {
                "date": date,
                "include_work_points": str(include_work_points).lower(),
                "limit": limit,
            },
        )

    def get_domain_relationships(
        self,
        *,
        relationship_type: str | None = None,
        from_entity_type: str | None = None,
        from_entity_key: str | None = None,
        to_entity_type: str | None = None,
        to_entity_key: str | None = None,
        dataset_key: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> dict:
        return self._get_json(
            "/api/v1/domain/relationships",
            {
                "relationship_type": relationship_type,
                "from_entity_type": from_entity_type,
                "from_entity_key": from_entity_key,
                "to_entity_type": to_entity_type,
                "to_entity_key": to_entity_key,
                "dataset_key": dataset_key,
                "limit": limit,
                "offset": offset,
            },
        )
