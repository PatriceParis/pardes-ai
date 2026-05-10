"""Analyze chunk quality by text length, grouped by corpus."""
import lancedb
from collections import defaultdict
from pathlib import Path

db = lancedb.connect(str(Path(r"C:\Users\patri\Shalom\app\data\pardes.lance")))
t = db.open_table("chunks")
arrow = t.to_arrow()

corpora = arrow.column("corpus").to_pylist()
texts = arrow.column("text").to_pylist()

buckets = defaultdict(lambda: defaultdict(int))
for c, txt in zip(corpora, texts):
    n = len(txt or "")
    if n < 50:
        bucket = "<50"
    elif n < 100:
        bucket = "50-99"
    elif n < 300:
        bucket = "100-299"
    elif n < 800:
        bucket = "300-799"
    else:
        bucket = "800+"
    buckets[c][bucket] += 1
    buckets[c]["TOTAL"] += 1

corpora_sorted = sorted(buckets.keys(), key=lambda c: -buckets[c]["TOTAL"])
header = f"{'corpus':<15} {'<50':>7} {'50-99':>7} {'100-299':>9} {'300-799':>9} {'800+':>7} {'TOTAL':>7}"
print(header)
print("-" * len(header))
totals = defaultdict(int)
for c in corpora_sorted:
    b = buckets[c]
    print(f"{c:<15} {b['<50']:>7} {b['50-99']:>7} {b['100-299']:>9} {b['300-799']:>9} {b['800+']:>7} {b['TOTAL']:>7}")
    for k, v in b.items():
        totals[k] += v
print("-" * len(header))
print(f"{'ALL':<15} {totals['<50']:>7} {totals['50-99']:>7} {totals['100-299']:>9} {totals['300-799']:>9} {totals['800+']:>7} {totals['TOTAL']:>7}")
print()
print(f"Chunks with text >= 100 chars: {totals['100-299'] + totals['300-799'] + totals['800+']:,}")
print(f"Chunks with text >= 50 chars : {totals['50-99'] + totals['100-299'] + totals['300-799'] + totals['800+']:,}")
