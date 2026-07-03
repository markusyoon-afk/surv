// Generates the SURV owl app icons as PNGs with zero dependencies
// (raw pixel buffer + hand-rolled PNG encoder). Outputs to web-assets/.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- drawing ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function makeCanvas(size, bg) {
  const buf = Buffer.alloc(size * size * 4);
  const [r, g, b] = hex(bg);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

function fillCircle(buf, size, cx, cy, radius, color) {
  const [r, g, b] = hex(color);
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (y * size + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }
  }
}

function fillTriangle(buf, size, p1, p2, p3, color) {
  const [r, g, b] = hex(color);
  const sign = (a, bb, c) => (a[0] - c[0]) * (bb[1] - c[1]) - (bb[0] - c[0]) * (a[1] - c[1]);
  const x0 = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])));
  const x1 = Math.min(size - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])));
  const y0 = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])));
  const y1 = Math.min(size - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = [x, y];
      const d1 = sign(p, p1, p2);
      const d2 = sign(p, p2, p3);
      const d3 = sign(p, p3, p1);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) {
        const i = (y * size + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }
  }
}

function makeTransparentCanvas(size) {
  return Buffer.alloc(size * size * 4); // all zeros = fully transparent
}

function fillRect(buf, size, x, y, w, h, color) {
  const [r, g, b] = hex(color);
  const x1 = Math.min(size - 1, Math.ceil(x + w));
  const y1 = Math.min(size - 1, Math.ceil(y + h));
  for (let yy = Math.max(0, Math.floor(y)); yy <= y1; yy++) {
    for (let xx = Math.max(0, Math.floor(x)); xx <= x1; xx++) {
      const i = (yy * size + xx) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NIGHT = '#1d4166';
const OWL = '#45b08c';
const OWL_DEEP = '#2c8a6d';
const CREAM = '#eef2f3';
const INK = '#26343f';
const BEAK = '#f2a33c';
const MOON = '#f4eec4';
const STAR = '#c7d6e6';

function drawIcon(size) {
  const s = size / 512;
  const buf = makeCanvas(size, NIGHT);

  // stars
  const rand = mulberry32(2011);
  for (let i = 0; i < 34; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.55;
    fillCircle(buf, size, x, y, Math.max(1, (1 + rand() * 2) * s), STAR);
  }

  // crescent moon (cutout with background circle)
  fillCircle(buf, size, 402 * s, 104 * s, 44 * s, MOON);
  fillCircle(buf, size, 420 * s, 88 * s, 42 * s, NIGHT);

  // ear tufts
  fillTriangle(buf, size, [148 * s, 205 * s], [186 * s, 158 * s], [208 * s, 222 * s], OWL);
  fillTriangle(buf, size, [364 * s, 205 * s], [326 * s, 158 * s], [304 * s, 222 * s], OWL);

  // body + belly
  fillCircle(buf, size, 256 * s, 318 * s, 152 * s, OWL);
  fillCircle(buf, size, 256 * s, 402 * s, 92 * s, OWL_DEEP);

  // eyes
  fillCircle(buf, size, 198 * s, 274 * s, 58 * s, CREAM);
  fillCircle(buf, size, 314 * s, 274 * s, 58 * s, CREAM);
  fillCircle(buf, size, 198 * s, 274 * s, 26 * s, INK);
  fillCircle(buf, size, 314 * s, 274 * s, 26 * s, INK);

  // beak
  fillTriangle(buf, size, [256 * s, 306 * s], [232 * s, 344 * s], [280 * s, 344 * s], BEAK);

  return encodePng(size, size, buf);
}

// ---------- SAGEmeter avatar evolution (128px, transparent, circular) ----------
// 1 Hatchling → 2 Owl → 3 Sage (cap) → 4 Masked Sage → 5 Super Sage (mask + cape)

const GOLD = '#f2c14e';
const CAPE = '#c0392b';
const MASK = '#0f5e63';

function drawAvatar(stage) {
  const S = 128;
  const buf = makeTransparentCanvas(S);

  // backdrop disc (gold ring at max stage)
  if (stage >= 5) {
    fillCircle(buf, S, 64, 64, 62, GOLD);
    fillCircle(buf, S, 64, 64, 57, NIGHT);
  } else {
    fillCircle(buf, S, 64, 64, 60, NIGHT);
  }

  // cape flares out behind the body
  if (stage >= 5) {
    fillTriangle(buf, S, [38, 56], [64, 64], [22, 116], CAPE);
    fillTriangle(buf, S, [90, 56], [64, 64], [106, 116], CAPE);
    fillTriangle(buf, S, [38, 56], [90, 56], [64, 122], CAPE);
  }

  if (stage === 1) {
    // The beginning: an owl egg, baby owl just hatching out.
    fillCircle(buf, S, 64, 46, 21, '#7cccae'); // baby head peeking
    fillCircle(buf, S, 55, 44, 9, CREAM);
    fillCircle(buf, S, 73, 44, 9, CREAM);
    fillCircle(buf, S, 55, 44, 4, INK);
    fillCircle(buf, S, 73, 44, 4, INK);
    fillTriangle(buf, S, [64, 52], [59, 60], [69, 60], BEAK);
    // egg shell holds the body; jagged crack rim across the middle
    fillCircle(buf, S, 64, 94, 30, CREAM);
    fillCircle(buf, S, 64, 82, 25, CREAM);
    for (const x of [42, 55, 68, 81]) {
      fillTriangle(buf, S, [x, 76], [x + 12, 76], [x + 6, 62], CREAM);
    }
    return encodePng(S, S, buf);
  }

  const body = OWL;
  const bodyR = 38;
  const bodyY = 78;

  // ear tufts
  fillTriangle(buf, S, [34, 56], [46, 40], [52, 60], body);
  fillTriangle(buf, S, [94, 56], [82, 40], [76, 60], body);

  fillCircle(buf, S, 64, bodyY, bodyR, body);
  fillCircle(buf, S, 64, bodyY + 22, bodyR * 0.55, OWL_DEEP);

  // eyes (drawn over mask when masked)
  if (stage >= 4) {
    fillRect(buf, S, 28, 56, 72, 22, MASK);
    fillTriangle(buf, S, [28, 56], [40, 56], [22, 44], MASK);
    fillTriangle(buf, S, [100, 56], [88, 56], [106, 44], MASK);
    fillCircle(buf, S, 48, 67, 10, CREAM);
    fillCircle(buf, S, 80, 67, 10, CREAM);
    fillCircle(buf, S, 48, 67, 5, INK);
    fillCircle(buf, S, 80, 67, 5, INK);
  } else {
    fillCircle(buf, S, 48, 68, 14, CREAM);
    fillCircle(buf, S, 80, 68, 14, CREAM);
    fillCircle(buf, S, 48, 68, 6, INK);
    fillCircle(buf, S, 80, 68, 6, INK);
  }

  // beak
  fillTriangle(buf, S, [64, 82], [56, 94], [72, 94], BEAK);

  // graduation cap + scroll for the Sage
  if (stage === 3) {
    fillTriangle(buf, S, [64, 24], [98, 40], [64, 54], INK);
    fillTriangle(buf, S, [64, 24], [30, 40], [64, 54], INK);
    fillRect(buf, S, 90, 40, 3, 16, GOLD);
    fillCircle(buf, S, 92, 58, 4, GOLD);
    // the scroll of wisdom, tucked under a wing
    fillCircle(buf, S, 96, 88, 6, '#d8c294');
    fillCircle(buf, S, 96, 106, 6, '#d8c294');
    fillRect(buf, S, 90, 88, 12, 18, '#e8d9b0');
    fillRect(buf, S, 90, 95, 12, 4, GOLD);
  }

  // super emblem
  if (stage >= 5) fillCircle(buf, S, 64, 96, 8, GOLD);

  return encodePng(S, S, buf);
}

const outDir = path.join(__dirname, '..', 'web-assets');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [512, 180]) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`wrote ${file}`);
}

// ---------- brand tab icons (96px, transparent) ----------

function drawTreeIcon() {
  const S = 96;
  const buf = makeTransparentCanvas(S);
  // trunk
  fillRect(buf, S, 42, 52, 12, 34, '#8a6b4a');
  fillTriangle(buf, S, [42, 60], [30, 84], [42, 84], '#8a6b4a');
  // layered foliage
  fillCircle(buf, S, 30, 44, 20, OWL_DEEP);
  fillCircle(buf, S, 66, 44, 20, OWL_DEEP);
  fillCircle(buf, S, 48, 28, 24, OWL);
  fillCircle(buf, S, 48, 48, 26, OWL);
  return encodePng(S, S, buf);
}

function drawNestIcon() {
  const S = 96;
  const buf = makeTransparentCanvas(S);
  // eggs peeking over the rim
  fillCircle(buf, S, 36, 42, 13, CREAM);
  fillCircle(buf, S, 60, 42, 13, CREAM);
  fillCircle(buf, S, 48, 36, 13, '#f4e8d0');
  // woven bowl: brown disc with the top carved open
  fillCircle(buf, S, 48, 62, 34, '#8a6b4a');
  for (let y = 0; y < 46; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - 48;
      const dy = y - 62;
      if (dx * dx + dy * dy <= 34 * 34 && y < 48 && !(Math.hypot(x - 36, y - 42) <= 13 || Math.hypot(x - 60, y - 42) <= 13 || Math.hypot(x - 48, y - 36) <= 13)) {
        const i = (y * S + x) * 4;
        buf[i + 3] = 0;
      }
    }
  }
  // straw rim + twig ticks
  fillRect(buf, S, 16, 48, 64, 7, '#d8b98a');
  fillTriangle(buf, S, [12, 52], [26, 44], [26, 54], '#b08d64');
  fillTriangle(buf, S, [84, 52], [70, 44], [70, 54], '#b08d64');
  return encodePng(S, S, buf);
}

const iconDir = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(iconDir, { recursive: true });
fs.writeFileSync(path.join(iconDir, 'tree.png'), drawTreeIcon());
fs.writeFileSync(path.join(iconDir, 'nest.png'), drawNestIcon());
console.log('wrote tab icons: tree.png, nest.png');

const avatarDir = path.join(__dirname, '..', 'assets', 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });
for (let stage = 1; stage <= 5; stage++) {
  const file = path.join(avatarDir, `stage${stage}.png`);
  fs.writeFileSync(file, drawAvatar(stage));
  console.log(`wrote ${file}`);
}
