// アプリアイコン（PNG）を生成する。実行: node dev/make_icons.mjs
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'app', 'icons');

function make(size, file, { bg = [79, 70, 229], fg = [255, 255, 255], accent = [199, 210, 254], teacher = false } = {}) {
  const png = new PNG({ width: size, height: size });
  const r = size * 0.22; // 角丸
  const inRounded = (x, y, x0, y0, x1, y1, rad) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + rad), x1 - rad);
    const cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  };
  // 吹き出し本体
  const bx0 = size * 0.18, by0 = size * 0.22, bx1 = size * 0.82, by1 = size * 0.66, br = size * 0.10;
  // 吹き出しのしっぽ（三角形）
  const tail = (x, y) => {
    const tx = size * 0.30, ty0 = by1 - 2, ty1 = size * 0.80, w = size * 0.16;
    if (y < ty0 || y > ty1) return false;
    const t = (y - ty0) / (ty1 - ty0);
    return x >= tx && x <= tx + w * (1 - t);
  };
  // 中の線（本文っぽく）
  const lines = [
    [size * 0.28, size * 0.33, size * 0.72],
    [size * 0.28, size * 0.44, size * 0.62],
    [size * 0.28, size * 0.55, size * 0.50],
  ];
  const lh = size * 0.06;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let c = [0, 0, 0, 0];
      if (inRounded(x + 0.5, y + 0.5, 0, 0, size, size, r)) {
        c = [...bg, 255];
        if (inRounded(x + 0.5, y + 0.5, bx0, by0, bx1, by1, br) || tail(x, y)) c = [...fg, 255];
        for (const [lx, ly, lw] of lines) {
          if (inRounded(x + 0.5, y + 0.5, lx, ly, lw, ly + lh, lh / 2)) c = [...(teacher ? bg : accent), 255];
        }
      }
      png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3];
    }
  }
  writeFileSync(path.join(out, file), PNG.sync.write(png));
  console.log('wrote', file);
}

make(192, 'icon-192.png');
make(512, 'icon-512.png');
make(180, 'apple-touch-icon.png');
make(192, 'teacher-192.png', { bg: [15, 118, 110], teacher: true });
make(512, 'teacher-512.png', { bg: [15, 118, 110], teacher: true });
make(180, 'teacher-apple-touch-icon.png', { bg: [15, 118, 110], teacher: true });
