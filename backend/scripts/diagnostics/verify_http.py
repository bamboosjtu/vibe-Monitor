import requests
import json

BASE_URL = "http://localhost:8000/api"

# Bootstrap
r = requests.get(f"{BASE_URL}/bootstrap")
print("=== GET /api/bootstrap ===")
print(json.dumps(r.json(), indent=2, ensure_ascii=False))
print()

# Map summary
r = requests.get(f"{BASE_URL}/map/summary")
print("=== GET /api/map/summary ===")
data = r.json()
print(f"状态码: {r.status_code}")
print(json.dumps(data, indent=2, ensure_ascii=False))

summary_data = data.get("data", {})
total_points = summary_data.get("total_points", "N/A")
points = summary_data.get("data", [])

print(f"\n总点位: {total_points}")
print(f"点位列表长度: {len(points)}")

if points:
    print(f"第一条点位: {json.dumps(points[0], ensure_ascii=False, indent=2)}")
    
    # 检查是否有有效坐标
    with_coords = [p for p in points if p.get("longitude") and p.get("latitude")]
    print(f"\n有有效坐标的点位: {len(with_coords)}")
    if with_coords:
        print(f"  第一条: lng={with_coords[0]['longitude']}, lat={with_coords[0]['latitude']}")
    else:
        print("  所有点位坐标均为空（meeting_current 中 tool_box_talk_longitude/latitude 可能未填充）")
        # 显示第一个点的坐标字段原始值
        first = points[0]
        print(f"  原始 longitude: {first.get('longitude')}")
        print(f"  原始 latitude: {first.get('latitude')}")
else:
    print("点位列表: 空")

print()
