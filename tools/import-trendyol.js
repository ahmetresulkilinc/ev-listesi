// Trendyol → Ev Listesi aktarıcı (Ahmet'in PC'sinde çalışır; Türkiye IP gerekir).
//
// Kullanım:
//   node tools/import-trendyol.js "<trendyol-linki>" "<ev-anahtari>" [kategori] [--dry]
//
//   <trendyol-linki> : ty.gl kısa link, koleksiyon linki ya da tek ürün linki olabilir.
//   [kategori]       : acil | orta | sonra  (varsayılan: sonra)
//   --dry            : veritabanına yazmadan sadece ne bulacağını gösterir.
//
// Örnek:
//   node tools/import-trendyol.js "https://ty.gl/o30xpfqq6vc8r" "cemre-mavi-ev" sonra
//
// Notlar:
// - Aynı isimli ürünler (evde zaten olanlar) atlanır.
// - Koleksiyon sayfasında gömülü gelen ürünler aktarılır; Trendyol sayfalamayı
//   dışarı açmıyorsa koleksiyonun tamamı gelmeyebilir (kaç/kaç aktarıldığı yazılır).
'use strict';
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9', 'Accept': 'text/html,application/xhtml+xml,*/*' };

function conf() {
  const s = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  const url = (s.match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1];
  const key = (s.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/) || [])[1];
  if (!url || !key) { console.error('config.js içinde SUPABASE_URL / SUPABASE_ANON_KEY bulunamadı.'); process.exit(1); }
  return { url, key };
}
async function get(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  return { status: res.status, url: res.url, text: await res.text() };
}
function balancedArray(s, from) {
  const j = s.indexOf('[', from); if (j < 0) return null;
  let d = 0;
  for (let k = j; k < s.length; k++) {
    if (s[k] === '[') d++;
    else if (s[k] === ']') { d--; if (d === 0) return s.slice(j, k + 1); }
  }
  return null;
}
function decode(t) { return (t || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(); }
function cleanTitle(t) { return decode(t).replace(/\s*-\s*Fiyatı, Yorumları.*$/i, '').replace(/\s*\|\s*Trendyol.*$/i, '').trim(); }
function priceOf(p) {
  const cands = [p?.price?.discountedPrice?.value, p?.price?.sellingPrice?.value, p?.price?.originalPrice?.value, p?.favoritedPrice, p?.price];
  for (const c of cands) { const n = typeof c === 'string' ? Number(c.replace(/\./g, '').replace(',', '.')) : c; if (typeof n === 'number' && isFinite(n) && n > 0) return Math.round(n * 100) / 100; }
  return null;
}

async function parseProductPage(url) {
  const r = await get(url);
  if (r.status !== 200) { console.error(`Ürün sayfası açılamadı (${r.status}): ${url}`); return []; }
  const s = r.text;
  const g = (re) => { const m = s.match(re); return m ? m[1] : null; };
  const title = cleanTitle(g(/property="og:title"[^>]*content="([^"]+)"/i) || g(/content="([^"]+)"[^>]*property="og:title"/i) || g(/<title[^>]*>([^<]+)</i));
  const image = g(/property="og:image"[^>]*content="([^"]+)"/i) || g(/content="([^"]+)"[^>]*property="og:image"/i);
  let price = null;
  const pm = s.match(/"discountedPrice"\s*:\s*\{[^}]*"value"\s*:\s*([0-9.]+)/) || s.match(/"sellingPrice"\s*:\s*\{[^}]*"value"\s*:\s*([0-9.]+)/);
  if (pm) price = Number(pm[1]);
  if (!title) { console.error('Ürün adı bulunamadı: ' + r.url); return []; }
  return [{ name: title.slice(0, 80), image, price, link: r.url.split('?')[0] }];
}

async function parseCollection(firstHtml, firstUrl) {
  const out = new Map();
  let total = null;
  const collect = (html) => {
    const tm = html.match(/"totalCount"\s*:\s*(\d+)/); if (tm) total = Number(tm[1]);
    const i = html.indexOf('"products"'); if (i < 0) return 0;
    const arr = balancedArray(html, i); if (!arr) return 0;
    let list; try { list = JSON.parse(arr); } catch { return 0; }
    let added = 0;
    for (const p of list) {
      if (!p || !p.name || out.has(p.id)) continue;
      out.set(p.id, {
        name: decode(p.name).slice(0, 80),
        image: p.image || p.imageUrl || null,
        price: priceOf(p),
        link: p.url ? 'https://www.trendyol.com' + p.url.split('?')[0] : null,
      });
      added++;
    }
    return added;
  };
  collect(firstHtml);
  // sayfalama dene (Trendyol her zaman açmıyor; yeni ürün gelmezse dur)
  const base = firstUrl.split('#')[0];
  for (let pg = 2; pg <= 8; pg++) {
    if (total != null && out.size >= total) break;
    const u = base + (base.includes('?') ? '&' : '?') + 'page=' + pg;
    try { const r = await get(u); if (r.status !== 200 || collect(r.text) === 0) break; } catch { break; }
  }
  return { items: [...out.values()], total };
}

(async () => {
  const [, , inputUrl, houseKey, catArg, dryArg] = process.argv;
  const dry = process.argv.includes('--dry');
  const category = ['acil', 'orta', 'sonra'].includes(catArg) ? catArg : 'sonra';
  if (!inputUrl || (!houseKey && !dry)) {
    console.log('Kullanım: node tools/import-trendyol.js "<link>" "<ev-anahtari>" [acil|orta|sonra] [--dry]');
    process.exit(1);
  }
  const { url: SB, key: ANON } = conf();
  const sb = (p, opt = {}) => fetch(SB + '/rest/v1/' + p, { ...opt, headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'x-house-key': houseKey || '', 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(opt.headers || {}) } });

  console.log('Link açılıyor:', inputUrl);
  const first = await get(inputUrl);
  if (first.status !== 200) { console.error(`Sayfa açılamadı (HTTP ${first.status}). Linki tarayıcıda deneyip tam adresi ver.`); process.exit(1); }
  console.log('Çözülen adres:', first.url.split('?')[0]);

  let found;
  if (/-p-\d+/.test(first.url)) found = { items: await parseProductPage(first.url), total: 1 };
  else found = await parseCollection(first.text, first.url);

  if (!found.items.length) { console.error('Ürün bulunamadı. (Koleksiyon gizli olabilir ya da Trendyol sayfayı vermedi.)'); process.exit(1); }
  console.log(`Bulunan ürün: ${found.items.length}${found.total ? ' / koleksiyon toplamı ' + found.total : ''}`);
  found.items.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.name}${p.price ? ' — ' + p.price + ' TL' : ''}`));
  if (found.total && found.items.length < found.total) console.log(`⚠ Trendyol sayfalamayı vermedi: ${found.total - found.items.length} ürün eksik. Eksikleri ürün linkiyle tek tek ekleyebilirsin.`);
  if (dry) { console.log('(--dry: veritabanına yazılmadı)'); return; }

  // mevcutlarla kıyasla
  const exRes = await sb('items?select=name,sort_order');
  if (!exRes.ok) { console.error('Supabase okunamadı: HTTP ' + exRes.status); process.exit(1); }
  const existing = await exRes.json();
  const norm = (t) => t.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();
  const have = new Set(existing.map(e => norm(e.name)));
  let order = existing.reduce((m, e) => Math.max(m, e.sort_order || 0), 0) + 1;

  const rows = [];
  for (const p of found.items) {
    if (have.has(norm(p.name))) { console.log('  atlandı (zaten var):', p.name); continue; }
    rows.push({
      house_key: houseKey, name: p.name, category, status: 'bekliyor', planned: false,
      price: p.price, link: p.link, note: 'Trendyol favorisi', image: p.image, emoji: '🛍️',
      sort_order: order++, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) { console.log('Eklenecek yeni ürün yok (hepsi zaten listede).'); return; }
  const ins = await sb('items', { method: 'POST', body: JSON.stringify(rows) });
  if (!ins.ok) { console.error('Yazma hatası: HTTP ' + ins.status, await ins.text()); process.exit(1); }
  console.log(`✓ ${rows.length} ürün "${category}" sütununa eklendi. Site birkaç saniye içinde kendini tazeler (ya da yenile).`);
})();
