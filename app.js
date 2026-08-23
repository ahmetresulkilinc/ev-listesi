/* Cemre'nin Evi — uygulama mantığı
   Demo mod (localStorage) veya Bulut mod (Supabase + "ev anahtarı").
*/
(() => {
  'use strict';

  // ---------------------------------------------------------------- yardımcılar
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const COLS = [
    { key: 'acil',   icon: '🔥', name: 'Acil',   hint: 'ilk maaşla' },
    { key: 'orta',   icon: '⭐', name: 'Orta',   hint: 'sonraki aylar' },
    { key: 'sonra',  icon: '🌙', name: 'Sonra',  hint: 'acelesi yok' },
    { key: 'alindi', icon: '✅', name: 'Alındı', hint: 'evde' },
  ];
  const CATS = ['acil', 'orta', 'sonra'];
  const ITEM_KEYS = ['id','name','category','status','planned','price','link','note','image','emoji','sort_order','bought_at','created_at','updated_at'];

  const fmtTL = (n) => (n == null || isNaN(n)) ? '0' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const nowISO = () => new Date().toISOString();
  const thisMonth = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toRow = (i) => { const o = {}; ITEM_KEYS.forEach(k => { if (i[k] !== undefined) o[k] = i[k]; }); return o; };
  const colOf = (i) => i.status === 'alindi' ? 'alindi' : (CATS.includes(i.category) ? i.category : 'acil');
  const byOrder = (a, b) => (a.sort_order - b.sort_order) || String(a.created_at).localeCompare(String(b.created_at));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ---------------------------------------------------------------- pixel ev
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
  const HCOL = { R: '#ff7a9a', C: '#b55a6a', W: '#fff3dc', D: '#c9814e', k: '#ffd95c', G: '#7fe0b2' };
  function renderHouse(el) {
    if (!el) return;
    let r = '';
    HOUSE.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      if (ch === 'w') { r += `<rect class="win ${x < 8 ? 'w1' : 'w2'}" x="${x}" y="${y}" width="1" height="1"/>`; return; }
      const cls = ch === 'k' ? ' class="door-knob"' : '';
      r += `<rect${cls} x="${x}" y="${y}" width="1" height="1" fill="${HCOL[ch]}"/>`;
    }));
    // duvar kenar çizgileri (pixel outline hissi)
    r += `<rect x="2" y="7" width="1" height="7" fill="#e9cfae"/><rect x="15" y="7" width="1" height="7" fill="#e9cfae"/>`;
    r += `<rect class="smoke s1" x="11" y="-1" width="1" height="1"/><rect class="smoke s2" x="12" y="-1" width="1" height="1"/><rect class="smoke s3" x="11" y="-2" width="1" height="1"/>`;
    el.innerHTML = `<svg viewBox="0 -3 16 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${r}</svg>`;
  }
  function setHouseProgress(el, p) {
    if (!el) return;
    $('.w1', el)?.classList.toggle('lit', p >= 0.25);
    $('.w2', el)?.classList.toggle('lit', p >= 0.5);
    $('.door-knob', el)?.classList.toggle('lit', p >= 0.75);
  }

  // ---------------------------------------------------------------- depolar
  class DemoStore {
    constructor() { this.mode = 'demo'; }
    async load() { return { items: lsGet('ev.items', []), settings: lsGet('ev.settings', null) }; }
    async upsertItems(items) {
      const all = lsGet('ev.items', []);
      items.forEach(it => { const i = all.findIndex(x => x.id === it.id); if (i >= 0) all[i] = { ...all[i], ...toRow(it) }; else all.push(toRow(it)); });
      lsSet('ev.items', all);
    }
    async deleteItem(id) { lsSet('ev.items', lsGet('ev.items', []).filter(x => x.id !== id)); }
    async saveSettings(s) { lsSet('ev.settings', s); }
    subscribe() {}
  }

  class CloudStore {
    constructor(url, anon, houseKey) {
      this.mode = 'cloud';
      this.houseKey = houseKey;
      this.clientId = uid();
      this.sb = window.supabase.createClient(url, anon, {
        global: { headers: { 'x-house-key': houseKey } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    async load() {
      const r1 = await this.sb.from('items').select('*').order('sort_order', { ascending: true });
      if (r1.error) throw r1.error;
      const r2 = await this.sb.from('settings').select('*').eq('house_key', this.houseKey).maybeSingle();
      if (r2.error) throw r2.error;
      return { items: r1.data || [], settings: r2.data || null };
    }
    async upsertItems(items) {
      const rows = items.map(i => ({ ...toRow(i), house_key: this.houseKey, updated_at: nowISO() }));
      const { error } = await this.sb.from('items').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      this.ping();
    }
    async deleteItem(id) {
      const { error } = await this.sb.from('items').delete().eq('id', id);
      if (error) throw error;
      this.ping();
    }
    async saveSettings(s) {
      const row = { house_key: this.houseKey, title: s.title, budget: s.budget, budget_month: s.budget_month, updated_at: nowISO() };
      const { error } = await this.sb.from('settings').upsert(row, { onConflict: 'house_key' });
      if (error) throw error;
      this.ping();
    }
    subscribe(cb) {
      this.ch = this.sb.channel('house:' + this.houseKey, { config: { broadcast: { self: false } } });
      this.ch.on('broadcast', { event: 'changed' }, (msg) => { if (msg?.payload?.from !== this.clientId) cb(); }).subscribe();
    }
    ping() { try { this.ch?.send({ type: 'broadcast', event: 'changed', payload: { from: this.clientId } }); } catch {} }
  }

  // ---------------------------------------------------------------- durum
  const state = {
    store: null,
    items: [],
    settings: { title: "Cemre'nin Evi", budget: 0, budget_month: thisMonth() },
    editingId: null,
    sheetImage: null,
    newId: null,
    folded: lsGet('ev.folded', false),
    loaded: false,
  };
  const el = {
    gate: $('#gate'), gateForm: $('#gateForm'), gateKey: $('#gateKey'), gateError: $('#gateError'),
    house: $('#house'), title: $('#title'), subtitle: $('#subtitle'), cloudBadge: $('#cloudBadge'),
    budgetValue: $('#budgetValue'), hp: $('.hp'), hpSpent: $('#hpSpent'), hpPlanned: $('#hpPlanned'),
    sumSpent: $('#sumSpent'), sumPlanned: $('#sumPlanned'), sumLeft: $('#sumLeft'),
    tabs: $('#tabs'), board: $('#board'), dock: $('#dock'), addBtn: $('#addBtn'),
    backdrop: $('#sheetBackdrop'), sheet: $('#sheet'), settingsSheet: $('#settingsSheet'),
    form: $('#itemForm'), fEmoji: $('#fEmoji'), fName: $('#fName'), fCategory: $('#fCategory'), fPrice: $('#fPrice'),
    fPlanned: $('#fPlanned'), fLinks: $('#fLinks'), fLinkAdd: $('#fLinkAdd'), fPaste: $('#fPaste'), fMetaHint: $('#fMetaHint'), fImgPreview: $('#fImgPreview'), fImageUrl: $('#fImageUrl'),
    fImageFile: $('#fImageFile'), fImageClear: $('#fImageClear'), fNote: $('#fNote'),
    fDelete: $('#fDelete'), fBought: $('#fBought'), fSave: $('#fSave'),
    sTitle: $('#sTitle'), sBudget: $('#sBudget'), sExport: $('#sExport'), sImport: $('#sImport'), sSeed: $('#sSeed'), sKey: $('#sKey'), sBuddies: $('#sBuddies'), sInfo: $('#sInfo'), sSave: $('#sSave'),
    toast: $('#toast'), confetti: $('#confetti'),
  };

  // ---------------------------------------------------------------- toast / konfeti
  let toastTimer;
  function toast(msg, ms = 2200) {
    el.toast.textContent = msg; el.toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms);
  }
  window.EV_CONFETTI = () => confetti(22);
  function confetti(n = 26) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff7a9a', '#ffd95c', '#8fcdff', '#7fe0b2', '#d4c8ff', '#fff'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'pc';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      p.style.animationDelay = (Math.random() * .4) + 's';
      frag.appendChild(p);
    }
    el.confetti.appendChild(frag);
    setTimeout(() => { el.confetti.innerHTML = ''; }, 2200);
  }

  // ---------------------------------------------------------------- hesaplar
  function itemsIn(col) { return state.items.filter(i => colOf(i) === col).sort(byOrder); }
  function sumPrice(arr) { return arr.reduce((s, i) => s + (Number(i.price) || 0), 0); }
  function budgetNumbers() {
    const m = thisMonth();
    const spent = sumPrice(state.items.filter(i => i.status === 'alindi' && String(i.bought_at || '').startsWith(m)));
    const planned = sumPrice(state.items.filter(i => i.status === 'bekliyor' && i.planned));
    const budget = Number(state.settings.budget) || 0;
    return { spent, planned, budget, left: budget - spent - planned };
  }

  // ---------------------------------------------------------------- çizim
  function renderAll() {
    renderHeader();
    renderBudget();
    renderTabs();
    renderBoard();
  }
  function renderHeader() {
    const t = state.settings.title || "Cemre'nin Evi";
    if (document.activeElement !== el.title) el.title.textContent = t;
    document.title = t;
    const total = state.items.length, done = state.items.filter(i => i.status === 'alindi').length;
    el.subtitle.textContent = total ? `${done} / ${total} alındı` : 'Yeni evin alışveriş listesi';
    setHouseProgress(el.house, total ? done / total : 0);
  }
  function renderBudget() {
    const b = budgetNumbers();
    const stale = state.settings.budget_month && state.settings.budget_month !== thisMonth();
    el.budgetValue.textContent = b.budget ? fmtTL(b.budget) + (stale ? ' (eski)' : '') : 'bütçe gir';
    const base = Math.max(b.budget, b.spent + b.planned, 1);
    el.hpSpent.style.width = (b.spent / base * 100) + '%';
    el.hpPlanned.style.width = (b.planned / base * 100) + '%';
    el.hp.classList.toggle('over', b.budget > 0 && b.spent + b.planned > b.budget);
    el.sumSpent.textContent = fmtTL(b.spent) + ' TL';
    el.sumPlanned.textContent = fmtTL(b.planned) + ' TL';
    el.sumLeft.textContent = b.budget ? fmtTL(b.left) + ' TL' : '—';
    el.sumLeft.classList.toggle('neg', b.budget > 0 && b.left < 0);
  }
  function renderTabs() {
    if (!el.tabs.children.length) {
      el.tabs.innerHTML = COLS.map(c => `<button class="tab ${c.key}" data-col="${c.key}" type="button">${c.icon} ${c.name} <span class="n">0</span></button>`).join('');
      el.tabs.addEventListener('click', e => {
        const b = e.target.closest('.tab'); if (!b) return;
        $(`.col[data-col="${b.dataset.col}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    }
    COLS.forEach(c => { $(`.tab[data-col="${c.key}"] .n`).textContent = itemsIn(c.key).length; });
  }
  function ensureBoard() {
    if (el.board.children.length) return;
    el.board.innerHTML = COLS.map(c => `
      <section class="col ${c.key}" data-col="${c.key}">
        <header class="col-head">
          <span class="ic">${c.icon}</span>
          <span class="name">${c.name}</span>
          <span class="meta"><b class="cnt">0</b><span class="tot"></span></span>
        </header>
        <div class="list" data-col="${c.key}"></div>
      </section>`).join('');
    // sürükle-bırak
    $$('.list', el.board).forEach(list => new Sortable(list, sortableOpts()));
    $$('.dock-list', el.dock).forEach(list => new Sortable(list, { ...sortableOpts(), sort: false }));
    // kart etkileşimleri
    el.board.addEventListener('click', onBoardClick);
    $('.col.alindi .col-head').addEventListener('click', () => {
      state.folded = !state.folded; lsSet('ev.folded', state.folded);
      $('.col.alindi').classList.toggle('folded', state.folded);
    });
    $('.col.alindi').classList.toggle('folded', state.folded);
    // aktif sekme takibi
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.col === en.target.dataset.col)); } });
    }, { root: el.board, threshold: .6 });
    $$('.col', el.board).forEach(c => io.observe(c));
  }
  function renderBoard() {
    ensureBoard();
    COLS.forEach(c => {
      const items = itemsIn(c.key);
      const col = $(`.col[data-col="${c.key}"]`);
      $('.cnt', col).textContent = items.length + ' ürün';
      const tot = sumPrice(items);
      $('.tot', col).textContent = tot ? fmtTL(tot) + ' TL' : (c.hint || '');
      const list = $('.list', col);
      list.innerHTML = items.map(cardHTML).join('') || emptyHTML(c.key);
    });
  }
  function emptyHTML(col) {
    const msg = {
      acil: 'Acil bir şey kalmadı! 🎉',
      orta: 'Burası boş. Bir kartı buraya sürükle.',
      sonra: 'Sonraya bıraktığın bir şey yok.',
      alindi: 'Henüz bir şey alınmadı. İlk ✓ için sabırsızım.',
    }[col];
    return `<div class="empty"><span class="zz">${col === 'alindi' ? '🐾' : '😴'}</span>${msg}</div>`;
  }
  function cardHTML(i) {
    const bought = i.status === 'alindi';
    const thumb = i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" decoding="async">` : (i.emoji || '📦');
    const price = (i.price != null && i.price !== '' && !isNaN(i.price)) ? `<span class="price">${fmtTL(i.price)} TL</span>` : `<span class="price none">fiyat yok</span>`;
    const plan = (!bought && i.planned) ? `<span class="badge plan">bu ay</span>` : '';
    const link = linksOf(i).map((u, idx) => `<a class="badge link" href="${esc(u)}" target="_blank" rel="noopener">${idx === 0 ? 'Trendyol ↗' : (idx + 1) + ' ↗'}</a>`).join('');
    const sub = i.note ? `<div class="sub">${esc(i.note)}</div>` : '';
    return `<article class="card ${bought ? 'bought' : ''} ${i.id === state.newId ? 'new' : ''}" data-id="${i.id}">
      <div class="thumb">${thumb}</div>
      <div class="body"><div class="name">${esc(i.name)}</div>${sub}</div>
      <div class="foot">${price}${plan}${link}</div>
      <div class="act"><button class="px-btn ${bought ? 'done' : ''}" type="button" data-act="toggle" title="${bought ? 'Geri al' : 'Alındı'}">✓</button></div>
    </article>`;
  }

  // ---------------------------------------------------------------- sürükle-bırak
  function sortableOpts() {
    return {
      group: 'items',
      animation: 150,
      delay: 160, delayOnTouchOnly: true, touchStartThreshold: 5,
      forceFallback: true, fallbackOnBody: true, fallbackTolerance: 3,
      ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', dragClass: 'sortable-drag',
      scroll: true, bubbleScroll: true, scrollSensitivity: 60, scrollSpeed: 12,
      filter: 'button, a, .empty', preventOnFilter: false,
      draggable: '.card',
      emptyInsertThreshold: 20,
      onStart() { document.body.classList.add('dragging'); el.board.classList.add('dragging'); el.dock.classList.add('show'); },
      onMove(evt) {
        $$('.dock-target', el.dock).forEach(t => t.classList.toggle('over', t.contains(evt.to)));
      },
      onEnd(evt) {
        document.body.classList.remove('dragging'); el.board.classList.remove('dragging'); el.dock.classList.remove('show');
        $$('.dock-target.over', el.dock).forEach(t => t.classList.remove('over'));
        handleDrop(evt);
      },
    };
  }
  async function handleDrop(evt) {
    const id = evt.item?.dataset?.id; if (!id) return;
    const item = state.items.find(i => i.id === id); if (!item) return;
    const to = evt.to; const targetCol = to?.dataset?.col; if (!targetCol) return;
    const isDock = to.classList.contains('dock-list');
    if (isDock) evt.item.remove();

    const fromCol = colOf(item);
    const changed = [];
    // hedef sütundaki sıra
    let ordered;
    if (isDock) {
      ordered = itemsIn(targetCol).filter(i => i.id !== id); ordered.push(item);
    } else {
      const ids = $$('.card', to).map(c => c.dataset.id);
      const map = new Map(state.items.map(i => [i.id, i]));
      ordered = ids.map(x => map.get(x)).filter(Boolean);
      if (!ordered.includes(item)) ordered.push(item);
    }
    if (fromCol === targetCol && !isDock && ordered.every((it, idx) => it.sort_order === idx)) { renderBoard(); return; }

    // kategori/durum
    if (targetCol === 'alindi') {
      if (item.status !== 'alindi') { item.status = 'alindi'; item.bought_at = nowISO(); }
    } else {
      item.status = 'bekliyor'; item.bought_at = null; item.category = targetCol;
    }
    ordered.forEach((it, idx) => { if (it.sort_order !== idx) { it.sort_order = idx; if (!changed.includes(it)) changed.push(it); } });
    if (!changed.includes(item)) changed.push(item);

    renderAll();
    if (targetCol === 'alindi' && fromCol !== 'alindi') celebrate();
    await persist(changed);
  }

  function celebrate() {
    confetti();
    try { window.EV_BUDDY_CHEER?.(); } catch {}
    const total = state.items.length, done = state.items.filter(i => i.status === 'alindi').length;
    if (total && done === total) { toast('Ev tamam! 🏠✨'); el.house.classList.add('party'); setTimeout(() => el.house.classList.remove('party'), 1600); }
    else if (total && [0.25, 0.5, 0.75].some(p => done / total >= p && (done - 1) / total < p)) { el.house.classList.add('party'); setTimeout(() => el.house.classList.remove('party'), 1600); }
  }

  async function persist(items) {
    try { await state.store.upsertItems(items); cacheSave(); }
    catch (e) { console.error(e); toast('Kaydedilemedi — internet var mı?'); await reload(); }
  }

  // ---------------------------------------------------------------- kart tıklamaları
  function onBoardClick(e) {
    const card = e.target.closest('.card'); if (!card) return;
    const id = card.dataset.id;
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'toggle') { e.preventDefault(); toggleBought(id); return; }
    if (e.target.closest('a')) return;
    openSheet(id);
  }
  async function toggleBought(id) {
    const item = state.items.find(i => i.id === id); if (!item) return;
    const was = item.status;
    if (was === 'alindi') { item.status = 'bekliyor'; item.bought_at = null; }
    else { item.status = 'alindi'; item.bought_at = nowISO(); }
    item.sort_order = itemsIn(colOf(item)).length; // sona
    renderAll();
    if (was !== 'alindi') celebrate(); else toast('Geri alındı');
    await persist([item]);
  }

  // ---------------------------------------------------------------- ürün sheet'i
  function setCategoryUI(v) { $$('.seg-btn', el.fCategory).forEach(b => b.classList.toggle('on', b.dataset.val === v)); el.fCategory.dataset.val = v; }
  function setImageUI(src) {
    state.sheetImage = src || null;
    el.fImgPreview.innerHTML = src ? `<img src="${esc(src)}" alt="">` : (el.fEmoji.value || '🖼️');
    if (!src || src.startsWith('data:')) el.fImageUrl.value = ''; else el.fImageUrl.value = src;
  }
  function openSheet(id) {
    state.editingId = id || null;
    const i = id ? state.items.find(x => x.id === id) : null;
    el.fEmoji.value = i?.emoji || '';
    el.fName.value = i?.name || '';
    setCategoryUI(i ? (CATS.includes(i.category) ? i.category : 'acil') : currentVisibleCat());
    el.fPrice.value = (i?.price ?? '') === '' || i?.price == null ? '' : i.price;
    el.fPlanned.checked = !!i?.planned;
    el.fLinks.innerHTML = ''; const _ls = i ? linksOf(i) : []; (_ls.length ? _ls : ['']).forEach(v => addLinkRow(v)); el.fMetaHint.hidden = true;
    el.fNote.value = i?.note || '';
    setImageUI(i?.image || null);
    el.fDelete.hidden = !i;
    el.fBought.hidden = !i;
    el.fBought.textContent = i?.status === 'alindi' ? '↩ Geri al' : '✓ Alındı';
    el.fSave.textContent = i ? 'Kaydet' : 'Ekle';
    el.backdrop.hidden = false; el.sheet.hidden = false; document.body.classList.add('sheet-open');
    if (!i) setTimeout(() => el.fName.focus(), 50);
  }
  function currentVisibleCat() {
    const active = $('.tab.active')?.dataset.col;
    return CATS.includes(active) ? active : 'acil';
  }
  function closeSheets() {
    el.sheet.hidden = true; el.settingsSheet.hidden = true; el.backdrop.hidden = true; document.body.classList.remove('sheet-open');
    state.editingId = null; state.sheetImage = null;
    el.fImageFile.value = '';
  }
  async function saveSheet(e) {
    e?.preventDefault();
    const name = el.fName.value.trim(); if (!name) { el.fName.focus(); return; }
    const priceRaw = el.fPrice.value.replace(',', '.').trim();
    const price = priceRaw === '' ? null : Math.max(0, Number(priceRaw));
    const cat = el.fCategory.dataset.val || 'acil';
    let image = state.sheetImage;
    const url = el.fImageUrl.value.trim();
    if (url && !String(image || '').startsWith('data:')) image = url;
    const existing = state.editingId ? state.items.find(x => x.id === state.editingId) : null;
    const item = existing || { id: uid(), status: 'bekliyor', created_at: nowISO(), sort_order: itemsIn(cat).length, bought_at: null };
    Object.assign(item, {
      name, emoji: el.fEmoji.value.trim() || null, category: cat,
      price: (price == null || isNaN(price)) ? null : price,
      planned: el.fPlanned.checked, link: packLinks($$('input', el.fLinks).map(x => x.value)), note: el.fNote.value.trim() || null, image: image || null,
    });
    if (!existing) { state.items.push(item); state.newId = item.id; setTimeout(() => { state.newId = null; }, 600); }
    renderAll(); closeSheets();
    toast(existing ? 'Kaydedildi' : 'Eklendi ✨');
    await persist([item]);
  }
  function normalizeLink(v) {
    v = (v || '').trim(); if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    return v;
  }

  function linksOf(i) {
    const v = (i && i.link ? String(i.link) : "").trim(); if (!v) return [];
    if (v.startsWith("[")) { try { const a = JSON.parse(v); return Array.isArray(a) ? a.filter(Boolean) : []; } catch { return []; } }
    return [v];
  }
  function packLinks(arr) {
    const a = arr.map(normalizeLink).filter(Boolean);
    return a.length === 0 ? null : (a.length === 1 ? a[0] : JSON.stringify(a));
  }
  function addLinkRow(value) {
    const row = document.createElement("div"); row.className = "link-row";
    row.innerHTML = '<input class="px-input" type="text" placeholder="https://ty.gl/..." inputmode="url" autocapitalize="off"><button class="px-btn small ghost" type="button" title="Kaldır">✕</button>';
    row.querySelector("input").value = value || "";
    row.querySelector("button").addEventListener("click", () => { row.remove(); if (!el.fLinks.children.length) addLinkRow(""); });
    el.fLinks.appendChild(row);
    return row;
  }
  // Trendyol'dan isim/görsel/fiyat çekmeyi dene (r.jina.ai üzerinden; olmazsa sessizce vazgeç)
  async function fetchTrendyolMeta(url) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 16000);
    try {
      const res = await fetch("https://r.jina.ai/" + url, { signal: ctrl.signal, headers: { "Accept": "application/json", "X-Set-Cookie": "countryCode=TR; storefrontId=1; language=tr", "X-With-Images-Summary": "true" } });
      if (!res.ok) return null;
      const j = await res.json(); const d = (j && j.data) || {};
      let title = (d.title || "").replace(/\s*-\s*Fiyatı.*$/i, "").replace(/\s*\|\s*Trendyol.*$/i, "").trim();
      if (/Online Alışveriş Sitesi/i.test(d.title || "")) title = "";
      const imgs = Object.values(d.images || {}).filter(u => /dsmcdn\.com/.test(u) && !/apple-icon|logo|icon-/i.test(u));
      let price = null; const m = (d.content || "").match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*TL/); if (m) price = Number(m[1].replace(/\./g, "").replace(",", "."));
      return (title || imgs.length) ? { title, image: imgs[0] || null, price } : null;
    } catch { return null; } finally { clearTimeout(t); }
  }
  let autofillBusy = false;
  async function maybeAutofill(url) {
    url = normalizeLink(url); if (!url || autofillBusy) return;
    if (!/trendyol\.com|ty\.gl/i.test(url)) return;
    const needName = !el.fName.value.trim(), needImg = !state.sheetImage, needPrice = !el.fPrice.value;
    if (!needName && !needImg && !needPrice) return;
    autofillBusy = true;
    el.fMetaHint.hidden = false; el.fMetaHint.textContent = "🔍 Trendyol'dan bilgi çekiliyor…";
    const meta = await fetchTrendyolMeta(url);
    autofillBusy = false;
    if (!el.sheet || el.sheet.hidden) return;
    if (meta && (meta.title || meta.image)) {
      if (needName && meta.title) el.fName.value = meta.title.slice(0, 80);
      if (needImg && meta.image) setImageUI(meta.image);
      if (needPrice && meta.price) el.fPrice.value = meta.price;
      el.fMetaHint.textContent = "✓ Trendyol'dan dolduruldu — bir kontrol et";
    } else {
      el.fMetaHint.textContent = "Otomatik çekemedim. Adı yaz; fotoğraf için Trendyol'da görsele uzun bas → Kopyala → burada 📋 ile yapıştır.";
    }
  }
  function applySharedText(text) {
    const urls = (text.match(/https?:\/\/\S+/g) || []).map(u => u.replace(/[),.;]+$/, ""));
    const rest = text.replace(/https?:\/\/\S+/g, " ").replace(/Trendyol'?da gördüm[^:]*:?/i, " ").replace(/\s+/g, " ").trim();
    if (urls.length) { el.fLinks.innerHTML = ""; urls.forEach(u => addLinkRow(u)); }
    if (rest.length > 3 && !el.fName.value.trim()) el.fName.value = rest.slice(0, 80);
    if (urls.length) maybeAutofill(urls[0]);
  }
  async function pasteFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const t = (it.types || []).find(x => x.startsWith("image/"));
          if (t) { const blob = await it.getType(t); setImageUI(await shrinkImage(blob)); toast("Fotoğraf yapıştırıldı 🖼️"); return; }
        }
      }
    } catch {}
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) { toast("Panoda bir şey bulamadım"); return; }
      applySharedText(text.trim());
    } catch { toast("Panoya erişemedim — linki elle yapıştır"); }
  }
  function consumePendingShare() {
    if (!state.pendingShare) return;
    const t = state.pendingShare; state.pendingShare = null;
    openSheet(null); applySharedText(t);
  }
  async function deleteCurrent() {
    const item = state.items.find(x => x.id === state.editingId); if (!item) return;
    if (!confirm(`"${item.name}" silinsin mi?`)) return;
    state.items = state.items.filter(x => x.id !== item.id);
    renderAll(); closeSheets(); toast('Silindi');
    try { await state.store.deleteItem(item.id); cacheSave(); } catch (err) { console.error(err); toast('Silinemedi — internet var mı?'); await reload(); }
  }
  async function shrinkImage(file) {
    const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
    const max = 360; const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', .8);
  }

  // ---------------------------------------------------------------- ayarlar
  function openSettings(focusBudget) {
    el.sTitle.value = state.settings.title || '';
    el.sBudget.value = state.settings.budget || '';
    el.sInfo.textContent = state.store.mode === 'cloud'
      ? `Bulut bağlı · ev anahtarı: ${state.store.houseKey} · ${state.items.length} ürün`
      : `Demo mod · veri sadece bu cihazda · ${state.items.length} ürün`;
    el.sKey.hidden = state.store.mode !== 'cloud';
    el.backdrop.hidden = false; el.settingsSheet.hidden = false; document.body.classList.add('sheet-open');
    el.sBuddies.checked = lsGet('ev.buddies.on', true);
    if (focusBudget) setTimeout(() => { el.sBudget.focus(); el.sBudget.select(); }, 50);
  }
  async function saveSettings() {
    const title = el.sTitle.value.trim() || "Cemre'nin Evi";
    lsSet('ev.buddies.on', !!el.sBuddies.checked); try { window.EV_BUDDY_SET?.(!!el.sBuddies.checked); } catch {}
    const budget = Math.max(0, Number(el.sBudget.value) || 0);
    const changedBudget = budget !== (Number(state.settings.budget) || 0);
    state.settings = { ...state.settings, title, budget, budget_month: changedBudget || !state.settings.budget_month ? thisMonth() : state.settings.budget_month };
    renderAll(); closeSheets(); toast('Kaydedildi');
    try { await state.store.saveSettings(state.settings); cacheSave(); } catch (e) { console.error(e); toast('Kaydedilemedi — internet var mı?'); }
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ settings: state.settings, items: state.items.map(toRow) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ev-listesi-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importJSON(file) {
    try {
      const data = JSON.parse(await file.text());
      const items = (data.items || []).map(i => ({ ...toRow(i), id: i.id || uid() }));
      if (!items.length) { toast('Dosyada ürün yok'); return; }
      const map = new Map(state.items.map(i => [i.id, i]));
      items.forEach(i => map.set(i.id, { ...(map.get(i.id) || {}), ...i }));
      state.items = [...map.values()];
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      renderAll(); closeSheets(); toast(`${items.length} ürün yüklendi`);
      await persist(items); await state.store.saveSettings(state.settings);
    } catch (e) { console.error(e); toast('Yedek okunamadı'); }
  }
  function seedItems() {
    const base = state.items.length;
    return (window.EV_SEED || []).map((s, idx) => ({
      id: uid(), name: s.name, category: s.category, status: 'bekliyor', planned: false,
      price: s.price ?? null, link: s.link ?? null, note: s.note ?? null, image: s.image ?? null, emoji: s.emoji ?? null,
      sort_order: base + idx, bought_at: null, created_at: nowISO(),
    }));
  }
  async function addSeed(silent) {
    if (!silent && state.items.length && !confirm('Başlangıç listesi mevcut listenin üstüne eklenecek. Devam?')) return;
    const items = seedItems();
    state.items.push(...items);
    renderAll(); closeSheets();
    if (!silent) toast(`${items.length} ürün eklendi 🌱`);
    await persist(items);
  }

  // ---------------------------------------------------------------- yükleme / senkron
  function cacheSave() { if (state.store?.mode === 'cloud') lsSet('ev.cache', { items: state.items, settings: state.settings, t: Date.now() }); }
  function applyData(d) {
    state.items = (d.items || []).map(i => ({ ...i, price: i.price == null ? null : Number(i.price), planned: !!i.planned, sort_order: Number(i.sort_order) || 0 }));
    if (d.settings) state.settings = { ...state.settings, ...d.settings };
  }
  let reloading = false;
  async function reload() {
    if (reloading) return; reloading = true;
    try { applyData(await state.store.load()); state.loaded = true; renderAll(); cacheSave(); }
    catch (e) { console.error(e); toast('Liste yüklenemedi — internet var mı?'); }
    finally { reloading = false; }
  }
  let syncTimer;
  function scheduleReload() { clearTimeout(syncTimer); syncTimer = setTimeout(reload, 300); }

  async function start() {
    renderAll();
    await reload();
    // ilk kurulum: demo modda liste boşsa tohumu yükle
    if (state.store.mode === 'demo' && !state.items.length && !lsGet('ev.seeded', false)) { lsSet('ev.seeded', true); await addSeed(true); }
    state.store.subscribe(scheduleReload);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleReload(); });
    window.addEventListener('online', scheduleReload);
  }

  // ---------------------------------------------------------------- kapı (ev anahtarı)
  function showGate(msg) {
    el.gate.hidden = false;
    el.gateError.hidden = !msg; if (msg) el.gateError.textContent = msg;
    renderHouse($('.pixel-house', el.gate));
    setTimeout(() => el.gateKey.focus(), 50);
  }
  async function tryKey(key, cfg, createIfMissing) {
    const store = new CloudStore(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, key);
    let data;
    try { data = await store.load(); }
    catch (e) { console.error(e); showGate('Bağlanılamadı. İnternet ve Supabase ayarlarını kontrol et.'); return false; }
    const exists = (data.items && data.items.length) || data.settings;
    if (!exists && !createIfMissing) {
      showGate('Bu anahtarla kayıtlı bir ev yok. Yazımı kontrol et — ya da yeni ev kurmak için tekrar "Kapıyı aç"a bas.');
      el.gateForm.dataset.confirm = '1';
      return false;
    }
    lsSet('ev.houseKey', key);
    state.store = store;
    el.gate.hidden = true;
    el.cloudBadge.hidden = false; el.cloudBadge.className = 'cloud-badge on'; el.cloudBadge.textContent = 'Bulut bağlı · ikiniz de görüyorsunuz';
    if (!exists) {
      state.items = []; state.settings = { ...state.settings, budget_month: thisMonth() };
      await store.saveSettings(state.settings).catch(console.error);
      await start();
      await addSeed(true);
      toast('Yeni ev kuruldu, başlangıç listesi yüklendi 🏠');
    } else {
      await start();
    }
    showWelcome();
    if ($('#welcome').hidden) consumePendingShare();
    return true;
  }

  // ---------------------------------------------------------------- hoş geldin
  function showWelcome() {
    const w = window.EV_WELCOME || {};
    if (!w.text || lsGet('ev.welcomed', false)) return;
    const box = $('#welcome'); if (!box) return;
    renderHouse($('#welcomeHouse')); setHouseProgress($('#welcomeHouse'), 1);
    $('#welcomeTitle').textContent = w.title || 'Hoş geldin ♥';
    $('#welcomeText').textContent = w.text;
    $('#welcomeSign').textContent = w.sign || '';
    $('#welcomeBtn').textContent = w.button || 'Eve gir ♥';
    box.hidden = false;
    $('#welcomeBtn').onclick = () => {
      lsSet('ev.welcomed', true); box.hidden = true;
      confetti(40); try { window.EV_BUDDY_CHEER?.(); } catch {}
      el.house.classList.add('party'); setTimeout(() => el.house.classList.remove('party'), 1600);
      consumePendingShare();
    };
  }

  // ---------------------------------------------------------------- olaylar
  function bindEvents() {
    el.addBtn.addEventListener('click', () => openSheet(null));
    el.backdrop.addEventListener('click', closeSheets);
    el.form.addEventListener('submit', saveSheet);
    el.fDelete.addEventListener('click', deleteCurrent);
    el.fBought.addEventListener('click', async () => { const id = state.editingId; closeSheets(); await toggleBought(id); });
    el.fCategory.addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (b) setCategoryUI(b.dataset.val); });
    el.fEmoji.addEventListener('input', () => { if (!state.sheetImage) setImageUI(null); });
    el.fImageUrl.addEventListener('change', () => { const v = el.fImageUrl.value.trim(); setImageUI(v || null); if (v) el.fImageUrl.value = v; });
    el.fImageFile.addEventListener('change', async () => {
      const f = el.fImageFile.files?.[0]; if (!f) return;
      try { setImageUI(await shrinkImage(f)); } catch { toast('Fotoğraf okunamadı'); }
    });
    el.fImageClear.addEventListener('click', () => setImageUI(null));
    el.fLinkAdd.addEventListener('click', () => { addLinkRow('').querySelector('input').focus(); });
    el.fPaste.addEventListener('click', pasteFromClipboard);
    el.fLinks.addEventListener('change', e => { const inp = e.target.closest('input'); if (inp) maybeAutofill(inp.value); });
    el.sheet.addEventListener('paste', e => {
      const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); shrinkImage(f).then(d => { setImageUI(d); toast('Fotoğraf yapıştırıldı 🖼️'); }).catch(() => {}); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });

    $('#settingsBtn').addEventListener('click', () => openSettings(false));
    $('#budgetEdit').addEventListener('click', () => openSettings(true));
    el.sSave.addEventListener('click', saveSettings);
    el.sExport.addEventListener('click', exportJSON);
    el.sImport.addEventListener('change', () => { const f = el.sImport.files?.[0]; if (f) importJSON(f); el.sImport.value = ''; });
    el.sSeed.addEventListener('click', () => addSeed(false));
    el.sKey.addEventListener('click', () => { if (confirm('Ev anahtarı silinecek ve tekrar sorulacak. Devam?')) { localStorage.removeItem('ev.houseKey'); location.reload(); } });

    el.title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.title.blur(); } });
    el.title.addEventListener('blur', async () => {
      const t = el.title.textContent.trim().slice(0, 40) || "Cemre'nin Evi";
      if (t === state.settings.title) { el.title.textContent = t; return; }
      state.settings = { ...state.settings, title: t }; renderHeader();
      try { await state.store.saveSettings(state.settings); cacheSave(); } catch (e) { console.error(e); toast('Kaydedilemedi'); }
    });

    el.gateForm.addEventListener('submit', async e => {
      e.preventDefault();
      const key = el.gateKey.value.trim(); if (!key) return;
      const confirmCreate = el.gateForm.dataset.confirm === '1' && el.gateForm.dataset.lastKey === key;
      el.gateForm.dataset.lastKey = key;
      const btn = $('button', el.gateForm); btn.disabled = true; btn.textContent = 'Açılıyor…';
      await tryKey(key, window.EV_CONFIG, confirmCreate);
      btn.disabled = false; btn.textContent = 'Kapıyı aç';
    });
  }

  // ---------------------------------------------------------------- başlat
  async function boot() {
    renderHouse(el.house);
    bindEvents();
    try {
      const sp = new URLSearchParams(location.search);
      const sharedRaw = [sp.get('title'), sp.get('text'), sp.get('url')].filter(Boolean).join(' ').trim();
      if (sharedRaw) { state.pendingShare = sharedRaw; history.replaceState(null, '', location.pathname); }
    } catch {}
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(() => {}); }

    const cfg = window.EV_CONFIG || {};
    let forceDemo = false; try { forceDemo = new URLSearchParams(location.search).has('demo'); } catch {}
    const cloudReady = !forceDemo && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase;
    if (cloudReady) {
      const cached = lsGet('ev.cache', null);
      if (cached) { applyData(cached); renderAll(); }
      const key = lsGet('ev.houseKey', null);
      if (!key) { showGate(); return; }
      await tryKey(key, cfg, true);
    } else {
      state.store = new DemoStore();
      el.cloudBadge.hidden = false; el.cloudBadge.className = 'cloud-badge off';
      el.cloudBadge.textContent = forceDemo ? 'Demo önizleme · veri sadece bu cihazda' : (cfg.SUPABASE_URL ? 'Bulut kütüphanesi yüklenemedi · demo mod' : 'Demo mod · veri sadece bu cihazda');
      await start();
      consumePendingShare();
    }
  }
  boot();
})();
