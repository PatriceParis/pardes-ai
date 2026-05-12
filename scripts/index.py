"""
Index the Torah/Neviim/Ketouvim/Talmud PDF corpus into LanceDB.

Pipeline: PDF -> per-page text -> ~800-token chunks (100 overlap)
       -> Voyage embeddings (batch 64) -> LanceDB table 'chunks'.

Resumable: skips files whose ids already exist in the table.
Run from app/: python scripts/index.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import hashlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Iterator

from dotenv import load_dotenv
from tqdm import tqdm
import pyarrow as pa
import lancedb
import voyageai
from pypdf import PdfReader

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

CORPUS_ROOT = Path(
    os.environ.get(
        "CORPUS_ROOT",
        r"C:\Users\patri\Shalom\KB\torah_pdfs\files",
    )
)
DB_PATH = Path(
    os.environ.get("LANCEDB_PATH", "./data/pardes.lance")
).resolve()
TABLE_NAME = "chunks"
MODEL = os.environ.get("VOYAGE_EMBED_MODEL", "voyage-3-large")
EMBED_DIM = 1024  # voyage-3-large default (Matryoshka also supports 256/512/2048)
CHUNK_TOKENS = 400
OVERLAP_TOKENS = 80
EMBED_BATCH = 32  # voyage-3-large prefers smaller batches for stability
WRITE_BATCH = 256

CORPUS_LABELS = {
    "torah": "Torah",
    "neviim": "Neviim",
    "ketouvim": "Ketouvim",
    "talmud": "Talmud",
}

# Standalone documents outside the Tanakh corpus tree.
# (absolute_path, corpus_label, livre_label)
EXTRA_DOCS: list[tuple[Path, str, str]] = [
    (
        Path(r"C:\Users\patri\Shalom\KB\Deep Research Gemini - Judaisme.pdf"),
        "Recherche",
        "Deep Research Gemini — Judaïsme",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\full-tanakh-without-versification.pdf"),
        "Tanakh",
        "Tanakh complet (hébreu, sans versification)",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\thetanakh.pdf"),
        "Tanakh",
        "The Tanakh",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\talmud.pdf"),
        "Talmud",
        "Talmud (traduction française complète)",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\Synthese NotebookLM.txt"),
        "Recherche",
        "Synthèse NotebookLM — Judaïsme",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\A lecoute de la Torah.pdf"),
        "Commentaire",
        "À l'écoute de la Thora",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\35391184.pdf"),
        "Commentaire",
        "Au Puits de la Paracha — Houkat",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\contes_des_temps_anciens.pdf"),
        "Hassidout",
        "Contes des Temps Anciens — Rabbi Nahman de Breslev",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\LaTerre_Israel_FIXED.pdf"),
        "Recherche",
        "La Terre d'Israël — Yehuda Moraly (Pardès n°46, 2009)",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\shevanetivotfr.pdf"),
        "Kabbale",
        "Sheva Netivot HaTorah — Abraham Aboulafia",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\PENSEE-JUIVE-Tome-1-fini.pdf"),
        "Pensée juive",
        "Manuel de Pensée Juive Tome 1 — Mikhaël Benadmon (ASKOLA)",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\maitriser-la-colere.pdf"),
        "Moussar",
        "Comment maîtriser la colère",
    ),
    # YouTube transcripts referenced in Deep Research Gemini PDF
    (
        Path(r"C:\Users\patri\Shalom\KB\transcripts\17_5y-82nFxlM0.txt"),
        "Vidéo",
        "The Jewish Roots of Our Faith [17]",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\transcripts\25_6LL6ZmCHs6E.txt"),
        "Vidéo",
        "What is the Genius and Story of the Jews? — Sacks, Schama, Gregory [25]",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\transcripts\49_HSQTfjowlxQ.txt"),
        "Vidéo",
        "Les FONDAMENTAUX du judaïsme — Le Talmud [49]",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\transcripts\50_39AMunPWZR8.txt"),
        "Vidéo",
        "Les FONDAMENTAUX du Judaïsme — La Littérature rabbinique [50]",
    ),
    (
        Path(r"C:\Users\patri\Shalom\KB\transcripts\52_YPy9ejyB5CY.txt"),
        "Vidéo",
        "Torah study through the Generations — Rabbi Jonathan Sacks [52]",
    ),
]

# Auto-discovered transcripts: any *.txt under KB/transcripts/<subdir>/
# Each file's header lines (Titre: …, Catégories: …) drive the metadata.
TRANSCRIPTS_DIRS: list[tuple[Path, str]] = [
    # (directory, default corpus label when categories tag absent)
    (Path(r"C:\Users\patri\Shalom\KB\transcripts\breslev"), "Cours Rav Ifrah"),
]


def _parse_transcript_header(path: Path) -> tuple[str | None, str | None]:
    """Read the first ~30 lines of a transcript .txt and return (title, categories)."""
    try:
        with path.open(encoding="utf-8", errors="replace") as f:
            head = [next(f, "") for _ in range(30)]
    except Exception:
        return None, None
    title = None
    cats = None
    for line in head:
        line = line.rstrip()
        if line.startswith("Titre: "):
            title = line[len("Titre: "):].strip()
        elif line.startswith("Catégories: "):
            cats = line[len("Catégories: "):].strip()
        if title and cats:
            break
    return title, cats


def discover_transcript_extras() -> list[tuple[Path, str, str]]:
    """Walk the configured transcripts dirs and build (path, corpus, livre) tuples."""
    out: list[tuple[Path, str, str]] = []
    for root, default_corpus in TRANSCRIPTS_DIRS:
        if not root.exists():
            continue
        for p in sorted(root.glob("*.txt")):
            title, cats = _parse_transcript_header(p)
            corpus = default_corpus
            if cats:
                # Map first matching category slug to a friendlier corpus
                lower = cats.lower()
                if "cours-rav-ifrah" in lower:
                    corpus = "Cours Rav Ifrah"
                elif "cours-du-jour" in lower:
                    corpus = "Cours du jour"
            livre = title or p.stem
            out.append((p, corpus, livre))
    return out


@dataclass
class Chunk:
    id: str
    corpus: str
    livre: str
    chapitre: str | None
    page: int | None
    source_path: str
    text: str


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def stable_id(*parts: str) -> str:
    h = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return h[:16]


def approx_tokens(s: str) -> int:
    # rough: 1 token ~= 4 chars (FR/EN); good enough for chunk sizing
    return max(1, len(s) // 4)


_PARA_BREAK = re.compile(r"\n\s*\n+")
_SENT_BREAK = re.compile(r"[.!?…][\s\n]+")


def split_into_chunks(text: str, target=CHUNK_TOKENS, overlap=OVERLAP_TOKENS) -> list[str]:
    """Paragraph-then-sentence-aware chunker. Keeps text within ~target*4 chars,
    preferring paragraph (\\n\\n) boundaries, then sentence punctuation, then
    falls back to character cuts. Adds 'overlap*4' chars of preceding context.
    """
    text = text.strip()
    if not text:
        return []
    target_chars = target * 4
    overlap_chars = overlap * 4
    if len(text) <= target_chars:
        return [re.sub(r"[ \t]+", " ", text).strip()]

    # First, split into paragraphs and group them into chunks.
    paragraphs = [p.strip() for p in _PARA_BREAK.split(text) if p.strip()]
    if len(paragraphs) <= 1:
        # No paragraph structure → fall back to fixed-size with sentence boundaries.
        return _split_flat(re.sub(r"\s+", " ", text), target_chars, overlap_chars)

    chunks: list[str] = []
    buf = ""
    for p in paragraphs:
        if len(p) > target_chars:
            # Single paragraph too big — flush buf, then sub-split this para.
            if buf:
                chunks.append(buf.strip())
                buf = ""
            chunks.extend(_split_flat(re.sub(r"\s+", " ", p), target_chars, overlap_chars))
            continue
        if not buf:
            buf = p
        elif len(buf) + 2 + len(p) <= target_chars:
            buf = f"{buf}\n\n{p}"
        else:
            chunks.append(buf.strip())
            # Carry the last `overlap_chars` of prior buf for context continuity.
            tail = buf[-overlap_chars:] if overlap_chars > 0 else ""
            buf = f"{tail}\n\n{p}" if tail else p
    if buf:
        chunks.append(buf.strip())
    return [c for c in chunks if c]


def _split_flat(text: str, target_chars: int, overlap_chars: int) -> list[str]:
    if len(text) <= target_chars:
        return [text]
    out: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + target_chars)
        if end < len(text):
            window = text[max(start, end - 240): end]
            m = list(_SENT_BREAK.finditer(window))
            if m:
                end = max(start, end - 240) + m[-1].end()
        out.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap_chars, start + 1)
    return [c for c in out if c]


def _all_extras() -> list[tuple[Path, str, str]]:
    """Union of explicit EXTRA_DOCS + auto-discovered transcripts."""
    return EXTRA_DOCS + discover_transcript_extras()


def parse_path(pdf: Path) -> tuple[str, str, str | None]:
    """Return (corpus, livre, chapitre) for a PDF under CORPUS_ROOT or in EXTRA_DOCS."""
    for extra_path, extra_corpus, extra_livre in _all_extras():
        if pdf.resolve() == extra_path.resolve():
            return extra_corpus, extra_livre, None
    rel = pdf.relative_to(CORPUS_ROOT)
    parts = rel.parts
    corpus_key = parts[0] if parts else "unknown"
    corpus = CORPUS_LABELS.get(corpus_key, corpus_key.title())
    livre = parts[1].replace("-", " ").title() if len(parts) > 1 else "?"
    chapitre = None
    if len(parts) > 2:
        stem = pdf.stem
        chapitre = stem.replace("-", " ")
    elif pdf.stem and pdf.stem != livre.lower().replace(" ", "-"):
        chapitre = pdf.stem.replace("-", " ")
    return corpus, livre, chapitre


def iter_pdfs(root: Path) -> Iterator[Path]:
    yield from sorted(root.rglob("*.pdf"))
    for extra_path, _, _ in _all_extras():
        if extra_path.exists():
            yield extra_path
        else:
            print(f"  ! extra doc missing: {extra_path}", file=sys.stderr)


def rel_for(pdf: Path) -> str:
    for extra_path, _, _ in _all_extras():
        if pdf.resolve() == extra_path.resolve():
            return f"extras/{pdf.name}".replace("\\", "/")
    return str(pdf.relative_to(CORPUS_ROOT)).replace("\\", "/")


def _chunks_from_pdf(pdf: Path, corpus: str, livre: str, chapitre, rel_path: str) -> list[Chunk]:
    try:
        reader = PdfReader(str(pdf))
    except Exception as e:  # noqa: BLE001
        print(f"  ! cannot read {pdf}: {e}", file=sys.stderr)
        return []
    out: list[Chunk] = []
    for page_idx, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:  # noqa: BLE001
            text = ""
        if not text.strip():
            continue
        for c_idx, chunk_text in enumerate(split_into_chunks(text)):
            out.append(
                Chunk(
                    id=stable_id(rel_path, str(page_idx), str(c_idx)),
                    corpus=corpus,
                    livre=livre,
                    chapitre=chapitre,
                    page=page_idx,
                    source_path=rel_path,
                    text=chunk_text,
                )
            )
    return out


def _chunks_from_text(doc: Path, corpus: str, livre: str, chapitre, rel_path: str) -> list[Chunk]:
    try:
        text = doc.read_text(encoding="utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001
        print(f"  ! cannot read {doc}: {e}", file=sys.stderr)
        return []
    out: list[Chunk] = []
    for c_idx, chunk_text in enumerate(split_into_chunks(text)):
        out.append(
            Chunk(
                id=stable_id(rel_path, "0", str(c_idx)),
                corpus=corpus,
                livre=livre,
                chapitre=chapitre,
                page=None,
                source_path=rel_path,
                text=chunk_text,
            )
        )
    return out


def extract_chunks(doc: Path) -> list[Chunk]:
    corpus, livre, chapitre = parse_path(doc)
    rel_path = rel_for(doc)
    suffix = doc.suffix.lower()
    if suffix == ".pdf":
        return _chunks_from_pdf(doc, corpus, livre, chapitre, rel_path)
    if suffix in (".txt", ".md"):
        return _chunks_from_text(doc, corpus, livre, chapitre, rel_path)
    print(f"  ! unsupported file type: {doc}", file=sys.stderr)
    return []


def build_arrow_schema() -> pa.Schema:
    return pa.schema(
        [
            pa.field("id", pa.string()),
            pa.field("corpus", pa.string()),
            pa.field("livre", pa.string()),
            pa.field("chapitre", pa.string()),
            pa.field("page", pa.int32()),
            pa.field("source_path", pa.string()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM)),
        ]
    )


def open_or_create_table(db: lancedb.DBConnection):
    schema = build_arrow_schema()
    if TABLE_NAME in db.table_names():
        return db.open_table(TABLE_NAME)
    return db.create_table(TABLE_NAME, schema=schema, mode="create")


def existing_ids(table) -> set[str]:
    """Return all IDs already present in the table. Fails loudly on errors —
    a silent empty-set return previously caused full re-indexing + duplicates.
    """
    if table.count_rows() == 0:
        return set()
    arrow_tbl = table.to_arrow()
    return set(arrow_tbl.column("id").to_pylist())


def batched(it: Iterable, n: int):
    batch: list = []
    for x in it:
        batch.append(x)
        if len(batch) == n:
            yield batch
            batch = []
    if batch:
        yield batch


def embed_documents(client: voyageai.Client, texts: list[str]) -> list[list[float]]:
    last: Exception | None = None
    for attempt in range(5):
        try:
            r = client.embed(texts, model=MODEL, input_type="document")
            return r.embeddings
        except Exception as e:  # noqa: BLE001
            last = e
            wait = 2 ** attempt
            print(f"  voyage retry in {wait}s ({e})", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"voyage failed after retries: {last}")


def main() -> int:
    if not CORPUS_ROOT.exists():
        print(f"Corpus not found: {CORPUS_ROOT}", file=sys.stderr)
        return 1
    if not os.environ.get("VOYAGE_API_KEY"):
        print("VOYAGE_API_KEY not set (.env.local)", file=sys.stderr)
        return 1

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(DB_PATH))
    table = open_or_create_table(db)
    seen = existing_ids(table)
    print(f"DB: {DB_PATH}  |  existing chunks: {len(seen):,}")

    voyage = voyageai.Client()
    pdfs = list(iter_pdfs(CORPUS_ROOT))
    print(f"PDFs to scan: {len(pdfs):,}")

    pending: list[Chunk] = []
    write_buf: list[dict] = []

    def flush_writes():
        nonlocal write_buf
        if not write_buf:
            return
        table.add(write_buf)
        write_buf = []

    pbar = tqdm(pdfs, desc="indexing", unit="pdf")
    for pdf in pbar:
        chunks = extract_chunks(pdf)
        chunks = [c for c in chunks if c.id not in seen]
        if not chunks:
            continue
        pending.extend(chunks)

        while len(pending) >= EMBED_BATCH:
            batch = pending[:EMBED_BATCH]
            pending = pending[EMBED_BATCH:]
            vecs = embed_documents(voyage, [c.text for c in batch])
            for c, v in zip(batch, vecs):
                row = asdict(c)
                row["chapitre"] = c.chapitre or ""
                row["vector"] = v
                write_buf.append(row)
                seen.add(c.id)
            if len(write_buf) >= WRITE_BATCH:
                flush_writes()
        pbar.set_postfix(buffered=len(pending), table=len(seen))

    while pending:
        batch = pending[:EMBED_BATCH]
        pending = pending[EMBED_BATCH:]
        vecs = embed_documents(voyage, [c.text for c in batch])
        for c, v in zip(batch, vecs):
            row = asdict(c)
            row["chapitre"] = c.chapitre or ""
            row["vector"] = v
            write_buf.append(row)
            seen.add(c.id)
    flush_writes()

    print("Creating vector index (IVF_PQ)…")
    try:
        table.create_index(
            metric="cosine",
            vector_column_name="vector",
            replace=True,
        )
    except Exception as e:  # noqa: BLE001
        print(f"  index creation skipped: {e}", file=sys.stderr)

    print(f"Done. Total chunks indexed: {len(seen):,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
