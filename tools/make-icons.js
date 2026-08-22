// Pixel ev ikonlarını PNG olarak üretir (bağımlılık yok: node + zlib).
// Kullanım: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HOUSE = [
  '...........CC...',
  '.......RR..CC...',
  '......RRRR.CC...',
  '.....RRRRRRCC...',
  '....RRRRRRRRRR..',
  '...RRRRRRRRRRRR.',
  '..RRRRRRRRRRRRRR',
  '...WWWWWWWWWWWW.',
  '...WwwWWWWWWwwW.',
  '...WwwWWWWWWwwW.',
  '...WWWWWDDWWWWW.',
  '...WWWWWDDWWWWW.',
  '...WWWWWDkWWWWW.',
  '...WWWWWDDWWWWW.',
  'GGGGGGGGGGGGGGGG',
];
const COL = {
  R: [255, 122, 154], C: [181, 90, 106], W: [255, 243, 220], w: [255, 217, 92],
  D: [201, 129, 78], k: [255, 241, 191], G: [127, 224, 178],
};
const BG = [255, 238, 243];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function draw(size, padCells) {
  // 16 sütun x 15 satır + kenar boşluğu
  const cols = 16 + padCells * 2, rows = 15 + padCells * 2;
  const cell = Math.floor(size / Math.max(cols, rows));
  const offX = Math.floor((size - cols * cell) / 2), offY = Math.floor((size - rows * cell) / 2);
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { buf[i * 4] = BG[0]; buf[i * 4 + 1] = BG[1]; buf[i * 4 + 2] = BG[2]; buf[i * 4 + 3] = 255; }
  const put = (gx, gy, c) => {
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const px = offX + gx * cell + x, py = offY + gy * cell + y;
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      const i = (py * size + px) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    }
  };
  // yeşil zemin satırını ikonun en altına kadar uzat
  for (let gy = 14 + padCells; gy < rows + 2; gy++) for (let gx = -2; gx < cols + 2; gx++) put(gx, gy, COL.G);
  HOUSE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') put(x + padCells, y + padCells, COL[ch]); }));
  return png(size, size, buf);
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192, 1));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512, 1));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), draw(512, 3));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), draw(180, 1));
console.log('icons yazıldı →', out);
