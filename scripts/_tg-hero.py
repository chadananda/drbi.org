# One-off: build a text-free wide hero from Taj's Thanksgiving flyer (felt grid bg + food/leaf cutouts).
from PIL import Image, ImageFilter, ImageDraw, ImageChops
import numpy as np, random
src = Image.open('tmp/tg-flyer/flyer.jpg').convert('RGB')
A = np.asarray(src).astype(int)
W, H = 2400, 900
rng = np.random.default_rng(7)

# felt background: yellow + fine noise + soft mottling
base = np.array([250, 216, 88], float)
noise = rng.normal(0, 5, (H, W, 1)) * np.array([0.6, 0.8, 3.0])
mott = np.asarray(Image.fromarray((rng.random((H // 40, W // 40)) * 255).astype('uint8')).resize((W, H), Image.BICUBIC)).astype(float)[..., None] / 255 - 0.5
bg = np.clip(base + noise + mott * np.array([6, 8, 18]), 0, 255).astype('uint8')
bgi = Image.fromarray(bg)

# stitched grid: soft light channel + dashed white stitch, ~165px period with slight jitter
d = ImageDraw.Draw(bgi, 'RGBA')
def lines(n, span, period, off):
    out, p = [], off
    while p < span: out.append(p + rng.integers(-4, 5)); p += period + rng.integers(-4, 5)
    return out
xs, ys = lines(0, W, 164, 40), lines(0, H, 164, 70)
for x in xs:
    d.rectangle([x - 6, 0, x + 6, H], fill=(255, 238, 170, 90))
    for y in range(0, H, 22): d.line([x, y, x, y + 12], fill=(255, 252, 240, 235), width=5)
for y in ys:
    d.rectangle([0, y - 6, W, y + 6], fill=(255, 238, 170, 90))
    for x in range(0, W, 22): d.line([x, y, x + 12, y], fill=(255, 252, 240, 235), width=5)
bgi = bgi.filter(ImageFilter.GaussianBlur(0.8))

# background = yellow felt, or white stitching lying on the flyer's (hand-drawn) grid lines
_r, _g, _b = A[..., 0], A[..., 1], A[..., 2]
_yellow = (_r > 215) & (_g > 170) & (_g < 240) & (_b < 165) & ((_r - _g) > 8) & ((_r - _g) < 60)
_yy, _xx = np.mgrid[0:A.shape[0], 0:A.shape[1]]
_near = np.zeros(A.shape[:2], bool)
for c in [67, 228, 389, 545, 700, 860, 1020, 1180, 1340, 1500, 1660, 1820]: _near |= abs(_xx - c) < 14
for r in [26, 190, 358, 527, 689, 860, 1023, 1185, 1355, 1521, 1682, 1852, 2015, 2180, 2351]: _near |= abs(_yy - r) < 14
FOOD = ~(_yellow | ((A.min(2) > 190) & _near))

def cutout(box, seeds=None, block=(), solid_white=False):
    reg = A[box[1]:box[3], box[0]:box[2]]
    fm = (~_yellow if solid_white else FOOD)[box[1]:box[3], box[0]:box[2]].copy()
    rr = reg[..., 0]; gg = reg[..., 1]
    if solid_white: fm[(np.arange(fm.shape[0])[:, None] + box[1] > 1018) & (gg > rr)] = False  # "& Auction" letter tops
    m = Image.fromarray((fm * 255).astype('uint8'))
    k = 13 if solid_white else 9  # opening: drops stitch dashes (thin), keeps bones/potatoes (thick)
    m = m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))   # closing: seals felt speckle
    # fill holes: flood the outside from the border, everything not reached is inside
    w, h = m.size
    pad = Image.new('L', (w + 2, h + 2), 0); pad.paste(m, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    filled = pad.crop((1, 1, w + 1, h + 1)).point(lambda v: 0 if v == 128 else 255)
    if seeds:  # keep only the components connected to the seed points (drops badges/lettering)
        dd = ImageDraw.Draw(filled)
        for bx in block: dd.rectangle([bx[0]-box[0], bx[1]-box[1], bx[2]-box[0], bx[3]-box[1]], fill=0)
        for sx, sy in seeds:
            pt = (sx - box[0], sy - box[1])
            if filled.getpixel(pt) == 255: ImageDraw.floodfill(filled, pt, 128)
            else: print('seed off-mask', sx, sy)
        filled = filled.point(lambda v: 255 if v == 128 else 0)
    # keep only the biggest blob-ish region: drop tiny specks
    filled = filled.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    return src.crop(box), filled.filter(ImageFilter.GaussianBlur(2.5))

def place(img, mask, xy, scale=1.0, shadow=True):
    if scale != 1.0:
        sz = (int(img.width * scale), int(img.height * scale)); img, mask = img.resize(sz, Image.LANCZOS), mask.resize(sz, Image.LANCZOS)
    if shadow:
        sh = Image.new('RGB', img.size, (150, 100, 20))
        bgi.paste(sh, (xy[0] + 6, xy[1] + 12), mask.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.35)))
    bgi.paste(img, xy, mask)

food, fm = cutout((330, 618, 1585, 1040), seeds=[(955, 1010)], solid_white=True, block=[(330, 618, 545, 848), (1478, 618, 1585, 838), (330, 618, 1585, 628)])
mx, my = (W - food.width) // 2, 95
place(food, fm, (mx, my), shadow=False)
maple, mm = cutout((35, 935, 335, 1240), seeds=[(180, 1085)])
place(maple, mm, (170, 230), 1.0)
oak, om = cutout((1600, 1860, 1890, 2190), seeds=[(1745, 2020)])
place(oak, om, (1980, 170), 0.95)
leaf, lm = cutout((30, 1790, 290, 2110), seeds=[(160, 1950)])
place(leaf, lm, (2130, 520), 0.8)
bgi.save('tmp/tg-flyer/hero.jpg', quality=90)
fm.save('tmp/tg-flyer/foodmask.png')
