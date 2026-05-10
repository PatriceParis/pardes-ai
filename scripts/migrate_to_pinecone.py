"""Migrate vectors from local LanceDB to Pinecone serverless.

Reads all rows from the chunks table and pushes to Pinecone in batches.
Filters out near-empty chunks (< MIN_TEXT_CHARS) before upload.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from tqdm import tqdm
import lancedb

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

DB_PATH = Path(
    os.environ.get("LANCEDB_PATH", "./data/pardes.lance")
).resolve()
TABLE_NAME = "chunks"
UPSERT_BATCH = 100
METADATA_TEXT_LIMIT = 30000  # Pinecone metadata limit is ~40KB per vector
MIN_TEXT_CHARS = 100


def main() -> int:
    api_key = os.environ.get("PINECONE_API_KEY")
    index_name = os.environ.get("PINECONE_INDEX_NAME", "pardes-ai")
    if not api_key:
        print("PINECONE_API_KEY missing in .env.local", file=sys.stderr)
        return 1

    try:
        from pinecone import Pinecone
    except ImportError:
        print("pip install pinecone first", file=sys.stderr)
        return 1

    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)

    desc = pc.describe_index(index_name)
    print(f"Pinecone index: {index_name}")
    print(f"  dimension: {desc.dimension}")
    print(f"  metric:    {desc.metric}")

    db = lancedb.connect(str(DB_PATH))
    table = db.open_table(TABLE_NAME)
    total = table.count_rows()
    print(f"LanceDB: {total:,} rows at {DB_PATH}")

    arrow_tbl = table.to_arrow()
    ids_all = arrow_tbl.column("id").to_pylist()
    corpora_all = arrow_tbl.column("corpus").to_pylist()
    livres_all = arrow_tbl.column("livre").to_pylist()
    chapitres_all = arrow_tbl.column("chapitre").to_pylist()
    pages_all = arrow_tbl.column("page").to_pylist()
    source_paths_all = arrow_tbl.column("source_path").to_pylist()
    texts_all = arrow_tbl.column("text").to_pylist()
    vectors_all = arrow_tbl.column("vector").to_pylist()

    keep = [i for i, t in enumerate(texts_all) if len(t or "") >= MIN_TEXT_CHARS]
    dropped = total - len(keep)
    print(f"filter: keep {len(keep):,}/{total:,} (dropped {dropped:,} chunks with text < {MIN_TEXT_CHARS} chars)")

    dim = len(vectors_all[0]) if vectors_all else 0
    if dim != desc.dimension:
        print(
            f"!! dim mismatch: LanceDB {dim} vs Pinecone {desc.dimension}",
            file=sys.stderr,
        )
        return 1

    pbar = tqdm(total=len(keep), desc="upsert", unit="vec")
    for start in range(0, len(keep), UPSERT_BATCH):
        end = min(start + UPSERT_BATCH, len(keep))
        batch = []
        for i in keep[start:end]:
            text = (texts_all[i] or "")[:METADATA_TEXT_LIMIT]
            page_val = pages_all[i]
            metadata = {
                "corpus": corpora_all[i] or "",
                "livre": livres_all[i] or "",
                "chapitre": chapitres_all[i] or "",
                "page": int(page_val) if page_val is not None else 0,
                "source_path": source_paths_all[i] or "",
                "text": text,
            }
            batch.append(
                {"id": ids_all[i], "values": vectors_all[i], "metadata": metadata}
            )

        last: Exception | None = None
        for attempt in range(4):
            try:
                index.upsert(vectors=batch)
                last = None
                break
            except Exception as e:  # noqa: BLE001
                last = e
                wait = 2 ** attempt
                print(f"\n  upsert retry {attempt+1} in {wait}s ({e})", file=sys.stderr)
                time.sleep(wait)
        if last is not None:
            print(f"\n!! batch {start}-{end} failed permanently: {last}", file=sys.stderr)
            return 1
        pbar.update(end - start)
    pbar.close()

    time.sleep(3)
    stats = index.describe_index_stats()
    print(f"\nDone. Pinecone vector count: {stats.total_vector_count:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
