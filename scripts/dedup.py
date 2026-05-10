"""Deduplicate the chunks table by `id` (keep first occurrence)."""
import lancedb
import pyarrow as pa
import pyarrow.compute as pc
from pathlib import Path

DB_PATH = Path(r"C:\Users\patri\Shalom\app\data\pardes.lance")
TABLE_NAME = "chunks"

db = lancedb.connect(str(DB_PATH))
t = db.open_table(TABLE_NAME)
print(f"before: {t.count_rows():,} rows")

arrow_tbl = t.to_arrow()
seen: set[str] = set()
keep_idx: list[int] = []
ids = arrow_tbl.column("id").to_pylist()
for i, id_ in enumerate(ids):
    if id_ not in seen:
        seen.add(id_)
        keep_idx.append(i)

print(f"distinct: {len(keep_idx):,} rows to keep")

# Build deduped arrow table
mask = pa.array([i in set(keep_idx) for i in range(len(ids))], type=pa.bool_())
deduped = arrow_tbl.filter(mask)
print(f"deduped table: {deduped.num_rows:,} rows")

# Drop and recreate
db.drop_table(TABLE_NAME)
new_t = db.create_table(TABLE_NAME, data=deduped, mode="create")
print(f"after: {new_t.count_rows():,} rows")
