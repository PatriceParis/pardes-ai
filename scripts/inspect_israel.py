import warnings
warnings.filterwarnings("ignore")
from pypdf import PdfReader
p = r"C:\Users\patri\Shalom\KB\LaTerre_Israel_FIXED.pdf"
r = PdfReader(p)
n = len(r.pages)
meta = r.metadata or {}
print(f"pages: {n}")
print(f"title: {meta.get('/Title', '')!s}")
print(f"author: {meta.get('/Author', '')!s}")
for idx in [0, n // 2, n - 1]:
    try:
        t = r.pages[idx].extract_text() or ""
    except Exception as e:
        t = f"<error: {e}>"
    snip = t.replace("\n", " ").strip()[:160]
    print(f"  page {idx + 1}: {len(t):>6} chars | {snip!r}")
