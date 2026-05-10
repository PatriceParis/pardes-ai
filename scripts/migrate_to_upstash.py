"""Migrate vectors from local LanceDB to Upstash Vector.

Reads all rows from the chunks table, batches by UPSERT_BATCH, and pushes
each batch to Upstash. Metadata stored: corpus, livre, chapitre, page,
source_path, text. Idempotent — re-running upserts (replaces) existing IDs.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from upstash_vector import Index, Vector
from tqdm import tqdm
import lancedb

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

DB_PATH = Path(
    os.environ.get("LANCEDB_PATH", "./data/pardes.lance")
).resolve()
TABLE_NAME = "chunks"
UPSERT_BATCH = 100
METADATA_TEXT_LIMIT = 2400  # Upstash has metadata size limits per vector
MIN_TEXT_CHARS = 100  # Drop near-empty chunks (mostly OCR-failed scan metadata)


def main() -> int:
    url = os.environ.get("UPSTASH_VECTOR_REST_URL")
    token = os.environ.get("UPSTASH_VECTOR_REST_TOKEN")
    if not url or not token:
        print("UPSTASH_VECTOR_REST_URL/TOKEN missing in .env.local", file=sys.stderr)
        return 1

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

    # Filter: drop near-empty chunks (typically failed OCR / scan metadata).
    keep = [i for i, t in enumerate(texts_all) if len(t or "") >= MIN_TEXT_CHARS]
    dropped = total - len(keep)
    print(f"filter: keep {len(keep):,}/{total:,} (dropped {dropped:,} chunks with text < {MIN_TEXT_CHARS} chars)")
    ids = [ids_all[i] for i in keep]
    corpora = [corpora_all[i] for i in keep]
    livres = [livres_all[i] for i in keep]
    chapitres = [chapitres_all[i] for i in keep]
    pages = [pages_all[i] for i in keep]
    source_paths = [source_paths_all[i] for i in keep]
    texts = [texts_all[i] for i in keep]
    vectors = [vectors_all[i] for i in keep]
    total = len(keep)

    if vectors and not vectors[0]:
        print("vectors look empty", file=sys.stderr)
        return 1
    dim = len(vectors[0])
    print(f"vector dim: {dim}")

    index = Index(url=url, token=token)
    info = index.info()
    print(f"Upstash: dim={info.dimension}, metric={info.similarity_function}, current count={info.vector_count}")
    if info.dimension != dim:
        print(
            f"!! dim mismatch: LanceDB {dim} vs Upstash {info.dimension}. Recreate the index.",
            file=sys.stderr,
        )
        return 1

    if info.vector_count > 0 and "--no-reset" not in sys.argv:
        print(f"Resetting Upstash index to remove {info.vector_count} stale vectors…")
        index.reset()
        time.sleep(2)
        info = index.info()
        print(f"  after reset: count={info.vector_count}")

    pbar = tqdm(total=total, desc="upsert", unit="vec")
    for start in range(0, total, UPSERT_BATCH):
        end = min(start + UPSERT_BATCH, total)
        batch = []
        for i in range(start, end):
            text = (texts[i] or "")[:METADATA_TEXT_LIMIT]
            metadata = {
                "corpus": corpora[i] or "",
                "livre": livres[i] or "",
                "chapitre": chapitres[i] or "",
                "page": pages[i] if pages[i] is not None else 0,
                "source_path": source_paths[i] or "",
                "text": text,
            }
            batch.append(
                Vector(id=ids[i], vector=vectors[i], metadata=metadata)
            )
        # Retry up to 3 times on transient errors
        last: Exception | None = None
        for attempt in range(3):
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

    info = index.info()
    print(f"\nDone. Upstash count: {info.vector_count:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
