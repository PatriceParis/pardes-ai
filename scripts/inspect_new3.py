"""Quick inspection of the 3 new KB root PDFs."""
import warnings
warnings.filterwarnings("ignore")
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(r"C:\Users\patri\Shalom\KB")
files = [
    "35391184.pdf",
    "contes_des_temps_anciens.pdf",
    "LaTerredIsralmmeavecsesmaisonsetsesappartements.pdf",
]

for name in files:
    p = ROOT / name
    print(f"\n=== {name} ===")
    try:
        with open(p, "rb") as f:
            head = f.read(4)
        if head != b"%PDF":
            print(f"  ! not a real PDF (header={head!r})")
            continue
        r = PdfReader(str(p))
        n_pages = len(r.pages)
        # Try to read PDF metadata title/author
        meta = r.metadata or {}
        print(f"  pages: {n_pages}")
        print(f"  title (meta): {meta.get('/Title', '')!s}")
        print(f"  author (meta): {meta.get('/Author', '')!s}")
        # Sample first / mid / last pages
        for idx in [0, n_pages // 2, n_pages - 1]:
            try:
                txt = r.pages[idx].extract_text() or ""
            except Exception as e:
                txt = f"<error: {e}>"
            head_snip = txt.replace("\n", " ").strip()[:180]
            print(f"  page {idx + 1}: {len(txt):>6} chars  | {head_snip!r}")
    except Exception as e:
        print(f"  ! error: {e}")
