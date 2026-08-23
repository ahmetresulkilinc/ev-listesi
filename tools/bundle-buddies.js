// buddies/*.json -> buddies-data.js (window.EV_BUDDIES). Kullanım: node tools/bundle-buddies.js [id1,id2,...]
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'buddies');
const order = (process.argv[2] || 'ayi,hayalet,flork,top,kedi,tavsan').split(',').map(s => s.trim()).filter(Boolean);
const out = [];
for (const id of order) {
  const p = path.join(dir, id + '.json');
  if (!fs.existsSync(p)) { console.warn('atlandı (yok):', id); continue; }
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const frames = s.frames || [s.rows];
  const w = frames[0][0].length, h = frames[0].length;
  frames.forEach((f, i) => { if (f.length !== h) throw new Error(`${id}: frame ${i} yükseklik farklı`); f.forEach((r, y) => { if (r.length !== w) throw new Error(`${id}: frame ${i} satır ${y} genişlik farklı`); for (const ch of r) if (ch !== '.' && !s.palette[ch]) throw new Error(`${id}: palette'te yok '${ch}'`); }); });
  out.push({ id, name: s.name || id, palette: s.palette, frames });
  console.log(`✓ ${id} ${w}x${h} ${frames.length} frame`);
}
const js = '// Otomatik üretildi: node tools/bundle-buddies.js\nwindow.EV_BUDDIES = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'buddies-data.js'), js);
console.log('yazıldı: buddies-data.js (' + out.length + ' karakter)');
