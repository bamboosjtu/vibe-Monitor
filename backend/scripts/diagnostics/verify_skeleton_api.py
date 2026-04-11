"""验证 skeleton API"""
import requests, json

r = requests.get("http://localhost:8000/api/map/skeleton", timeout=10)
d = r.json()
print(f"HTTP {r.status_code}, code={d.get('code')}")
data = d.get("data", {})
lines = data.get("lines", [])
towers = data.get("towers", [])
print(f"Line 数量: {len(lines)}")
print(f"Tower 数量: {len(towers)}")

if lines:
    print(f"\n示例 Line (第1条):")
    print(json.dumps(lines[0], indent=2, ensure_ascii=False))

if towers:
    print(f"\n示例 Tower (第1条):")
    print(json.dumps(towers[0], indent=2, ensure_ascii=False))
