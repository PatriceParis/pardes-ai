"""Diagnose why the indexer produced only 1.17 chunks/PDF."""
from pathlib import Path
from pypdf import PdfReader
import warnings
warnings.filterwarnings("ignore")

root = Path(r"C:\Users\patri\Shalom\KB\torah_pdfs\files")
pdfs = list(root.rglob("*.pdf"))
print(f"total PDFs: {len(pdfs)}")

broken_html = 0
empty_text = 0
ok = 0
errors = 0
total_chars = 0
sample_ok = []
sample_empty = []
sample_html = []

SAMPLE = 800

for p in pdfs[:SAMPLE]:
    try:
        with open(p, "rb") as f:
            head = f.read(4)
        if head[:1] == b"<" or head != b"%PDF":
            broken_html += 1
            if len(sample_html) < 3:
                sample_html.append(str(p.relative_to(root)))
            continue
        r = PdfReader(str(p))
        total = sum(len((pg.extract_text() or "")) for pg in r.pages)
        total_chars += total
        if total < 50:
            empty_text += 1
            if len(sample_empty) < 3:
                sample_empty.append(
                    (str(p.relative_to(root)), len(r.pages), total)
                )
        else:
            ok += 1
            if len(sample_ok) < 3:
                sample_ok.append(
                    (str(p.relative_to(root)), len(r.pages), total)
                )
    except Exception:
        errors += 1

print(f"sampled: {SAMPLE}")
print(f"  broken/html      : {broken_html}")
print(f"  empty_text(<50ch): {empty_text}")
print(f"  read errors      : {errors}")
print(f"  ok               : {ok}")
print(f"  avg chars/ok PDF : {total_chars / max(ok,1):.0f}")
print()
print("sample OK:")
for s in sample_ok:
    print(" ", s)
print("sample EMPTY:")
for s in sample_empty:
    print(" ", s)
print("sample HTML:")
for s in sample_html:
    print(" ", s)
