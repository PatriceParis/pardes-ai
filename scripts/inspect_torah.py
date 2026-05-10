import warnings
warnings.filterwarnings("ignore")
from pypdf import PdfReader
p = r"C:\Users\patri\Shalom\KB\A lecoute de la Torah.pdf"
r = PdfReader(p)
n = len(r.pages)
print(f"pages: {n}")
for idx in [0, n // 4, n // 2, 3 * n // 4, n - 1]:
    try:
        t = r.pages[idx].extract_text() or ""
    except Exception as e:
        t = f"<error: {e}>"
    snip = t.replace("\n", " ").strip()[:140]
    print(f"  page {idx + 1}: {len(t):>6} chars  | {snip!r}")
