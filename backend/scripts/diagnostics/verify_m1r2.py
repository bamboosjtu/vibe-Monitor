"""验证 M1 Round2"""
import requests, json

# 1. 验证 skeleton API
r = requests.get("http://localhost:8000/api/map/skeleton", timeout=10)
d = r.json()
print("=== /api/map/skeleton ===")
print(f"HTTP: {r.status_code}, code: {d.get('code')}")
data = d.get("data", {})
print(f"lines: {len(data.get('lines', []))}")
print(f"towers: {len(data.get('towers', []))}")
print(f"stations: {len(data.get('stations', []))}")

if data.get('stations'):
    print("\nStation 示例:")
    print(json.dumps(data['stations'][0], indent=2, ensure_ascii=False))

# 2. 验证 bootstrap
r2 = requests.get("http://localhost:8000/api/bootstrap", timeout=10)
d2 = r2.json()
print(f"\n=== /api/bootstrap ===")
print(f"unresolved_year_progress_count: {d2.get('data', {}).get('unresolved_year_progress_count')}")

print("\n=== 验证完成 ===")
