"""Inspect LanceDB state: total rows, distinct ids, duplicates per id."""
import lancedb
from collections import Counter
from pathlib import Path

DB_PATH = Path(r"C:\Users\patri\Shalom\app\data\pardes.lance")
db = lancedb.connect(str(DB_PATH))

print("tables:", db.table_names())
t = db.open_table("chunks")
print("count_rows:", t.count_rows())

ids = []
corpus_counts = Counter()
arrow_tbl = t.to_arrow()
ids = arrow_tbl.column("id").to_pylist()
for c in arrow_tbl.column("corpus").to_pylist():
    corpus_counts[c] += 1

print("rows scanned:", len(ids))
counts = Counter(ids)
print("distinct ids:", len(counts))
top = counts.most_common(1)
print("max occurrences of any single id:", top[0][1] if top else 0)
print("ids with >1 occurrence:", sum(1 for v in counts.values() if v > 1))

print("\nrows by corpus:")
for k, v in corpus_counts.most_common():
    print(f"  {k}: {v}")
