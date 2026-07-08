from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SETS = {
    "ai_logs": ROOT / "tmp" / "pdfs" / "ai_logs",
    "app_screens": ROOT / "tmp" / "pdfs" / "app_screens",
}
OUT = ROOT / "tmp" / "pdfs"

font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15)

for name, folder in SETS.items():
    files = sorted(folder.rglob("*.png"))
    thumb_w, thumb_h = 520, 300
    canvas = Image.new("RGB", (1100, ((len(files) + 1) // 2) * 360 + 60), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 16), name.replace("_", " ").title(), fill="#172554", font=font)
    for i, path in enumerate(files):
        x = 24 + (i % 2) * 540
        y = 58 + (i // 2) * 360
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_w, thumb_h))
        canvas.paste(image, (x + (thumb_w - image.width) // 2, y))
        draw.text((x, y + 308), path.name[:62], fill="#111827", font=small)
        draw.text((x, y + 330), f"{Image.open(path).size[0]} x {Image.open(path).size[1]}", fill="#64748b", font=small)
    canvas.save(OUT / f"{name}_contact_sheet.png", quality=92)
