// Pixel sprite JSON -> PNG (bağımlılık yok).
// Kullanım: node tools/render-sprite.js <sprite.json> <out.png> [scale=8] [bg=#ffeef3|none]
// sprite.json: { "name": "...", "palette": { "k": "#3b2a3a", "p": "#ff9fb8", ... }, "frames": [ ["....", "...."], ["....", "...."] ] }
//  - her frame eşit boy satır dizisidir, '.' şeffaf; frame'ler yan yana (4px boşlukla) çizilir.
const fs = require('fs');
const zlib = require('zlib');

const [,, inPath, outPath, scaleArg, bgArg] = process.argv;
if (!inPath || !outPath) { console.error('kullanım: node tools/render-sprite.js sprite.json out.png [scale] [bg]'); process.exit(1); }
const scale = Math.max(1, parseInt(scaleArg || '8', 10));
const bg = (bgArg === undefined ? '#ffeef3' : bgArg);
const sprite = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const frames = sprite.frames || [sprite.rows];
const palette = sprite.palette || {};
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };

// doğrulama
frames.forEach((f, i) => {
  const w = f[0].length;
  f.forEach((row, y) => { if (row.length !== w) throw new Error(`frame ${i} satır ${y}: genişlik ${row.length} != ${w}`); [...row].forEach(ch => { if (ch !== '.' && !palette[ch]) throw new Error(`frame ${i} satır ${y}: palette'te olmayan karakter '${ch}'`); }); });
});
const fw = frames[0][0].length, fh = frames[0].length;
const gap = 4;
const W = (fw * frames.length + gap * (frames.length - 1)) * scale + 2 * scale * 2;
const H = fh * scale + 2 * scale * 2;
const buf = Buffer.alloc(W * H * 4);
if (bg !== 'none') { const b = hex(bg); for (let i = 0; i < W * H; i++) { buf[i * 4] = b[0]; buf[i * 4 + 1] = b[1]; buf[i * 4 + 2] = b[2]; buf[i * 4 + 3] = 255; } }
const put = (px, py, c) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const i = (py * W + px) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
frames.forEach((f, fi) => {
  const ox = 2 * scale + fi * (fw + gap) * scale, oy = 2 * scale;
  f.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return; const c = hex(palette[ch]);
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put(ox + x * scale + dx, oy + y * scale + dy, c);
  }));
});

function crc32(b) { let c, crc = 0xffffffff; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(outPath, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log(`yazıldı: ${outPath} (${W}x${H}, ${frames.length} frame, ${fw}x${fh})`);
