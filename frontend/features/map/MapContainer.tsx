import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CONFIG, OSM_STYLE } from '@/constants/map';
import {
  POINT_LAYER_CONFIG,
  BOUNDARY_LAYER_CONFIG,
  SELECTED_POINT_LAYER_CONFIG,
} from '@/constants/layers';
import { recordsToGeoJSON } from '@/lib/geojson';
import { useAppStore } from '@/store';
import type { NormalizedStationMeeting } from '@/types';
import { getSkeleton, type SkeletonResponse } from '@/api/mapApi';

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;

function emptyFeatureCollection(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [],
  };
}

function normalizeProjectStatus(status: string | null | undefined): string {
  return status && status.trim() ? status : 'unknown';
}

function getProjectStatusCodeSet(
  selectedProjectStatus: string,
  projectStatusList: Array<{ project_code: string | null; status: string | null }>,
  projectListRaw: Array<{ project_code: string | null; status: string | null }>,
): Set<string> | null {
  if (selectedProjectStatus === 'all') {
    return null;
  }
  const items =
    projectStatusList.length > 0
      ? projectStatusList
      : projectListRaw.map(item => ({
          project_code: item.project_code,
          status: item.status,
        }));
  return new Set(
    items
      .filter(item => normalizeProjectStatus(item.status) === selectedProjectStatus)
      .map(item => item.project_code)
      .filter((value): value is string => Boolean(value)),
  );
}

function getAttributes(entity: unknown): Record<string, unknown> {
  if (typeof entity === 'object' && entity !== null && 'attributes' in entity) {
    const value = (entity as { attributes?: unknown }).attributes;
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

function toTowerFeature(tower: {
  id: string;
  project_code: string | null;
  single_project_code: string;
  tower_no: string;
  longitude: number;
  latitude: number;
  tower_sequence_no: number | null;
}): GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [tower.longitude, tower.latitude],
    },
    properties: {
      id: tower.id,
      project_code: tower.project_code,
      single_project_code: tower.single_project_code,
      tower_no: tower.tower_no,
      tower_sequence_no: tower.tower_sequence_no,
      longitude: tower.longitude,
      latitude: tower.latitude,
    },
  };
}

function toStationFeature(station: {
  id: string;
  project_code: string | null;
  single_project_code: string;
  name: string;
  prj_code: string | null;
  longitude: number;
  latitude: number;
}): GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [station.longitude, station.latitude],
    },
    properties: {
      id: station.id,
      project_code: station.project_code,
      single_project_code: station.single_project_code,
      name: station.name,
      prj_code: station.prj_code,
      longitude: station.longitude,
      latitude: station.latitude,
    },
  };
}

function toProjectMapTowerFeature(entity: Record<string, unknown>) {
  const attrs = getAttributes(entity);
  const longitude = Number(attrs.longitude);
  const latitude = Number(attrs.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [longitude, latitude],
    },
    properties: {
      id: entity.entity_key,
      project_code: attrs.project_code ?? null,
      single_project_code: attrs.single_project_code ?? null,
      bidding_section_code: attrs.bidding_section_code ?? null,
      tower_no: attrs.tower_no ?? null,
      longitude,
      latitude,
    },
  };
}

function toProjectMapStationFeature(entity: Record<string, unknown>) {
  const attrs = getAttributes(entity);
  const longitude = Number(attrs.longitude);
  const latitude = Number(attrs.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [longitude, latitude],
    },
    properties: {
      id: entity.entity_key,
      project_code: attrs.project_code ?? null,
      single_project_code: attrs.single_project_code ?? null,
      name: attrs.single_project_name ?? attrs.station_name ?? entity.entity_key,
      prj_code: attrs.project_code ?? null,
      longitude,
      latitude,
    },
  };
}

function getVisibleTowerData(args: {
  globalSkeleton: SkeletonResponse | null;
  selectedProjectCode: string | null;
  selectedProjectMap: Record<string, unknown> | null;
  selectedProjectStatus: string;
  projectStatusList: Array<{ project_code: string | null; status: string | null }>;
  projectListRaw: Array<{ project_code: string | null; status: string | null }>;
}) {
  const allowedCodes = getProjectStatusCodeSet(
    args.selectedProjectStatus,
    args.projectStatusList,
    args.projectListRaw,
  );

  if (args.selectedProjectCode && args.selectedProjectMap) {
    const towers = Array.isArray(args.selectedProjectMap.towers)
      ? args.selectedProjectMap.towers
      : [];
    return towers
      .map(item => toProjectMapTowerFeature(item as Record<string, unknown>))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter(item => {
        const projectCode = item.properties.project_code;
        if (args.selectedProjectCode && projectCode !== args.selectedProjectCode) {
          return false;
        }
        if (allowedCodes) {
          return typeof projectCode === 'string' && allowedCodes.has(projectCode);
        }
        return true;
      });
  }

  if (!args.globalSkeleton) {
    return [];
  }

  return args.globalSkeleton.towers
    .filter(item => {
      if (args.selectedProjectCode) {
        return Boolean(item.project_code) && item.project_code === args.selectedProjectCode;
      }
      if (allowedCodes) {
        return typeof item.project_code === 'string' && allowedCodes.has(item.project_code);
      }
      return true;
    })
    .map(toTowerFeature);
}

function getVisibleStationData(args: {
  globalSkeleton: SkeletonResponse | null;
  selectedProjectCode: string | null;
  selectedProjectMap: Record<string, unknown> | null;
  selectedProjectStatus: string;
  projectStatusList: Array<{ project_code: string | null; status: string | null }>;
  projectListRaw: Array<{ project_code: string | null; status: string | null }>;
}) {
  const allowedCodes = getProjectStatusCodeSet(
    args.selectedProjectStatus,
    args.projectStatusList,
    args.projectListRaw,
  );

  if (args.selectedProjectCode && args.selectedProjectMap) {
    const stations = Array.isArray(args.selectedProjectMap.stations)
      ? args.selectedProjectMap.stations
      : [];
    return stations
      .map(item => toProjectMapStationFeature(item as Record<string, unknown>))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter(item => {
        const projectCode = item.properties.project_code;
        if (args.selectedProjectCode && projectCode !== args.selectedProjectCode) {
          return false;
        }
        if (allowedCodes) {
          return typeof projectCode === 'string' && allowedCodes.has(projectCode);
        }
        return true;
      });
  }

  if (!args.globalSkeleton) {
    return [];
  }

  return args.globalSkeleton.stations
    .filter(item => {
      if (args.selectedProjectCode) {
        return Boolean(item.project_code) && item.project_code === args.selectedProjectCode;
      }
      if (allowedCodes) {
        return typeof item.project_code === 'string' && allowedCodes.has(item.project_code);
      }
      return true;
    })
    .map(toStationFeature);
}

function getHighlightedTowerFeatures(selectedLineSection: Record<string, unknown> | null) {
  if (!selectedLineSection || !Array.isArray(selectedLineSection.matched_towers)) {
    return [];
  }
  return selectedLineSection.matched_towers
    .map(item => {
      const entity = item as Record<string, unknown>;
      const attrs = getAttributes(entity);
      const longitude = Number(attrs.longitude);
      const latitude = Number(attrs.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null;
      }
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [longitude, latitude],
        },
        properties: {
          id: entity.entity_key,
          tower_no: attrs.tower_no ?? null,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [globalSkeleton, setGlobalSkeleton] = useState<SkeletonResponse | null>(null);
  const {
    dataSource,
    filteredData,
    selectedItem,
    layerVisibility,
    setSelectedObject,
    selectedProjectCode,
    selectedProjectMap,
    selectedProjectStatus,
    projectStatusList,
    projectListRaw,
    selectedLineSection,
  } = useAppStore();

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE as maplibregl.StyleSpecification,
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(
      new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'metric',
      }),
      'bottom-left',
    );

    map.current.on('load', async () => {
      initializeLayers(map.current!);
      setupClickHandler(map.current!, setSelectedObject);
      setMapReady(true);
      await loadBoundaryLayer(map.current!);
    });

    return () => {
      setMapReady(false);
      map.current?.remove();
    };
  }, [setSelectedObject]);

  useEffect(() => {
    let alive = true;
    void getSkeleton()
      .then(data => {
        if (alive) {
          setGlobalSkeleton(data);
        }
      })
      .catch(error => {
        console.warn('[Map] 骨架数据加载失败:', error);
        if (alive) {
          setGlobalSkeleton(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [dataSource]);

  useEffect(() => {
    if (!map.current || !mapReady) {
      return;
    }
    updatePointLayer(map.current, filteredData);
  }, [filteredData, mapReady]);

  useEffect(() => {
    if (!map.current || !mapReady) {
      return;
    }
    updateSelectedHighlight(map.current, selectedItem);
  }, [mapReady, selectedItem]);

  useEffect(() => {
    if (!map.current || !mapReady) {
      return;
    }
    updateGeoJsonSource(
      map.current,
      'tower-data',
      getVisibleTowerData({
        globalSkeleton,
        selectedProjectCode,
        selectedProjectMap: selectedProjectMap as Record<string, unknown> | null,
        selectedProjectStatus,
        projectStatusList,
        projectListRaw,
      }),
    );
    updateGeoJsonSource(
      map.current,
      'station-point-data',
      getVisibleStationData({
        globalSkeleton,
        selectedProjectCode,
        selectedProjectMap: selectedProjectMap as Record<string, unknown> | null,
        selectedProjectStatus,
        projectStatusList,
        projectListRaw,
      }),
    );
  }, [
    globalSkeleton,
    mapReady,
    projectListRaw,
    projectStatusList,
    selectedProjectCode,
    selectedProjectMap,
    selectedProjectStatus,
  ]);

  useEffect(() => {
    if (!map.current || !mapReady) {
      return;
    }
    updateGeoJsonSource(
      map.current,
      'highlighted-towers-data',
      getHighlightedTowerFeatures(
        selectedLineSection as Record<string, unknown> | null,
      ),
    );
  }, [mapReady, selectedLineSection]);

  useEffect(() => {
    if (!map.current || !mapReady) {
      return;
    }

    const layers = [
      { id: 'tower-layer', key: 'tower' },
      { id: 'station-points', key: 'workPoint' },
      { id: 'station-point-layer', key: 'station' },
      { id: 'highlighted-tower-layer', key: 'tower' },
    ] as const;

    layers.forEach(({ id, key }) => {
      if (map.current?.getLayer(id)) {
        map.current.setLayoutProperty(
          id,
          'visibility',
          layerVisibility[key] ? 'visible' : 'none',
        );
      }
    });
  }, [layerVisibility, mapReady]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}

function initializeLayers(map: maplibregl.Map) {
  map.addSource('workpoint-data', {
    type: 'geojson',
    data: emptyFeatureCollection(),
  });
  map.addLayer(POINT_LAYER_CONFIG);

  map.addSource('selected-point', {
    type: 'geojson',
    data: emptyFeatureCollection(),
  });
  map.addLayer(SELECTED_POINT_LAYER_CONFIG);

  registerTowerIcon(map);
  registerStationIcon(map);

  map.addSource('tower-data', {
    type: 'geojson',
    data: emptyFeatureCollection(),
  });
  map.addLayer({
    id: 'tower-layer',
    type: 'symbol',
    source: 'tower-data',
    layout: {
      'icon-image': 'tower-icon',
      'icon-size': 0.6,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  map.addSource('station-point-data', {
    type: 'geojson',
    data: emptyFeatureCollection(),
  });
  map.addLayer({
    id: 'station-point-layer',
    type: 'symbol',
    source: 'station-point-data',
    layout: {
      'icon-image': 'station-icon',
      'icon-size': 0.7,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  map.addSource('highlighted-towers-data', {
    type: 'geojson',
    data: emptyFeatureCollection(),
  });
  map.addLayer({
    id: 'highlighted-tower-layer',
    type: 'circle',
    source: 'highlighted-towers-data',
    paint: {
      'circle-radius': 10,
      'circle-color': '#fde047',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ca8a04',
      'circle-opacity': 0.9,
    },
  });

  const { filteredData } = useAppStore.getState();
  updatePointLayer(map, filteredData);
}

function setupClickHandler(
  map: maplibregl.Map,
  setSelectedObject: (obj: { type: 'tower' | 'station' | 'workPoint'; data: any } | null) => void,
) {
  map.on('click', 'station-points', event => {
    if (!event.features || event.features.length === 0) {
      return;
    }
    const feature = event.features[0];
    const properties = feature.properties;
    const { filteredData } = useAppStore.getState();
    const selectedRecord = filteredData.find(item => item.id === properties?.id);
    if (selectedRecord) {
      setSelectedObject({ type: 'workPoint', data: selectedRecord });
    }
  });

  map.on('click', 'tower-layer', event => {
    if (!event.features || event.features.length === 0) {
      return;
    }
    setSelectedObject({ type: 'tower', data: event.features[0].properties });
  });

  map.on('click', 'station-point-layer', event => {
    if (!event.features || event.features.length === 0) {
      return;
    }
    setSelectedObject({ type: 'station', data: event.features[0].properties });
  });

  ['station-points', 'tower-layer', 'station-point-layer'].forEach(layerId => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

function updatePointLayer(map: maplibregl.Map, data: NormalizedStationMeeting[]) {
  const source = map.getSource('workpoint-data') as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(recordsToGeoJSON(data));
}

function updateSelectedHighlight(
  map: maplibregl.Map,
  selectedItem: NormalizedStationMeeting | null,
) {
  const source = map.getSource('selected-point') as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  if (!selectedItem) {
    source.setData(emptyFeatureCollection());
    return;
  }
  source.setData(recordsToGeoJSON([selectedItem]));
}

function updateGeoJsonSource(
  map: maplibregl.Map,
  sourceId: string,
  features: GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[],
) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData({
    type: 'FeatureCollection',
    features,
  });
}

async function loadBoundaryLayer(map: maplibregl.Map) {
  try {
    const response = await fetch('/data/hunan_boundary.json');
    if (!response.ok) {
      return;
    }

    const boundaryData = await response.json();

    map.addSource('hunan-boundary', {
      type: 'geojson',
      data: boundaryData,
    });

    map.addLayer(BOUNDARY_LAYER_CONFIG.fill);
    map.addLayer(BOUNDARY_LAYER_CONFIG.line);
  } catch (error) {
    console.error('[Map] 边界图层加载错误:', error);
  }
}

function canvasToImageStyle(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')!;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(imageData.data),
  };
}

function drawTriangleToCanvas(
  canvas: HTMLCanvasElement,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
) {
  const context = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  const padding = strokeWidth + 1;

  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = strokeWidth;
  context.lineJoin = 'round';

  context.beginPath();
  context.moveTo(width / 2, padding);
  context.lineTo(padding, height - padding);
  context.lineTo(width - padding, height - padding);
  context.closePath();
  context.fill();
  context.stroke();
}

function drawStarToCanvas(
  canvas: HTMLCanvasElement,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
) {
  const context = canvas.getContext('2d')!;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const outerRadius = Math.min(centerX, centerY) - strokeWidth - 1;
  const innerRadius = outerRadius * 0.4;

  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = strokeWidth;
  context.lineJoin = 'round';

  context.beginPath();
  for (let index = 0; index < 5; index += 1) {
    const outerAngle = ((index * 72 - 90) * Math.PI) / 180;
    const innerAngle = (((index * 72 + 36 - 90) * Math.PI) / 180);
    if (index === 0) {
      context.moveTo(
        centerX + outerRadius * Math.cos(outerAngle),
        centerY + outerRadius * Math.sin(outerAngle),
      );
    }
    context.lineTo(
      centerX + outerRadius * Math.cos(outerAngle),
      centerY + outerRadius * Math.sin(outerAngle),
    );
    context.lineTo(
      centerX + innerRadius * Math.cos(innerAngle),
      centerY + innerRadius * Math.sin(innerAngle),
    );
  }
  context.closePath();
  context.fill();
  context.stroke();
}

function registerTowerIcon(map: maplibregl.Map) {
  if (map.hasImage('tower-icon')) {
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  drawTriangleToCanvas(canvas, '#8b5cf6', '#ffffff', 2);
  map.addImage('tower-icon', canvasToImageStyle(canvas), { sdf: false });
}

function registerStationIcon(map: maplibregl.Map) {
  if (map.hasImage('station-icon')) {
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 72;
  drawStarToCanvas(canvas, '#ff0000', '#ffffff', 3);
  map.addImage('station-icon', canvasToImageStyle(canvas), { sdf: false });
}
