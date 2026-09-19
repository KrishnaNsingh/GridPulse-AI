import csv
import math
import random
from datetime import datetime, timedelta

random.seed(42)
start = datetime(2024, 1, 1, 0, 0, 0)
rows = []
for h in range(7 * 24):
    ts = start + timedelta(hours=h)
    hour = ts.hour
    dow = ts.weekday()
    base = 50.0
    morning = 20 * math.exp(-0.5 * ((hour - 9) / 2.0) ** 2)
    evening = 25 * math.exp(-0.5 * ((hour - 19) / 1.5) ** 2)
    night = -10 * math.exp(-0.5 * ((hour - 3) / 2.0) ** 2)
    weekend = -8 if dow >= 5 else 0
    noise = random.gauss(0, 3)
    price = max(5.0, base + morning + evening + night + weekend + noise)
    rows.append({"timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"), "price": round(price, 2)})

with open("data/sample_prices.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["timestamp", "price"])
    writer.writeheader()
    writer.writerows(rows)

prices = [r["price"] for r in rows]
print(f"Generated {len(rows)} price records")
print(f"Price range: {min(prices):.2f} - {max(prices):.2f} USD/MWh")
print(f"Average price: {sum(prices)/len(prices):.2f} USD/MWh")
