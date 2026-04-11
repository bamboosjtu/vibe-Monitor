// 地图配置常量

// 湖南省范围（经纬度边界）
export const HUNAN_BOUNDS = {
  minLng: 108.6,
  maxLng: 114.3,
  minLat: 24.6,
  maxLat: 30.2,
};

// 湖南省中心点
export const HUNAN_CENTER: [number, number] = [
  (HUNAN_BOUNDS.minLng + HUNAN_BOUNDS.maxLng) / 2, // 111.45
  (HUNAN_BOUNDS.minLat + HUNAN_BOUNDS.maxLat) / 2, // 27.4
];

// 地图初始配置
export const MAP_CONFIG = {
  center: HUNAN_CENTER,
  zoom: 6.5,
  minZoom: 5,
  maxZoom: 18,
};

// OSM 底图配置（开发环境使用）
// 生产环境可替换为天地图或其他合规底图
export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    'osm': {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> Contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
    },
  ],
};
