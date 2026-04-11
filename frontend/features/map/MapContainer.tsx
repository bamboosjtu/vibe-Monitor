import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CONFIG, OSM_STYLE } from '@/constants/map';
import { POINT_LAYER_CONFIG, BOUNDARY_LAYER_CONFIG, SELECTED_POINT_LAYER_CONFIG } from '@/constants/layers';
import { recordsToGeoJSON } from '@/lib/geojson';
import { useAppStore } from '@/store';
import type { NormalizedStationMeeting } from '@/types';
import { getSkeleton } from '@/api/mapApi';

/**
 * M1R2-hotfix: 全局 map 实例引用（用于 DebugOverlay 查询）
 * 验证通过后可删除
 */
let _globalMapInstance: maplibregl.Map | null = null;

export function getMapInstance(): maplibregl.Map | null {
  return _globalMapInstance;
}

/**
 * M1R2-hotfix: 自检命令（在浏览器控制台调用 window.__checkMapSources()）
 * 验证通过后可删除
 */
if (typeof window !== 'undefined') {
  (window as any).__checkMapSources = () => {
    const map = getMapInstance();
    if (!map) {
      console.log('[SelfCheck] Map instance is null');
      return;
    }

    const style = map.getStyle();
    console.log('[SelfCheck] === Sources ===');
    console.log('Source keys:', Object.keys(style.sources || {}));
    
    console.log('[SelfCheck] === Layers (workpoint/tower/station) ===');
    const layers = style.layers || [];
    layers
      .filter(l => l.id.includes('station') || l.id.includes('tower') || l.id.includes('point'))
      .forEach(l => {
        console.log(`  layer: ${l.id}, source: ${(l as any).source}, type: ${l.type}`);
      });

    console.log('[SelfCheck] === Feature Counts ===');
    ['workpoint-data', 'tower-data', 'station-point-data', 'selected-point'].forEach(id => {
      const source = map.getSource(id);
      if (!source) {
        console.log(`  ${id}: MISSING`);
      } else {
        const count = (source as any)?._data?.features?.length ?? (source as any)?._geojson?.data?.features?.length ?? 'unknown';
        console.log(`  ${id}: ${count}`);
      }
    });
  };
}

export function MapContainer() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { filteredData, selectedItem, layerVisibility, setSelectedObject } = useAppStore();

  useEffect(() => {
    console.log('[Map] filteredData changed, count:', filteredData.length);
  }, [filteredData]);

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

    _globalMapInstance = map.current;

    // 添加导航控件
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 添加比例尺控件
    map.current.addControl(new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric',
    }), 'bottom-left');

    // 地图加载完成后初始化图层
    map.current.on('load', async () => {
      initializeLayers(map.current!);
      setupClickHandler(map.current!, setSelectedObject);
      // M1R2: 骨架数据加载与主链路隔离，失败不影响日期/WorkPoint
      try {
        await loadBoundaryLayer(map.current!);
      } catch (e) {
        console.warn('[Map] 边界层加载失败（非关键）:', e);
      }
      try {
        await loadSkeletonLayers(map.current!, layerVisibility);
      } catch (e) {
        console.warn('[Map] 骨架层加载失败（非关键）:', e);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [setSelectedObject]);

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

  // M1 Round2: 监听图层显隐变化
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    // 更新各图层显隐
    const layers = [
      { id: 'tower-layer', key: 'tower' },
      { id: 'station-points', key: 'workPoint' },
      { id: 'station-point-layer', key: 'station' },
    ] as const;
    
    layers.forEach(({ id, key }) => {
      if (map.current?.getLayer(id)) {
        map.current.setLayoutProperty(
          id,
          'visibility',
          layerVisibility[key] ? 'visible' : 'none'
        );
      }
    });
  }, [layerVisibility]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200 relative">
      <div ref={mapContainer} className="w-full h-full" />
      <DebugOverlay />
    </div>
  );
}

/**
 * M1R2-hotfix: 调试覆盖层 - 显示图层 feature 数量
 * 验证通过后可删除
 */
function DebugOverlay() {
  const { filteredData } = useAppStore();
  const [layerCounts, setLayerCounts] = useState({
    workPoint: 0,
    tower: 0,
    station: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const map = getMapInstance();
      if (!map) {
        console.log('[DebugOverlay] map instance is null');
        return;
      }

      const wpSource = map.getSource('workpoint-data');
      const towerSource = map.getSource('tower-data');
      const stationSource = map.getSource('station-point-data');

      console.log('[DebugOverlay] Sources:', {
        wpSource: wpSource ? 'exists' : 'MISSING',
        towerSource: towerSource ? 'exists' : 'MISSING',
        stationSource: stationSource ? 'exists' : 'MISSING',
      });

      // 尝试多种属性名获取 feature 数量
      const getFeatureCount = (source: any, label: string) => {
        if (!source) {
          console.log(`[DebugOverlay] ${label} source is MISSING`);
          return 0;
        }
        const count = source._data?.features?.length ?? source._geojson?.data?.features?.length ?? 0;
        console.log(`[DebugOverlay] ${label}: source._data?.features?.length = ${source._data?.features?.length}, source._geojson?.data?.features?.length = ${source._geojson?.data?.features?.length}, final = ${count}`);
        return count;
      };

      setLayerCounts({
        workPoint: getFeatureCount(wpSource, 'WorkPoint'),
        tower: getFeatureCount(towerSource, 'Tower'),
        station: getFeatureCount(stationSource, 'Station'),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute top-2 right-2 bg-black/80 text-green-400 font-mono text-xs p-2 rounded z-10 pointer-events-none select-none"
      style={{ fontFamily: 'monospace' }}
    >
      <div>[M1R2 Debug]</div>
      <div>WorkPoint features: {layerCounts.workPoint}</div>
      <div>Tower features: {layerCounts.tower}</div>
      <div>Station features: {layerCounts.station}</div>
      <div>filteredData: {filteredData.length}</div>
    </div>
  );
}

/**
 * 初始化地图图层（点位数据源 + 选中态图层）
 * 注意：边界图层现在在外层加载，确保顺序
 */
function initializeLayers(map: maplibregl.Map) {
    // 初始化 WorkPoint 点位数据源（空）
  map.addSource('workpoint-data', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  });

  // 添加 WorkPoint 点位图层
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
 * 设置点击事件处理器（M1 Round2: 支持四类对象）
 */
function setupClickHandler(
  map: maplibregl.Map,
  setSelectedObject: (obj: { type: 'tower' | 'station' | 'workPoint'; data: any } | null) => void
) {
  // WorkPoint 点击（原有）
  map.on('click', 'station-points', (e) => {
    if (!e.features || e.features.length === 0) return;
    const feature = e.features[0];
    const properties = feature.properties;
    const { filteredData } = useAppStore.getState();
    const selectedRecord = filteredData.find(item => item.id === properties?.id);
    if (selectedRecord) {
      setSelectedObject({ type: 'workPoint', data: selectedRecord });
    }
  });

  // Tower 点击
  map.on('click', 'tower-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const feature = e.features[0];
    setSelectedObject({ type: 'tower', data: feature.properties });
  });

  // Station 点击
  map.on('click', 'station-point-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const feature = e.features[0];
    setSelectedObject({ type: 'station', data: feature.properties });
  });

  // M1R2: Line 点击已移除

  // 鼠标样式变化
  ['station-points', 'tower-layer', 'station-point-layer'].forEach(layerId => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

/**
 * 更新点位图层数据
 */
function updatePointLayer(map: maplibregl.Map, data: NormalizedStationMeeting[]) {
  console.log('[Map] updatePointLayer called, data.length:', data.length);
  
  const source = map.getSource('workpoint-data') as maplibregl.GeoJSONSource | undefined;

  if (!source) {
    console.warn('[Map] 点位数据源不存在 (workpoint-data)');
    return;
  }

  console.log('[Map] workpoint-data source exists, proceeding to setData');

  const geojson = recordsToGeoJSON(data);
  console.log('[Map] geojson.features.length:', geojson.features.length);
  
  source.setData(geojson);
  console.log('[Map] WorkPoint setData executed, features:', geojson.features.length);
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

/**
 * 将 canvas 转换为 MapLibre 可用的 { width, height, data: Uint8Array } 格式
 */
function canvasToImageStyle(canvas: HTMLCanvasElement): { width: number; height: number; data: Uint8Array } {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(imageData.data),
  };
}

/**
 * 绘制三角形到 canvas
 */
function drawTriangleToCanvas(canvas: HTMLCanvasElement, fillColor: string, strokeColor: string, strokeWidth: number) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const pad = strokeWidth + 1;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(w / 2, pad);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * 绘制五角星到 canvas
 */
function drawStarToCanvas(canvas: HTMLCanvasElement, fillColor: string, strokeColor: string, strokeWidth: number) {
  const ctx = canvas.getContext('2d')!;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxR = Math.min(cx, cy) - strokeWidth - 1;
  const innerR = maxR * 0.4;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 72 - 90) * Math.PI / 180;
    const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
    if (i === 0) {
      ctx.moveTo(cx + maxR * Math.cos(outerAngle), cy + maxR * Math.sin(outerAngle));
    }
    ctx.lineTo(cx + maxR * Math.cos(outerAngle), cy + maxR * Math.sin(outerAngle));
    ctx.lineTo(cx + innerR * Math.cos(innerAngle), cy + innerR * Math.sin(innerAngle));
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * M1R2-hotfix: 加载骨架图层（杆塔 + 变电站）
 * Tower: symbol layer + triangle icon (紫色)
 * Station: symbol layer + star icon (红色)
 */
async function loadSkeletonLayers(map: maplibregl.Map, visibility: { tower: boolean; station: boolean; workPoint: boolean }) {
  console.log('[M1R2] loadSkeletonLayers function ENTERED');
  try {
    console.log('[M1R2] 开始加载骨架数据...');
    const skeleton = await getSkeleton();
    console.log('[M1R2] getSkeleton() returned:', {
      lines: skeleton?.lines?.length ?? 'undefined',
      towers: skeleton?.towers?.length ?? 'undefined',
      stations: skeleton?.stations?.length ?? 'undefined',
    });

    if (!skeleton || !skeleton.towers || !skeleton.stations) {
      console.error('[M1R2] skeleton data is invalid:', skeleton);
      return;
    }

    // M1R2: 线路图层已移除，等待更可靠数据后再恢复
    console.log('[M1R2] 线路数据暂不显示，lines:', skeleton.lines.length);

    // 注册 Tower 三角形 icon
    const towerCanvas = document.createElement('canvas');
    towerCanvas.width = 64;
    towerCanvas.height = 64;
    drawTriangleToCanvas(towerCanvas, '#8b5cf6', '#ffffff', 2);
    map.addImage('tower-icon', canvasToImageStyle(towerCanvas), { sdf: false });
    console.log('[M1R2] Tower icon registered, size:', towerCanvas.width, 'x', towerCanvas.height);

    // 注册 Station 五角星 icon
    const stationCanvas = document.createElement('canvas');
    stationCanvas.width = 72;
    stationCanvas.height = 72;
    drawStarToCanvas(stationCanvas, '#ff0000', '#ffffff', 3);
    map.addImage('station-icon', canvasToImageStyle(stationCanvas), { sdf: false });
    console.log('[M1R2] Station icon registered, size:', stationCanvas.width, 'x', stationCanvas.height);

    // 1. 杆塔图层 - symbol layer + triangle
    console.log('[M1R2] Building towerFeatures from', skeleton.towers.length, 'towers');
    const towerFeatures = skeleton.towers.map(tower => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [tower.longitude, tower.latitude],
      },
      properties: {
        id: tower.id,
        single_project_code: tower.single_project_code,
        tower_no: tower.tower_no,
        tower_sequence_no: tower.tower_sequence_no,
        longitude: tower.longitude,
        latitude: tower.latitude,
      },
    }));

    console.log('[M1R2] Tower features count:', towerFeatures.length);
    
    map.addSource('tower-data', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: towerFeatures,
      },
    });
    const towerSource = map.getSource('tower-data');
    console.log('[M1R2] tower-data source exists:', !!towerSource, 'features:', (towerSource as any)?._data?.features?.length);

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
    map.setLayoutProperty('tower-layer', 'visibility', visibility.tower ? 'visible' : 'none');
    console.log('[M1R2] Tower layer added:', towerFeatures.length, 'features, visibility:', visibility.tower ? 'visible' : 'none');

    // 2. 变电站图层 - symbol layer + star
    console.log('[M1R2] Building stationFeatures from', skeleton.stations.length, 'stations');
    const stationFeatures = skeleton.stations.map(station => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [station.longitude, station.latitude],
      },
      properties: {
        id: station.id,
        single_project_code: station.single_project_code,
        name: station.name,
        prj_code: station.prj_code,
        longitude: station.longitude,
        latitude: station.latitude,
      },
    }));

    console.log('[M1R2] Station features count:', stationFeatures.length);
    
    map.addSource('station-point-data', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stationFeatures,
      },
    });
    const stationSource = map.getSource('station-point-data');
    console.log('[M1R2] station-point-data source exists:', !!stationSource, 'features:', (stationSource as any)?._data?.features?.length);

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
    map.setLayoutProperty('station-point-layer', 'visibility', visibility.station ? 'visible' : 'none');
    console.log('[M1R2] Station layer added:', stationFeatures.length, 'features, visibility:', visibility.station ? 'visible' : 'none');

    console.log('[M1R2] loadSkeletonLayers COMPLETE');

  } catch (err) {
    console.error('[M1] 骨架数据加载失败:', err);
    console.error('[M1] Error stack:', err instanceof Error ? err.stack : 'no stack');
  }
}
