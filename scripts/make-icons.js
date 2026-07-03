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
      }
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

const outDir = path.join(__dirname, '..', 'web-assets');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [512, 180]) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`wrote ${file}`);
}
