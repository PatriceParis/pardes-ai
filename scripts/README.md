# Indexing the Torah corpus

One-time job that builds the LanceDB vector store consumed by the Next.js app.

## Setup

```powershell
cd C:\Users\patri\Shalom\app\scripts
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `app\.env.local` and fill `VOYAGE_API_KEY`.

## Run

```powershell
cd C:\Users\patri\Shalom\app
python scripts\index.py
```

The script is **resumable** — re-running skips chunks already in the table. If
it crashes (network, API rate limit), just run it again.

### What it does

1. Walks `KB\torah_pdfs\files\{torah,neviim,ketouvim,talmud}\**\*.pdf` (6 372 PDFs).
2. Extracts text page by page (`pypdf`).
3. Chunks at ~800 tokens with 100-token overlap, breaking on sentence boundaries.
4. Embeds in batches of 64 via Voyage `voyage-3.5` (1024-dim, cosine metric).
5. Writes to LanceDB at `app\data\pardes.lance` with schema
   `(id, corpus, livre, chapitre, page, source_path, text, vector)`.
6. Builds an IVF_PQ index for fast ANN search at the end.

### Cost & time

- Voyage `voyage-3.5` is ~$0.06 / 1M input tokens. Expect $20–60 for the full
  corpus depending on text density.
- Wall time: 4–12 h on a typical laptop, mostly bound by Voyage API throughput.
- The progress bar shows PDFs processed and total chunks written.

### Override paths

```powershell
$env:CORPUS_ROOT = "D:\some\other\folder"
$env:LANCEDB_PATH = ".\data\custom.lance"
python scripts\index.py
```
