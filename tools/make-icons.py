"""生成 PWA 图标：橙色圆角方块 + 白色雪花。"""
from PIL import Image, ImageDraw
import math, os

OUT = r"E:\deepseek\fridge-pair\icons"
os.makedirs(OUT, exist_ok=True)


def rounded(size, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * radius_ratio)
    # 竖向渐变：珊瑚 -> 粉
    for y in range(size):
        t = y / max(1, size - 1)
        c = (
            int(255 - 12 * t),
            int(140 - 55 * t),
            int(80 - 10 * t),
            255,
        )
        d.rounded_rectangle([0, y, size, y], radius=0, fill=c)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    img.putalpha(mask)
    return img


def snowflake(draw, cx, cy, R, w, color=(255, 255, 255, 255)):
    for k in range(6):
        a = math.radians(k * 60 - 90)
        x2 = cx + math.cos(a) * R
        y2 = cy + math.sin(a) * R
        draw.line([cx, cy, x2, y2], fill=color, width=w)
        # 分叉
        for s in (-1, 1):
            b = a + s * math.radians(38)
            bl = R * 0.42
            bx = cx + math.cos(a) * R * 0.62
            by = cy + math.sin(a) * R * 0.62
            draw.line([bx, by, bx + math.cos(b) * bl, by + math.sin(b) * bl], fill=color, width=w)


for size in (192, 512):
    img = rounded(size)
    d = ImageDraw.Draw(img)
    snowflake(d, size / 2, size / 2, size * 0.30, max(4, size // 42))
    img.save(os.path.join(OUT, f"icon-{size}.png"))
    print("wrote", f"icon-{size}.png")
