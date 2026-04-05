import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CONFIG, OSM_STYLE } from '@/constants/map';
import { POINT_LAYER_CONFIG, BOUNDARY_LAYER_CONFIG, SELECTED_POINT_LAYER_CONFIG } from '@/constants/layers';
import { recordsToGeoJSON } from '@/lib/geojson';
import { useAppStore } from '@/store';
import type { NormalizedStationMeeting } from '@/types';

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { filteredData, selectedItem, setSelectedItem } = useAppStore();

  // 初始化地图
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE as maplibregl.StyleSpecification,
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
    });

    // 添加导航控件
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 添加比例尺控件
    map.current.addControl(new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric',
    }), 'bottom-left');

    // 地图加载完成后初始化图层
    map.current.on('load', () => {
      initializeLayers(map.current!);
      setupClickHandler(map.current!, setSelectedItem);
    });

    return () => {
      map.current?.remove();
    };
  }, [setSelectedItem]);

  // 监听筛选数据变化，更新点位图层
  useEffect(() => {
    if (!map.current) return;

    // 等待地图加载完成
    if (!map.current.isStyleLoaded()) {
      map.current.once('styledata', () => {
        updatePointLayer(map.current!, filteredData);
      });
      return;
    }

    updatePointLayer(map.current, filteredData);
  }, [filteredData]);

  // 监听选中项变化，更新选中态高亮
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    updateSelectedHighlight(map.current, selectedItem);
  }, [selectedItem]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

/**
 * 初始化地图图层（边界 + 点位数据源 + 选中态图层）
 */
function initializeLayers(map: maplibregl.Map) {
  // 1. 加载边界图层
  loadBoundaryLayer(map);

  // 2. 初始化点位数据源（空）
  map.addSource('station-data', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  });

  // 3. 添加点位图层
  map.addLayer(POINT_LAYER_CONFIG);

  // 4. 添加选中态图层（初始为空）
  map.addSource('selected-point', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  });
  map.addLayer(SELECTED_POINT_LAYER_CONFIG);

  // 5. 立即用当前 store 中的数据更新点位图层
  // 修复首次加载时数据已准备好但图层未更新的问题
  const { filteredData } = useAppStore.getState();
  updatePointLayer(map, filteredData);
}

/**
 * 设置点击事件处理器
 */
function setupClickHandler(
  map: maplibregl.Map,
  setSelectedItem: (item: NormalizedStationMeeting | null) => void
) {
  map.on('click', 'station-points', (e) => {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const properties = feature.properties;

    // 从 filteredData 中找到完整记录
    const { filteredData } = useAppStore.getState();
    const selectedRecord = filteredData.find(item => item.id === properties?.id);

    if (selectedRecord) {
      setSelectedItem(selectedRecord);
    }
  });

  // 鼠标样式变化
  map.on('mouseenter', 'station-points', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'station-points', () => {
    map.getCanvas().style.cursor = '';
  });
}

/**
 * 更新点位图层数据
 */
function updatePointLayer(map: maplibregl.Map, data: NormalizedStationMeeting[]) {
  const source = map.getSource('station-data') as maplibregl.GeoJSONSource | undefined;

  if (!source) {
    console.warn('[Map] 点位数据源不存在');
    return;
  }

  const geojson = recordsToGeoJSON(data);
  source.setData(geojson);
}

/**
 * 更新选中态高亮
 */
function updateSelectedHighlight(
  map: maplibregl.Map,
  selectedItem: NormalizedStationMeeting | null
) {
  const source = map.getSource('selected-point') as maplibregl.GeoJSONSource | undefined;

  if (!source) {
    console.warn('[Map] 选中态数据源不存在');
    return;
  }

  if (!selectedItem) {
    // 清空选中态
    source.setData({
      type: 'FeatureCollection',
      features: [],
    });
    return;
  }

  // 设置选中项为高亮
  const geojson = recordsToGeoJSON([selectedItem]);
  source.setData(geojson);
}

/**
 * 加载湖南省边界图层
 */
async function loadBoundaryLayer(map: maplibregl.Map) {
  try {
    const response = await fetch('/data/hunan_boundary.json');
    if (!response.ok) {
      console.warn('[Map] 边界数据加载失败');
      return;
    }

    const boundaryData = await response.json();

    map.addSource('hunan-boundary', {
      type: 'geojson',
      data: boundaryData,
    });

    map.addLayer(BOUNDARY_LAYER_CONFIG.fill);
    map.addLayer(BOUNDARY_LAYER_CONFIG.line);
  } catch (err) {
    console.error('[Map] 边界图层加载错误:', err);
  }
}
