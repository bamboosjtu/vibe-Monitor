import type { NormalizedStationMeeting } from '@/types';

/**
 * 将归一化记录转换为 GeoJSON Feature
 */
function recordToFeature(record: NormalizedStationMeeting): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [record.longitude, record.latitude],
    },
    properties: {
      id: record.id,
      projectName: record.projectName,
      personCount: record.personCount,
      personCountDisplay: record.personCountDisplay,
      riskLevel: record.riskLevel,
      workStatus: record.workStatus,
      voltageLevel: record.voltageLevel,
      city: record.city,
      address: record.address,
      leaderName: record.leaderName,
    },
  };
}

/**
 * 将归一化记录数组转换为 GeoJSON FeatureCollection
 */
export function recordsToGeoJSON(
  records: NormalizedStationMeeting[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: records.map(recordToFeature),
  };
}
