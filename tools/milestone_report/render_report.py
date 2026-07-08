from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "output" / "pdf" / "AI_StudyHub_Milestone_02_Report.pdf"
OUT = ROOT / "tmp" / "pdfs" / "rendered"
OUT.mkdir(parents=True, exist_ok=True)

doc = pdfium.PdfDocument(str(PDF))
thumbs = []
for i in range(len(doc)):
    page = doc[i]
    bitmap = page.render(scale=1.25)
    path = OUT / f"page-{i+1:02d}.png"
    bitmap.to_pil().save(path)
    image = Image.open(path).convert("RGB")
    image.thumbnail((280, 396))
    thumbs.append(image.copy())

cols = 4
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 300, rows * 430 + 50), "white")
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15)
for i, image in enumerate(thumbs):
    x = (i % cols) * 300 + 10
    y = (i // cols) * 430 + 10
    sheet.paste(image, (x, y))
    draw.text((x, y + 400), f"Page {i+1}", fill="#111827", font=font)
sheet.save(ROOT / "tmp" / "pdfs" / "milestone_report_contact_sheet.jpg", quality=90)
print(f"pages={len(doc)}")
