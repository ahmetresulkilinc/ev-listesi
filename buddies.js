/* Buddy'ler v3 — sayfada yaşayan pixel karakterler.
   Veri: window.EV_BUDDIES = [{ id, name, palette, roles:{idle,blink,walk:[a,b],held,land}, frames:[...] }]
   - Kendi kafalarına dolaşırlar: yürür, zıplar, birbirini ziyaret eder, itişir, kovalar,
     sütun başlıklarına tüner, FAB'ı dürter, uyur.
   - Dokun: zıplar + kalp + laf. Çift dokun: büyük zıplama. Basılı tut / yana çek: kaldır → fırlat.
   - Efektler: iniş tozu, duvar yıldızları, kalpler, squash-stretch, yürüme kareleri.
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
    walkSpeed: 55, visitSpeed: 62, chaseSpeed: 130, fleeSpeed: 118,
    thinkMin: 2600, thinkMax: 6200, blinkMin: 3000, blinkMax: 6500, sleepAfter: 45000,
    walkStepPx: 22,
  };
  const PHRASES = ['♥', 'ponçik!', 'hehe', 'bugün ne alıyoruz?', 'tava şart 🍳', 'hoş geldin!', 'zıp!', 'beni fırlat!', 'evimiz güzel olacak', 'Cemre ♥', 'bir kalp daha', 'yumuşacık', 'gezmece!', 'burası güzelmiş'];
  const PERCH_PHRASES = ['manzara güzel', 'buradan her şey görünüyor', 'hepsini alacağız', 'liste kabarık', 'tünedim ✓'];

  // ---------------------------------------------------------------- katman
  const layer = document.createElement('div');
  layer.id = 'buddyLayer';
  layer.setAttribute('aria-hidden', 'true');
  if (lsGet('ev.buddies.on', true) === false) layer.classList.add('hidden-away');
  document.body.appendChild(layer);

  const W = () => innerWidth;
  const safeB = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')); return isNaN(v) ? 0 : v; };
  const floorY = () => innerHeight - safeB() - CFG.floorPad;
  const fabEl = () => document.querySelector('.fab');
  const fabZone = () => W() - 100;

  function roster() {
    const w = W();
    const count = w < 600 ? 5 : (w < 900 ? 6 : data.length);
    if (count >= data.length) return data.slice();
    const main = data.find(d => d.id === 'ayi') || data[0];
    const rest = data.filter(d => d !== main);
    const day = Math.floor(Date.now() / 86400000);
    const pick = [main];
    for (let i = 0; pick.length < count && i < rest.length; i++) pick.push(rest[(day + i) % rest.length]);
    return pick;
  }
  const SCALE = 3;

  // ---------------------------------------------------------------- sprite → canvas
  function drawFrame(canvas, sprite, fi) {
    fi = Math.max(0, Math.min(fi ?? 0, sprite.frames.length - 1));
    const f = sprite.frames[fi];
    const w = f[0].length, h = f.length;
    if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    f.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; ctx.fillStyle = sprite.palette[ch] || '#000'; ctx.fillRect(x, y, 1, 1); } });
  }

  // ---------------------------------------------------------------- parçacıklar
  let particleCount = 0;
  function particle(cls, x, y, vars, life) {
    if (reduced || particleCount >= 18) return;
    particleCount++;
    const p = document.createElement('i');
    p.className = cls;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    for (const k in vars) p.style.setProperty(k, vars[k]);
    layer.appendChild(p);
    setTimeout(() => { p.remove(); particleCount--; }, life);
  }
  function hearts(x, y, n) { for (let i = 0; i < n; i++) setTimeout(() => particle('bheart', x + (Math.random() * 36 - 18), y + (Math.random() * 10 - 5), { '--dx': (Math.random() * 40 - 20) + 'px' }, 900), i * 45); }
  function dust(x, y, n) { for (let i = 0; i < n; i++) particle('bdust', x + (Math.random() * 30 - 15), y - 4, { '--dx': ((i % 2 ? 1 : -1) * (8 + Math.random() * 18)) + 'px' }, 550); }
  function stars(x, y, n) { for (let i = 0; i < n; i++) particle('bstar', x, y + (Math.random() * 20 - 10), { '--dx': (Math.random() * 44 - 22) + 'px', '--dy': (-8 - Math.random() * 26) + 'px' }, 600); }

  // ---------------------------------------------------------------- döngü kontrolü
  const buddies = [];
  let rafOn = false, last = 0;
  function wake() { if (!rafOn) { rafOn = true; last = performance.now(); requestAnimationFrame(loop); } }
  const blocked = () => document.hidden || layer.classList.contains('off') || layer.classList.contains('hidden-away') || document.body.classList.contains('sheet-open') || document.body.classList.contains('dragging');
  const perchUsed = new Set();
  function perchSpots() {
    return [...document.querySelectorAll('.col-head')].filter(h => {
      const r = h.getBoundingClientRect();
      return r.top > 96 && r.bottom < innerHeight - 140 && r.width > 90 && r.left > -20 && r.right < W() + 20;
    });
  }

  // ---------------------------------------------------------------- buddy
  class Buddy {
    constructor(sprite, i, n) {
      this.sprite = sprite; this.id = sprite.id;
      this.R = Object.assign({ idle: 0, blink: 1, walk: null, held: null, land: null }, sprite.roles || {});
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
      this.mode = 'idle'; this.targetX = 0; this.perchEl = null; this.friend = null;
      this.walkPhase = 0; this.walkDist = 0; this.landUntil = 0; this.happyUntil = 0; this.blinkUntil = 0;
      this.lastTap = 0; this.taps = 0; this.lastInteract = performance.now();
      this.pendingHop = 0; this.landed = false; this.userThrew = false; this.bounces = 0;
      this.bind(); this.scheduleThink(); this.scheduleBlink();
      this.render(true);
    }
    role(name) { const r = this.R[name]; return r == null ? (name === 'blink' ? this.R.blink ?? 0 : this.R.idle ?? 0) : r; }
    // ---- etkileşim (pending → grab/tap → release)
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
          if (Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) { this.cancelPending(); return; }
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
      this.leaveModes();
      this.held = true; this.el.classList.add('held');
      try { this.el.setPointerCapture(pointerId); } catch {}
      document.addEventListener('touchmove', preventScroll, { passive: false });
      this.grabDX = (p ? p.x : cx) - this.x; this.grabDY = (p ? p.y : cy) - this.y;
      this.tx = cx - this.grabDX; this.ty = cy - this.grabDY;
      this.samples = [{ t: performance.now(), x: cx, y: cy }];
      this.vx = 0; this.vy = 0; this.onFloor = false;
      this.tsx = .92; this.tsy = 1.08;
      if (Math.random() < 0.3) this.say('!');
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
      this.vx = vx; this.vy = vy; this.onFloor = false; this.landed = false; this.userThrew = true; this.bounces = 0;
      if (sp > 1400 && Math.random() < 0.25) this.say('yaşasınnn!');
      this.tsx = 1; this.tsy = 1;
      this.lastInteract = performance.now();
      wake();
    }
    tap() {
      const now = performance.now();
      const dbl = now - this.lastTap < CFG.dblMs; this.lastTap = now; this.taps++;
      this.lastInteract = now;
      this.leaveModes();
      this.vy = dbl ? -900 : -520; this.vx = (Math.random() - 0.5) * 160; this.onFloor = false; this.landed = false; this.bounces = 0;
      hearts(this.x + this.w / 2, this.y + this.h * 0.3, dbl ? 10 : 5);
      this.happyUntil = now + 700;
      switch (this.id) {
        case 'flork': this.say('!'); break;
        case 'kedi': this.say(this.taps % 3 === 0 ? 'mrrr' : 'miyav'); break;
        case 'top': this.squash(1.25, .75); break;
        case 'hayalet': this.el.classList.add('ghosty'); this.vy -= 120; setTimeout(() => this.el.classList.remove('ghosty'), 260); break;
        case 'tavsan': this.pendingHop = -300; break;
        case 'bibble': this.say(this.taps % 2 ? 'hmph.' : 'pürtük!'); break;
        case 'ayi': hearts(this.x + this.w / 2, this.y, 2); break;
      }
      if (!['flork', 'kedi', 'bibble'].includes(this.id)) this.say(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
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
    setFrame(i) { i = Math.max(0, Math.min(i, this.sprite.frames.length - 1)); if (this.frame === i) return; this.frame = i; drawFrame(this.canvas, this.sprite, i); }
    wakeUp() { this.sleeping = false; this.el.classList.remove('zzz'); }
    leaveModes() {
      if (this.mode === 'perch' && this.perchEl) perchUsed.delete(this.perchEl);
      if (this.friend && this.friend.mode === 'flee') this.friend.mode = 'idle';
      this.mode = 'idle'; this.perchEl = null; this.friend = null;
    }
    // ---- düşünce: ne yapayım?
    scheduleThink() {
      clearTimeout(this.thinkT);
      this.thinkT = setTimeout(() => { try { this.think(); } catch {} this.scheduleThink(); }, CFG.thinkMin + Math.random() * (CFG.thinkMax - CFG.thinkMin));
    }
    think() {
      if (blocked() || this.held || reduced) return;
      const now = performance.now();
      if (this.mode === 'perch') {
        this.perchTicks = (this.perchTicks || 0) + 1;
        if (this.perchTicks > 2 + Math.random() * 3) { this.hopOff(); }
        else if (Math.random() < 0.5) { this.dir *= -1; if (Math.random() < 0.35) this.say(PERCH_PHRASES[Math.floor(Math.random() * PERCH_PHRASES.length)]); }
        return;
      }
      if (!this.onFloor || this.mode !== 'idle') return;
      if (this.sleeping) { if (Math.random() < 0.3) this.wakeUp(); return; }
      const r = Math.random();
      if (r < 0.26) { // yürüyüş
        this.targetX = 8 + Math.random() * Math.max(20, fabZone() - 16 - this.w);
        this.mode = 'walk'; this.dir = this.targetX > this.x ? 1 : -1; wake();
      } else if (r < 0.40) { // arkadaş ziyareti
        const others = buddies.filter(b => b !== this && !b.held && b.onFloor && b.mode !== 'perch');
        if (others.length) { this.friend = others[Math.floor(Math.random() * others.length)]; this.mode = 'visit'; wake(); }
      } else if (r < 0.50 && this.sprite.frames.length > 2) { // tüneme
        const spots = perchSpots().filter(s => !perchUsed.has(s));
        if (spots.length) { this.perchEl = spots[Math.floor(Math.random() * spots.length)]; perchUsed.add(this.perchEl); this.mode = 'perch-approach'; wake(); }
      } else if (r < 0.57 && fabEl()) { // FAB dürtme
        this.mode = 'fab-approach'; wake();
      } else if (r < 0.70) { // zıpla
        this.vy = -(300 + Math.random() * 220); this.onFloor = false; wake();
      } else if (r < 0.78) {
        this.dir *= -1; if (Math.random() < 0.3) this.say(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
        this.render(true);
      } else if (now - this.lastInteract > CFG.sleepAfter && Math.random() < 0.6 && !buddies.some(b => b.sleeping && b !== this)) {
        this.sleeping = true; this.el.classList.add('zzz');
      }
    }
    hopOff() {
      if (this.perchEl) perchUsed.delete(this.perchEl);
      this.perchEl = null; this.mode = 'idle';
      this.vy = -120; this.vx = (Math.random() < 0.5 ? -1 : 1) * 60; this.onFloor = false; this.bounces = 0;
      wake();
    }
    scheduleBlink() {
      clearTimeout(this.blinkT);
      this.blinkT = setTimeout(() => {
        if (!blocked() && !this.sleeping && !this.held) { this.blinkUntil = performance.now() + 140; this.applyFace(performance.now()); }
        this.scheduleBlink();
      }, CFG.blinkMin + Math.random() * (CFG.blinkMax - CFG.blinkMin));
    }
    // ---- hedefe yürüme sürücüsü
    drive(dt, now) {
      let target = null, speed = CFG.walkSpeed;
      if (this.mode === 'walk') { target = this.targetX; }
      else if (this.mode === 'visit' && this.friend) {
        if (this.friend.held || this.friend.mode === 'perch') { this.leaveModes(); return; }
        target = this.friend.x + (this.friend.x > this.x ? -this.w - 4 : this.friend.w + 4); speed = CFG.visitSpeed;
      }
      else if (this.mode === 'perch-approach' && this.perchEl) {
        const r = this.perchEl.getBoundingClientRect();
        if (r.width < 60 || r.top < 90) { this.leaveModes(); return; }
        target = r.left + r.width / 2 - this.w / 2; speed = CFG.visitSpeed;
      }
      else if (this.mode === 'fab-approach') {
        const f = fabEl(); if (!f) { this.mode = 'idle'; return; }
        target = f.getBoundingClientRect().left - this.w - 4; speed = CFG.visitSpeed;
      }
      else if (this.mode === 'chase' && this.friend) {
        target = this.friend.x; speed = CFG.chaseSpeed;
        if (now > this.chaseUntil) { this.mode = 'idle'; if (this.friend.mode === 'flee') this.friend.mode = 'idle'; hearts((this.x + this.friend.x) / 2 + this.w / 2, this.y, 4); this.friend = null; return; }
      }
      else if (this.mode === 'flee' && this.fleeFrom) {
        target = this.fleeFrom.x > this.x ? 8 : fabZone() - this.w - 8; speed = CFG.fleeSpeed;
        if (this.fleeFrom.mode !== 'chase') { this.mode = 'idle'; this.fleeFrom = null; return; }
      }
      else return;

      const dx = target - this.x;
      if (Math.abs(dx) < 6 && this.mode !== 'flee' && this.mode !== 'chase') { this.arrive(now); return; }
      this.vx = Math.sign(dx) * speed;
      this.dir = dx > 0 ? 1 : -1;
    }
    arrive(now) {
      const m = this.mode;
      if (m === 'walk') { this.mode = 'idle'; this.vx = 0; }
      else if (m === 'visit' && this.friend) {
        const f = this.friend;
        this.vx = 0; this.dir = f.x > this.x ? 1 : -1; f.dir = -this.dir;
        this.mode = 'idle';
        const r = Math.random();
        hearts((this.x + f.x + this.w) / 2, Math.min(this.y, f.y), 3);
        if (r < 0.25 && !f.held) { f.vx += this.dir * 190; f.vy = -140; f.onFloor = false; f.say('hop!'); this.say('pardon 🙊'); }
        else if (r < 0.4 && !f.held) { this.mode = 'chase'; this.chaseUntil = now + 2800; f.mode = 'flee'; f.fleeFrom = this; f.say('yakalayamazsın!'); }
        else { if (Math.random() < 0.6) this.say('♥'); if (Math.random() < 0.4) f.say('♥'); f.happyUntil = now + 800; this.happyUntil = now + 800; this.friend = null; }
      }
      else if (m === 'perch-approach' && this.perchEl) {
        const r = this.perchEl.getBoundingClientRect();
        const dh = Math.max(40, this.y - (r.top - this.h));
        this.vy = -Math.sqrt(2 * CFG.gravity * dh) - 90;
        this.vx = 0; this.onFloor = false; this.mode = 'perch-jump'; this.bounces = 0;
      }
      else if (m === 'fab-approach') {
        this.vy = -640; this.vx = 40; this.onFloor = false; this.mode = 'fab-jump'; this.bounces = 0;
      }
      else { this.mode = 'idle'; this.vx = 0; }
    }
    // ---- fizik + durum
    step(dt, now) {
      if (this.held) {
        this.x += (this.tx - this.x) * Math.min(1, 0.38 * 60 * dt); this.y += (this.ty - this.y) * Math.min(1, 0.38 * 60 * dt);
        const s = this.samples; const vx = s && s.length > 1 ? (s[s.length - 1].x - s[0].x) / Math.max(0.016, (s[s.length - 1].t - s[0].t) / 1000) : 0;
        this.rot = Math.max(-14, Math.min(14, vx / 40));
        this.applyFace(now);
        return true;
      }
      if (reduced) { this.x = Math.max(0, Math.min(W() - this.w, this.x)); this.y = floorY() - this.h; this.onFloor = true; this.rot = 0; this.applyFace(now); return false; }

      // tünemiş: elemente yapış
      if (this.mode === 'perch' && this.perchEl) {
        const r = this.perchEl.getBoundingClientRect();
        if (r.width < 60 || r.top < 80 || r.bottom > innerHeight - 100 || r.right < 30 || r.left > W() - 30) { this.hopOff(); }
        else {
          const nx = Math.max(r.left + 2, Math.min(r.right - 2 - this.w, this.x));
          const ny = r.top - this.h + 3;
          const moved = Math.abs(nx - this.x) > 0.5 || Math.abs(ny - this.y) > 0.5;
          this.x = nx; this.y = ny; this.rot = 0; this.sx = 1; this.sy = 1; this.vx = 0; this.vy = 0;
          this.applyFace(now);
          return moved;
        }
      }

      if (this.onFloor) this.drive(dt, now);
      // FAB bölgesinde amaçsız durma → sola yürü
      if (this.onFloor && this.mode === 'idle' && this.x + this.w > fabZone()) { this.vx = -120; this.dir = -1; }

      this.vy += CFG.gravity * dt;
      if (!this.onFloor) this.vx *= Math.max(0, 1 - CFG.airDrag * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;

      // tüneme yakalama
      if (this.mode === 'perch-jump' && this.perchEl && this.vy > -200) {
        const r = this.perchEl.getBoundingClientRect();
        if (this.y <= r.top - this.h + 6 && this.x + this.w > r.left && this.x < r.right) {
          this.mode = 'perch'; this.perchTicks = 0; this.vy = 0; this.vx = 0;
          this.y = r.top - this.h + 3; this.squash(1.15, .85); dust(this.x + this.w / 2, this.y + this.h, 3);
          this.applyFace(now); return true;
        }
        if (this.vy > 300) { this.leaveModes(); } // kaçırdı
      }
      // FAB dürtme yakalama
      if (this.mode === 'fab-jump') {
        const f = fabEl();
        if (f) {
          const r = f.getBoundingClientRect();
          if (this.x + this.w > r.left && this.x < r.right && this.y + this.h > r.top && this.y < r.bottom) {
            f.classList.remove('nudge'); void f.offsetWidth; f.classList.add('nudge');
            this.say('+?'); stars(r.left + r.width / 2, r.top, 3);
            this.vx = -180; this.vy = -160; this.mode = 'idle';
          }
        }
        if (this.vy > 400) this.mode = 'idle';
      }

      const fy = floorY() - this.h;
      if (this.y >= fy) {
        if (!this.onFloor) {
          const k = Math.max(0, Math.min(.32, Math.abs(this.vy) / 2400));
          if (this.vy > 200) { this.sx = 1 + k; this.sy = 1 - k; this.landUntil = now + 150; }
          if (this.vy > 700) dust(this.x + this.w / 2, fy + this.h, this.vy > 1300 ? 6 : 4);
          if (!this.landed && this.userThrew && this.vy > 600) { this.landed = true; this.userThrew = false; try { navigator.vibrate?.(6); } catch {} }
          if (this.vy > 1500) this.say('uff!');
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
        if (this.mode === 'idle') this.vx *= Math.max(0, 1 - CFG.floorFriction * dt);
        if (Math.abs(this.vx) < 12 && this.mode === 'idle') this.vx = 0;
      } else this.onFloor = false;
      if (this.y < -2 * this.h) { this.y = -2 * this.h; this.vy = Math.abs(this.vy) * 0.3; }
      if (this.x < 0) { this.x = 0; if (Math.abs(this.vx) > 400) stars(4, this.y + this.h / 2, 3); this.vx = Math.abs(this.vx) * CFG.wallBounce; this.dir = 1; this.sx = .8; this.sy = 1.16; }
      if (this.x > W() - this.w) { this.x = W() - this.w; if (Math.abs(this.vx) > 400) stars(W() - 8, this.y + this.h / 2, 3); this.vx = -Math.abs(this.vx) * CFG.wallBounce; this.dir = -1; this.sx = .8; this.sy = 1.16; }
      if (Math.abs(this.vx) > 10 && this.mode === 'idle') this.dir = this.vx > 0 ? 1 : -1;

      // yürüme kare fazı
      if (this.onFloor && Math.abs(this.vx) > 20) { this.walkDist += Math.abs(this.vx) * dt; if (this.walkDist > CFG.walkStepPx) { this.walkDist = 0; this.walkPhase++; } }

      // biçim
      const sp = Math.hypot(this.vx, this.vy);
      const airSy = 1 + Math.min(.14, sp / 7000);
      this.tsx = this.onFloor ? 1 : 1 / airSy; this.tsy = this.onFloor ? 1 : airSy;
      const lerp = Math.min(1, 14 * dt);
      this.sx += (this.tsx - this.sx) * lerp; this.sy += (this.tsy - this.sy) * lerp;
      if (this.id === 'top' && this.mode !== 'perch') { this.roll += this.vx * dt * (360 / (Math.PI * this.w)); this.rot = this.roll; }
      else this.rot = this.onFloor ? 0 : Math.max(-14, Math.min(14, this.vx * 0.02));

      this.applyFace(now);
      const moving = !this.onFloor || Math.abs(this.vx) > 8 || Math.abs(this.sx - 1) > 0.01 || Math.abs(this.sy - 1) > 0.01 || this.mode !== 'idle';
      return moving;
    }
    applyFace(now) {
      let f;
      if (this.held) f = this.role('held');
      else if (now < this.landUntil) f = this.role('land');
      else if (this.sleeping) f = this.role('blink');
      else if (!this.onFloor && this.mode !== 'perch' && Math.hypot(this.vx, this.vy) > 750) f = this.role('held');
      else if (this.onFloor && Math.abs(this.vx) > 20 && this.R.walk) f = this.R.walk[this.walkPhase % this.R.walk.length];
      else if (now < this.happyUntil || now < this.blinkUntil) f = this.role('blink');
      else f = this.role('idle');
      this.setFrame(f);
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
      if (a.mode !== 'idle' || b.mode !== 'idle') continue;
      const minD = (a.w + b.w) * 0.42;
      const d = (b.x + b.w / 2) - (a.x + a.w / 2);
      if (Math.abs(d) < minD) { const push = (minD - Math.abs(d)) * 0.12; const s = d >= 0 ? 1 : -1; a.x -= push * s; b.x += push * s; }
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

  let wasBlocked = false;
  const mo = new MutationObserver(() => {
    const b = document.body.classList.contains('dragging') || document.body.classList.contains('sheet-open');
    if (b) buddies.forEach(bd => { if (bd.mode === 'chase' || bd.mode === 'flee') bd.leaveModes(); });
    if (wasBlocked && !b) { buddies.forEach((bd, i) => setTimeout(() => { if (!bd.held && bd.mode !== 'perch') { bd.vy = -240; bd.onFloor = false; wake(); } }, i * 50)); }
    wasBlocked = b;
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', () => { buddies.forEach(b => { if (b.mode === 'perch') b.hopOff(); b.x = Math.min(b.x, Math.max(0, W() - b.w)); if (b.onFloor) b.y = floorY() - b.h; b.render(true); }); wake(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  // dış dünya
  window.EV_BUDDY_CHEER = () => {
    buddies.forEach((b, i) => setTimeout(() => {
      if (b.held) return;
      if (b.mode === 'perch') { b.happyUntil = performance.now() + 1200; b.say('🎉'); return; }
      b.leaveModes(); b.vy = -600; b.onFloor = false; b.landed = false; b.bounces = 0;
      hearts(b.x + b.w / 2, b.y, 3); b.happyUntil = performance.now() + 900; wake();
    }, i * 60));
  };
  window.EV_BUDDY_SET = (on) => { layer.classList.toggle('hidden-away', !on); if (on) wake(); };
})();
