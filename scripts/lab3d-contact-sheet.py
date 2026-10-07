# Лист кадров: все кадры шагов задачи (…/<id>-s<N>.png) в одну картинку 4 в ряд с подписью шага.
# python scripts/lab3d-contact-sheet.py <папка с кадрами> <id> <выход.png>
import sys, glob, re
from PIL import Image, ImageDraw, ImageFont

src, tid, out = sys.argv[1:4]
files = sorted(glob.glob(f"{src}/{tid}-s*.png"), key=lambda f: int(re.search(r"-s(\d+)\.png$", f).group(1)))
end = f"{src}/{tid}-end.png"
if not files:
    print("нет кадров", tid); sys.exit(1)
W = 480
thumbs = []
for f in files + ([end] if glob.glob(end) else []):
    im = Image.open(f).convert("RGB")
    h = int(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    lab = "конец" if f.endswith("-end.png") else f"шаг {int(re.search(r'-s(\d+)', f).group(1)) + 1}"
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 20)
    except Exception:
        font = ImageFont.load_default()
    d.rectangle([0, 0, 110, 30], fill=(20, 30, 45))
    d.text((8, 3), lab, fill=(255, 255, 255), font=font)
    thumbs.append(im)
cols = 4
rows = (len(thumbs) + cols - 1) // cols
th = thumbs[0].height
sheet = Image.new("RGB", (cols * W + (cols + 1) * 6, rows * th + (rows + 1) * 6), (235, 239, 244))
for i, t in enumerate(thumbs):
    r, c = divmod(i, cols)
    sheet.paste(t, (6 + c * (W + 6), 6 + r * (th + 6)))
sheet.save(out, optimize=True)
print(out, len(thumbs), "кадров")
