/* Buddy'ler — sayfanın altında yaşayan, tutup fırlatılabilen pixel karakterler.
   Veri: window.EV_BUDDIES = [{ id, name, palette:{ch:'#hex'}, frames:[[rows],[rows]] }, ...]
   - Dokun: zıplar + kalp + (bazen) laf. Çift dokun: büyük zıplama.
   - Basılı tut (120ms) ya da yana çek: kaldır; bırakınca fırlar, yere düşer, seker.
   - Karta/sayfaya dikey kaydırma karakter üstünden de çalışır (touch-action: pan-y).
*/
(() => {
  'use strict';
  const data = Array.isArray(window.EV_BUDDIES) ? window.EV_BUDDIES : [];
  if (!data.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };

  // ---------------------------------------------------------------- ayarlar
  const CFG = {
    gravity: 2100, bounce: 0.42, wallBounce: 0.55, floorFriction: 5, airDrag: 0.3, maxSpeed: 2600,
    floorPad: 8, holdMs: 120, tapMs: 220, tapPx: 6, dblMs: 350,
    idleMin: 6000, idleMax: 16000, blinkMin: 3000, blinkMax: 6000, sleepAfter: 60000,
  };
  const PHRASES = ['♥', 'ponçik!', 'hehe', 'bugün ne alıyoruz?', 'tava şart 🍳', 'hoş geldin!', 'zıp!', 'beni fırlat!', 'evimiz güzel olacak', 'Cemre ♥', 'bir kalp daha', 'yumuşacık'];

  // ---------------------------------------------------------------- katman
  const layer = document.createElement('div');
  layer.id = 'buddyLayer';
  layer.setAttribute('aria-hidden', 'true');
  if (lsGet('ev.buddies.on', true) === false) layer.classList.add('hidden-away');
  document.body.appendChild(layer);

  const W = () => innerWidth;
  const safeB = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')); return isNaN(v) ? 0 : v; };
  const floorY = () => innerHeight - safeB() - CFG.floorPad;
  const fabZone = () => W() - 100;

  // ölçek / kaç karakter: dar ekranda 4 (ayı hep var, diğerleri güne göre döner)
  function roster() {
    const w = W();
    const count = w < 600 ? 4 : (w < 900 ? 5 : data.length);
    if (count >= data.length) return data.slice();
    const main = data.find(d => d.id === 'ayi') || data[0];
    const rest = data.filter(d => d !== main);
    const day = Math.floor(Date.now() / 86400000);
    const start = day % rest.length;
    const pick = [main];
    for (let i = 0; pick.length < count && i < rest.length; i++) pick.push(rest[(start + i) % rest.length]);
    return pick;
  }
  const SCALE = 3;

  // ---------------------------------------------------------------- sprite → canvas
  function drawFrame(canvas, sprite, fi) {
    const f = sprite.frames[fi] || sprite.frames[0];
    const w = f[0].length, h = f.length;
    if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    f.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; ctx.fillStyle = sprite.palette[ch] || '#000'; ctx.fillRect(x, y, 1, 1); } });
  }

  // ---------------------------------------------------------------- kalpler
  let heartCount = 0;
  function hearts(x, y, n) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      if (heartCount >= 14) return;
      heartCount++;
      const h = document.createElement('i');
      h.className = 'bheart';
      h.style.left = (x + (Math.random() * 36 - 18)) + 'px'; h.style.top = (y + (Math.random() * 10 - 5)) + 'px';
      h.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      h.style.animationDelay = (i * 0.04) + 's';
      layer.appendChild(h);
      setTimeout(() => { h.remove(); heartCount--; }, 900 + i * 40);
    }
  }

  // ---------------------------------------------------------------- buddy
  const buddies = [];
  let rafOn = false, last = 0;
  function wake() { if (!rafOn) { rafOn = true; last = performance.now(); requestAnimationFrame(loop); } }
  const blocked = () => document.hidden || layer.classList.contains('off') || layer.classList.contains('hidden-away') || document.body.classList.contains('sheet-open') || document.body.classList.contains('dragging');

  class Buddy {
    constructor(sprite, i, n) {
      this.sprite = sprite; this.id = sprite.id;
      const f = sprite.frames[0];
      this.w = f[0].length * SCALE; this.h = f.length * SCALE;
      this.el = document.createElement('div');
      this.el.className = 'buddy'; this.el.dataset.id = sprite.id;
      this.el.title = sprite.name || sprite.id;
      this.el.style.width = this.w + 'px'; this.el.style.height = this.h + 'px';
      this.canvas = document.createElement('canvas');
      this.el.appendChild(this.canvas);
      this.frame = -1; this.setFrame(0);
      layer.appendChild(this.el);
      const usable = Math.max(0, fabZone() - 16 - this.w);
      this.x = 8 + usable * (n > 1 ? i / (n - 1) : 0.5) + (Math.random() * 16 - 8);
      this.x = Math.max(0, Math.min(fabZone() - this.w, this.x));
      this.y = floorY() - this.h - 60 - Math.random() * 140;
      this.vx = 0; this.vy = 0; this.dir = Math.random() < 0.5 ? 1 : -1;
      this.rot = 0; this.roll = 0; this.sx = 1; this.sy = 1; this.tsx = 1; this.tsy = 1;
      this.onFloor = false; this.held = false; this.pending = null; this.sleeping = false;
      this.lastTap = 0; this.taps = 0; this.lastInteract = performance.now();
      this.walkUntil = 0; this.walkDir = 0; this.pendingHop = 0; this.landed = false; this.userThrew = false;
      this.bind(); this.scheduleIdle(); this.scheduleBlink();
      this.render(true);
    }
    // ---- etkileşim
    bind() {
      const el = this.el;
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (blocked()) return;
        e.stopPropagation();
        this.pending = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), timer: setTimeout(() => this.grab(e.pointerId, e.clientX, e.clientY), CFG.holdMs) };
        this.lastInteract = performance.now();
        if (this.sleeping) this.wakeUp();
      });
      el.addEventListener('pointermove', (e) => {
        if (this.pending && !this.held) {
          const dx = e.clientX - this.pending.x, dy = e.clientY - this.pending.y;
          if (Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) { this.cancelPending(); return; } // sayfa kaydırma
          if (Math.abs(dx) >= 8) this.grab(e.pointerId, e.clientX, e.clientY);
          return;
        }
        if (!this.held) return;
        const now = performance.now();
        this.tx = e.clientX - this.grabDX; this.ty = e.clientY - this.grabDY;
        this.samples.push({ t: now, x: e.clientX, y: e.clientY });
        while (this.samples.length > 2 && now - this.samples[0].t > 90) this.samples.shift();
        const mdx = e.clientX - this.samples[0].x;
        if (Math.abs(mdx) > 4) this.dir = mdx > 0 ? 1 : -1;
      });
      const up = (e) => {
        if (this.pending && !this.held) {
          const p = this.pending; this.cancelPending();
          const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
          if (performance.now() - p.t <= CFG.tapMs + CFG.holdMs && moved < CFG.tapPx) this.tap();
          return;
        }
        if (!this.held) return;
        this.release(e);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', () => { if (this.pending && !this.held) this.cancelPending(); else if (this.held) this.release(null); });
      el.addEventListener('lostpointercapture', () => { if (this.held) this.release(null); });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    cancelPending() { if (this.pending) { clearTimeout(this.pending.timer); this.pending = null; } }
    grab(pointerId, cx, cy) {
      if (this.held || blocked()) { this.cancelPending(); return; }
      const p = this.pending; this.cancelPending();
      this.held = true; this.el.classList.add('held');
      try { this.el.setPointerCapture(pointerId); } catch {}
      document.addEventListener('touchmove', preventScroll, { passive: false });
      this.grabDX = (p ? p.x : cx) - this.x; this.grabDY = (p ? p.y : cy) - this.y;
      this.tx = cx - this.grabDX; this.ty = cy - this.grabDY;
      this.samples = [{ t: performance.now(), x: cx, y: cy }];
      this.vx = 0; this.vy = 0; this.onFloor = false;
      this.tsx = .92; this.tsy = 1.08;
      this.setFrame(0);
      wake();
    }
    release(e) {
      this.held = false; this.el.classList.remove('held');
      document.removeEventListener('touchmove', preventScroll);
      const s = this.samples || [];
      const s0 = s[0], s1 = s[s.length - 1];
      let vx = 0, vy = 0;
      if (s0 && s1 && s1.t > s0.t) { const dt = (s1.t - s0.t) / 1000; vx = (s1.x - s0.x) / dt; vy = (s1.y - s0.y) / dt; }
      const sp = Math.hypot(vx, vy);
      if (sp > CFG.maxSpeed) { vx *= CFG.maxSpeed / sp; vy *= CFG.maxSpeed / sp; }
      if (sp < 200) { vx = 0; vy = 0; }
      this.vx = vx; this.vy = vy; this.onFloor = false; this.landed = false; this.userThrew = true;
      this.tsx = 1; this.tsy = 1;
      this.lastInteract = performance.now();
      wake();
    }
    tap() {
      const now = performance.now();
      const dbl = now - this.lastTap < CFG.dblMs; this.lastTap = now; this.taps++;
      this.lastInteract = now;
      this.vy = dbl ? -900 : -520; this.vx = (Math.random() - 0.5) * 160; this.onFloor = false; this.landed = false;
      hearts(this.x + this.w / 2, this.y + this.h * 0.3, dbl ? 12 : 6);
      this.setFrame(1); this.happyUntil = now + 600;
      // karaktere özel imza
      switch (this.id) {
        case 'flork': this.say('!'); break;
        case 'kedi': this.say(this.taps % 3 === 0 ? 'mrrr' : 'miyav'); break;
        case 'top': this.squash(1.25, .75); break;
        case 'hayalet': this.el.classList.add('ghosty'); this.vy -= 120; setTimeout(() => this.el.classList.remove('ghosty'), 260); break;
        case 'tavsan': this.pendingHop = -300; break;
        case 'ayi': hearts(this.x + this.w / 2, this.y, 2); break;
      }
      if (!['flork', 'kedi'].includes(this.id)) this.say(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
      if (this.taps % 8 === 0) { try { window.EV_CONFETTI?.(); } catch {} }
      wake();
    }
    say(text) {
      let b = this.el.querySelector('.bubble');
      if (!b) { b = document.createElement('div'); b.className = 'bubble'; this.el.appendChild(b); }
      b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      clearTimeout(this.bubbleT); this.bubbleT = setTimeout(() => b.classList.remove('show'), 1500);
    }
    squash(sx, sy) { this.sx = sx; this.sy = sy; this.tsx = 1; this.tsy = 1; wake(); }
    setFrame(i) { if (this.frame === i) return; this.frame = i; drawFrame(this.canvas, this.sprite, i); }
    wakeUp() { this.sleeping = false; this.el.classList.remove('zzz'); this.setFrame(0); }
    // ---- idle zamanlayıcılar (rAF olmadan)
    scheduleIdle() {
      clearTimeout(this.idleT);
      this.idleT = setTimeout(() => {
        if (!blocked() && !this.held && this.onFloor && !reduced) {
          const now = performance.now();
          if (!this.sleeping && now - this.lastInteract > CFG.sleepAfter && Math.random() < 0.5) { this.sleeping = true; this.el.classList.add('zzz'); this.setFrame(1); }
          else if (this.sleeping && Math.random() < 0.25) this.wakeUp();
          else if (!this.sleeping) {
            const r = Math.random();
            if (r < 0.45) { this.vy = -380; this.onFloor = false; this.landed = false; }
            else { this.walkDir = Math.random() < 0.5 ? -1 : 1; this.walkUntil = now + 600 + Math.random() * 1200; this.dir = this.walkDir; }
            wake();
          }
        }
        this.scheduleIdle();
      }, CFG.idleMin + Math.random() * (CFG.idleMax - CFG.idleMin));
    }
    scheduleBlink() {
      clearTimeout(this.blinkT);
      this.blinkT = setTimeout(() => {
        if (!blocked() && !this.sleeping && !this.held && !(this.happyUntil > performance.now())) { this.setFrame(1); setTimeout(() => { if (!this.sleeping && !(this.happyUntil > performance.now())) this.setFrame(0); }, 130); }
        this.scheduleBlink();
      }, CFG.blinkMin + Math.random() * (CFG.blinkMax - CFG.blinkMin));
    }
    // ---- fizik
    step(dt, now) {
      if (this.held) {
        this.x += (this.tx - this.x) * Math.min(1, 0.38 * 60 * dt); this.y += (this.ty - this.y) * Math.min(1, 0.38 * 60 * dt);
        const s = this.samples; const vx = s && s.length > 1 ? (s[s.length - 1].x - s[0].x) / Math.max(0.016, (s[s.length - 1].t - s[0].t) / 1000) : 0;
        this.rot = Math.max(-14, Math.min(14, vx / 40));
        return true;
      }
      if (this.happyUntil && now > this.happyUntil) { this.happyUntil = 0; if (!this.sleeping) this.setFrame(0); }
      if (reduced) { this.x = Math.max(0, Math.min(W() - this.w, this.x)); this.y = floorY() - this.h; this.onFloor = true; this.rot = 0; return false; }

      if (now < this.walkUntil && this.onFloor) this.vx = this.walkDir * 40; else if (this.walkUntil && now >= this.walkUntil) this.walkUntil = 0;
      // FAB bölgesinde dinlenme yok → sola yürü
      if (this.onFloor && !this.walkUntil && this.x + this.w > fabZone()) { this.vx = -140; this.dir = -1; }

      this.vy += CFG.gravity * dt;
      this.vx *= Math.max(0, 1 - CFG.airDrag * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;

      const fy = floorY() - this.h;
      if (this.y >= fy) {
        if (!this.onFloor) {
          const k = Math.max(0, Math.min(.32, Math.abs(this.vy) / 2400));
          if (this.vy > 200) { this.sx = 1 + k; this.sy = 1 - k; }
          if (!this.landed && this.userThrew && this.vy > 600) { this.landed = true; this.userThrew = false; try { navigator.vibrate?.(6); } catch {} }
          if (this.vy > 1500) { hearts(this.x + this.w / 2, this.y + this.h * 0.5, 3); this.say('uff!'); }
          this.bounces = (this.bounces || 0) + 1;
        }
        this.y = fy;
        const e = this.bounces > 1 ? CFG.bounce * 0.6 : CFG.bounce;
        this.vy = this.vy > 120 ? -this.vy * e : 0;
        this.onFloor = this.vy === 0;
        if (this.onFloor) {
          this.bounces = 0;
          if (this.pendingHop) { this.vy = this.pendingHop; this.pendingHop = 0; this.onFloor = false; }
        }
        this.vx *= Math.max(0, 1 - CFG.floorFriction * dt);
        if (Math.abs(this.vx) < 12) this.vx = 0;
      } else this.onFloor = false;
      if (this.y < -2 * this.h) { this.y = -2 * this.h; this.vy = Math.abs(this.vy) * 0.3; }
      if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) * CFG.wallBounce; this.dir = 1; this.sx = .78; this.sy = 1.18; }
      if (this.x > W() - this.w) { this.x = W() - this.w; this.vx = -Math.abs(this.vx) * CFG.wallBounce; this.dir = -1; this.sx = .78; this.sy = 1.18; }
      if (Math.abs(this.vx) > 10 && !this.walkUntil) this.dir = this.vx > 0 ? 1 : -1;

      // biçim: havada uzama, yerde toparlanma
      const sp = Math.hypot(this.vx, this.vy);
      const airSy = 1 + Math.min(.14, sp / 7000);
      this.tsx = this.onFloor ? 1 : 1 / airSy; this.tsy = this.onFloor ? 1 : airSy;
      const lerp = Math.min(1, 14 * dt);
      this.sx += (this.tsx - this.sx) * lerp; this.sy += (this.tsy - this.sy) * lerp;
      // dönüş: top yuvarlanır, diğerleri eğilir
      if (this.id === 'top') { this.roll += this.vx * dt * (360 / (Math.PI * this.w)); this.rot = this.roll; }
      else this.rot = this.onFloor ? 0 : Math.max(-14, Math.min(14, this.vx * 0.02));

      const moving = !this.onFloor || Math.abs(this.vx) > 10 || Math.abs(this.sx - 1) > 0.01 || Math.abs(this.sy - 1) > 0.01;
      if (!moving && this.id !== 'top') this.rot = 0;
      return moving;
    }
    render(force) {
      const rot = this.id === 'top' ? this.rot : this.rot * this.dir;
      const t = `translate3d(${Math.round(this.x)}px, ${this.y.toFixed(1)}px, 0) scaleX(${this.dir}) scale(${this.sx.toFixed(3)}, ${this.sy.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
      if (force || t !== this._t) { this.el.style.transform = t; this._t = t; }
    }
  }
  function preventScroll(e) { e.preventDefault(); }

  // ---------------------------------------------------------------- döngü
  function separate() {
    for (let i = 0; i < buddies.length; i++) for (let j = i + 1; j < buddies.length; j++) {
      const a = buddies[i], b = buddies[j];
      if (a.held || b.held || !a.onFloor || !b.onFloor) continue;
      const minD = (a.w + b.w) * 0.42;
      const d = (b.x + b.w / 2) - (a.x + a.w / 2);
      if (Math.abs(d) < minD) { const push = (minD - Math.abs(d)) * 0.12; const s = d >= 0 ? 1 : -1; a.x -= push * s; b.x += push * s; a.vx -= 2 * s; b.vx += 2 * s; }
    }
  }
  function loop(now) {
    const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000)); last = now;
    let any = false;
    if (!document.hidden) {
      buddies.forEach(b => { if (b.step(dt, now)) any = true; });
      separate();
      buddies.forEach(b => b.render(false));
    }
    if (any || buddies.some(b => b.held)) requestAnimationFrame(loop); else rafOn = false;
  }

  const list = roster();
  list.forEach((s, i) => buddies.push(new Buddy(s, i, list.length)));
  wake();

  // sheet/dock durumları body class ile gelir; geri dönünce hepsi mini hop
  let wasBlocked = false;
  const mo = new MutationObserver(() => {
    const b = document.body.classList.contains('dragging') || document.body.classList.contains('sheet-open');
    if (wasBlocked && !b) { buddies.forEach((bd, i) => setTimeout(() => { if (!bd.held) { bd.vy = -240; bd.onFloor = false; wake(); } }, i * 50)); }
    wasBlocked = b;
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', () => { buddies.forEach(b => { b.x = Math.min(b.x, Math.max(0, W() - b.w)); if (b.onFloor) b.y = floorY() - b.h; b.render(true); }); wake(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  // dış dünya
  window.EV_BUDDY_CHEER = () => { buddies.forEach((b, i) => setTimeout(() => { if (!b.held) { b.vy = -600; b.onFloor = false; b.landed = false; hearts(b.x + b.w / 2, b.y, 3); b.setFrame(1); b.happyUntil = performance.now() + 900; wake(); } }, i * 60)); };
  window.EV_BUDDY_SET = (on) => { layer.classList.toggle('hidden-away', !on); if (on) wake(); };
})();
