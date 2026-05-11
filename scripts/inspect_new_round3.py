import warnings
warnings.filterwarnings("ignore")
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(r"C:\Users\patri\Shalom\KB")
files = [
    "shevanetivotfr.pdf",
    "PENSEE-JUIVE-Tome-1-fini.pdf",
    "maitriser-la-colere.pdf",
]

for name in files:
    p = ROOT / name
    print(f"\n=== {name} ===")
    if not p.exists():
        print("  ! file not found")
        continue
    try:
        with open(p, "rb") as f:
            head = f.read(4)
        if head != b"%PDF":
            print(f"  ! invalid PDF header: {head!r} — attempt to strip leading whitespace")
            with open(p, "rb") as f:
                data = f.read()
            i = data.find(b"%PDF")
            if i > 0:
                fixed = p.with_name(p.stem + "_FIXED.pdf")
                fixed.write_bytes(data[i:])
                p = fixed
                print(f"  -> wrote fixed file: {fixed.name}")
            else:
                continue
        r = PdfReader(str(p))
        n = len(r.pages)
        meta = r.metadata or {}
        print(f"  pages: {n}")
        print(f"  title (meta): {meta.get('/Title', '')!s}")
        print(f"  author (meta): {meta.get('/Author', '')!s}")
        for idx in [0, n // 4, n // 2, 3 * n // 4, n - 1]:
            try:
                txt = r.pages[idx].extract_text() or ""
            except Exception as e:
                txt = f"<error: {e}>"
            snip = txt.replace("\n", " ").strip()[:200]
            print(f"  page {idx + 1}: {len(txt):>6} chars | {snip!r}")
    except Exception as e:
        print(f"  ! error: {e}")
