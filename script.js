/* ============================================================
   SAYED — BORDER GUARD v6.0 | Full Fix Edition
   ============================================================ */
'use strict';

/* ---------- CONFIG ---------- */
const CFG = {
    W: 960, H: 540,
    GRAV: 1600,
    ACCEL: 2800,
    MAX_RUN: 260,
    FRICTION: 0.78,
    JUMP_V: -580,
    DBL_JUMP_V: -480,
    MAX_FALL: 750,
    CROUCH_MULT: 0.42,
    STAM_DRAIN: 20,
    STAM_REGEN: 26,
    INVULN_TIME: 1.6,
    KILL_Y: 850,
    CHAR_SCALE: 1.55,
    GROUND_Y: 500,          // real ground level
    ENEMY_SPEED: 55,
    ENEMY_RANGE: 90
};

const S = { LOADING:'loading', MENU:'menu', BRIEF:'brief', PLAY:'play', PAUSE:'pause', DONE:'done', FAIL:'fail' };

const SPRITES = {
    idle:   { url: 'https://i.ibb.co/LhsGjz0c/sayed-idle.png',   cols: 4, rows: 1, fps: 6,  loop: true  },
    run:    { url: 'https://i.ibb.co/N6ytgTdD/Sayed-Run.png',    cols: 4, rows: 2, fps: 12, loop: true  },
    jump:   { url: 'https://i.ibb.co/3Yj326G7/sayed-jump.png',   cols: 4, rows: 1, fps: 8,  loop: false },
    fall:   { url: 'https://i.ibb.co/FkwTvrRK/Sayed-fall.png',   cols: 2, rows: 1, fps: 5,  loop: true  },
    crouch: { url: 'https://i.ibb.co/9m41w4r4/Sayed-Crouch.png', cols: 3, rows: 1, fps: 5,  loop: false },
    hero:   { url: 'https://i.ibb.co/nN47cnR9/Sayed.png',        cols: 1, rows: 1, fps: 1,  loop: true  },
    coin:   { url: 'https://i.ibb.co/TqPBgBww/Coin.png',         cols: 1, rows: 1, fps: 1,  loop: true  },
    soul:   { url: 'https://i.ibb.co/n8sjtTq9/Soul-Heart.png',   cols: 1, rows: 1, fps: 1,  loop: true  }
};

/* ---------- SPRITE ---------- */
class Sprite {
    constructor(cfg) {
        this.cfg = cfg;
        this.img = new Image();
        this.loaded = false;
        this.frameW = 64; this.frameH = 64;
        this._done = false;
    }
    load() {
        return new Promise(resolve => {
            const done = ok => {
                if (this._done) return;
                this._done = true;
                if (ok && this.img.width > 0 && this.img.height > 0) {
                    const c = Math.max(1, this.cfg.cols);
                    const r = Math.max(1, this.cfg.rows);
                    this.frameW = Math.floor(this.img.width / c);
                    this.frameH = Math.floor(this.img.height / r);
                    this.loaded = true;
                }
                resolve(this.loaded);
            };
            const to = setTimeout(() => done(false), 8000);
            this.img.onload = () => { clearTimeout(to); done(true); };
            this.img.onerror = () => { clearTimeout(to); done(false); };
            try { this.img.src = this.cfg.url; }
            catch(e) { clearTimeout(to); done(false); }
        });
    }
    frame(i) {
        const c = Math.max(1, this.cfg.cols);
        return {
            sx: (i % c) * this.frameW,
            sy: Math.floor(i / c) * this.frameH,
            sw: this.frameW, sh: this.frameH
        };
    }
}

/* ---------- ASSETS ---------- */
const Assets = {
    sprites: {},
    async loadAll(cb) {
        const keys = Object.keys(SPRITES);
        let loaded = 0;
        keys.forEach(k => this.sprites[k] = new Sprite(SPRITES[k]));
        await Promise.all(keys.map(k => this.sprites[k].load().then(() => {
            loaded++;
            if (cb) cb(loaded / keys.length);
        })));
    },
    get(k) { return this.sprites[k]; }
};

/* ---------- AUDIO ---------- */
const Audio = {
    ctx: null, master: null, music: null, sfx: null,
    vols: { master: .7, music: .35, sfx: .8 },
    nodes: [], musicOn: false,
    init() {
        if (this.ctx) return;
        try {
            const C = window.AudioContext || window.webkitAudioContext;
            this.ctx = new C();
            this.master = this.ctx.createGain();
            this.music = this.ctx.createGain();
            this.sfx = this.ctx.createGain();
            this.master.gain.value = this.vols.master;
            this.music.gain.value = this.vols.music;
            this.sfx.gain.value = this.vols.sfx;
            this.music.connect(this.master);
            this.sfx.connect(this.master);
            this.master.connect(this.ctx.destination);
        } catch(e) {}
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVol(k, v) {
        this.vols[k] = v;
        if (!this.ctx) return;
        if (k === 'master') this.master.gain.value = v;
        if (k === 'music') this.music.gain.value = v;
        if (k === 'sfx') this.sfx.gain.value = v;
    },
    tone(f, d, t = 'sine', g = .3, delay = 0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const gn = this.ctx.createGain();
        o.type = t;
        o.frequency.setValueAtTime(f, now);
        gn.gain.setValueAtTime(0, now);
        gn.gain.linearRampToValueAtTime(g, now + .01);
        gn.gain.exponentialRampToValueAtTime(.001, now + d);
        o.connect(gn); gn.connect(this.sfx);
        o.start(now); o.stop(now + d + .05);
    },
    noise(d, g = .2, fq = 800) {
        if (!this.ctx) return;
        const bs = Math.floor(this.ctx.sampleRate * d);
        const buf = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bs; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = fq;
        const gn = this.ctx.createGain();
        gn.gain.setValueAtTime(g, this.ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + d);
        src.connect(f); f.connect(gn); gn.connect(this.sfx);
        src.start();
    },
    play(n) { const f = this.lib[n]; if (f) f(); },
    lib: {
        jump()  { Audio.tone(420, .12, 'square', .18); Audio.tone(640, .1, 'square', .12, .06); },
        djump() { Audio.tone(600, .1, 'square', .18); Audio.tone(900, .12, 'square', .14, .05); },
        land()  { Audio.tone(120, .15, 'sine', .2); Audio.noise(.12, .15, 400); },
        step()  { Audio.noise(.04, .05, 600); },
        pick()  { Audio.tone(880, .1, 'sine', .25); Audio.tone(1320, .12, 'sine', .2, .08); },
        soul()  { [659,880,1047].forEach((f,i)=>Audio.tone(f,.2,'sine',.22,i*.08)); },
        check() { [523,659,784].forEach((f,i)=>Audio.tone(f,.18,'sine',.25,i*.1)); },
        hurt()  { Audio.tone(150, .25, 'sawtooth', .25); Audio.noise(.2, .2, 300); },
        radio() { Audio.tone(1200, .04, 'square', .15); Audio.tone(1500, .04, 'square', .15, .08); },
        done()  { [523,659,784,1047,1319].forEach((f,i)=>Audio.tone(f,.3,'sine',.28,i*.14)); },
        fail()  { [400,320,240,160].forEach((f,i)=>Audio.tone(f,.4,'sawtooth',.22,i*.18)); },
        select(){ Audio.tone(900, .08, 'sine', .18); },
        rock()  { Audio.noise(.4, .25, 300); Audio.tone(80, .3, 'sawtooth', .2); },
        combo() { Audio.tone(1400, .08, 'sine', .15); Audio.tone(1800, .1, 'sine', .12, .05); }
    },
    startMusic() {
        if (!this.ctx || this.musicOn) return;
        this.musicOn = true;
        [130.81, 146.83, 174.61, 196.00].forEach((f, i) => {
            const o = this.ctx.createOscillator();
            o.type = 'sine'; o.frequency.value = f;
            const g = this.ctx.createGain();
            g.gain.value = .10 / (i + 1);
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = .05 + i * .02;
            const lg = this.ctx.createGain();
            lg.gain.value = .04;
            lfo.connect(lg); lg.connect(g.gain);
            o.connect(g); g.connect(this.music);
            o.start(); lfo.start();
            this.nodes.push(o, lfo);
        });
    },
    stopMusic() {
        this.nodes.forEach(n => { try { n.stop(); } catch(e){} });
        this.nodes = []; this.musicOn = false;
    }
};

/* ---------- INPUT ---------- */
const Input = {
    keys: { left:false, right:false, jump:false, crouch:false, interact:false },
    prev: { left:false, right:false, jump:false, crouch:false, interact:false },
    just: { jump:false, interact:false },
    map: {
        'ArrowLeft':'left','KeyA':'left',
        'ArrowRight':'right','KeyD':'right',
        'ArrowUp':'jump','KeyW':'jump',
        'Space':'jump',
        'ArrowDown':'crouch','KeyS':'crouch',
        'KeyE':'interact','Enter':'interact'
    },
    init() {
        // Keydown — prevent default ONLY for game keys (not F5/F12/etc.)
        window.addEventListener('keydown', e => {
            const a = this.map[e.code];
            if (a) { this.keys[a] = true; e.preventDefault(); }
            else if (e.code === 'Escape') {
                e.preventDefault();
                Game.togglePause();
            }
        }, { passive: false });
        window.addEventListener('keyup', e => {
            const a = this.map[e.code];
            if (a) { this.keys[a] = false; e.preventDefault(); }
        }, { passive: false });

        const bind = (id, action) => {
            const el = document.getElementById(id);
            if (!el) return;
            const on = e => { e.preventDefault(); this.keys[action] = true; };
            const off = e => { e.preventDefault(); this.keys[action] = false; };
            el.addEventListener('touchstart', on, { passive: false });
            el.addEventListener('touchend', off, { passive: false });
            el.addEventListener('touchcancel', off, { passive: false });
            el.addEventListener('mousedown', on);
            el.addEventListener('mouseup', off);
            el.addEventListener('mouseleave', off);
        };
        bind('btnLeft','left'); bind('btnRight','right');
        bind('btnJump','jump'); bind('btnCrouch','crouch');
        bind('btnInteract','interact');
    },
    update() {
        for (const k in this.keys) {
            this.just[k] = this.keys[k] && !this.prev[k];
            this.prev[k] = this.keys[k];
        }
    },
    reset() {
        // Fix: reset just-pressed when window changes
        for (const k in this.keys) {
            this.keys[k] = false;
            this.prev[k] = false;
            this.just[k] = false;
        }
    }
};

/* ---------- CAMERA ---------- */
class Camera {
    constructor() { this.x = 0; this.sm = 0; this.st = 0; this.ox = 0; this.oy = 0; }
    follow(t, ww, dt) {
        const target = t.x + t.w / 2 - CFG.W * 0.38;
        const clamp = Math.max(0, Math.min(target, ww - CFG.W));
        // Faster smooth — 12 instead of 8
        this.x += (clamp - this.x) * Math.min(1, 12 * dt);
    }
    shake(m, t) {
        this.sm = Math.max(this.sm, m);
        this.st = Math.max(this.st, t);
    }
    update(dt) {
        if (this.st > 0) {
            this.st -= dt;
            const f = Math.max(0, this.st);
            this.ox = (Math.random() - .5) * this.sm * f * 2;
            this.oy = (Math.random() - .5) * this.sm * f * 2;
            if (this.st <= 0) { this.sm = 0; this.ox = this.oy = 0; }
        }
    }
}

/* ---------- PARTICLES (with performance cap) ---------- */
class Particle {
    constructor(x, y, vx, vy, life, color, size, grav = 400) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.max = life;
        this.color = color; this.size = size;
        this.grav = grav; this.alive = true;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vy += this.grav * dt; this.vx *= .98;
        this.life -= dt;
        if (this.life <= 0) this.alive = false;
    }
    draw(ctx, cam) {
        const a = Math.max(0, this.life / this.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy;
        const s = this.size * (0.5 + a * 0.5);
        ctx.fillRect(sx - s/2, sy - s/2, s, s);
        ctx.globalAlpha = 1;
    }
}
const Particles = {
    list: [],
    MAX: 150,
    spawn(x, y, n, color, speed = 120, life = .6, grav = 400, size = 2) {
        const allowed = Math.min(n, this.MAX - this.list.length);
        for (let i = 0; i < allowed; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = speed * (.4 + Math.random() * .6);
            this.list.push(new Particle(x, y,
                Math.cos(a) * sp, Math.sin(a) * sp - 40,
                life * (.6 + Math.random() * .5),
                color, size * (.7 + Math.random() * .6), grav));
        }
    },
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            this.list[i].update(dt);
            if (!this.list[i].alive) this.list.splice(i, 1);
        }
    },
    draw(ctx, cam) { for (const p of this.list) p.draw(ctx, cam); },
    clear() { this.list.length = 0; }
};

/* ---------- PLAYER ---------- */
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.w = 42; this.h = 60;
        this.onGround = false;
        this.wasGround = false;
        this.faceRight = true;
        this.hp = 5; this.maxHp = 5;
        this.sp = 100; this.maxSp = 100;
        this.invuln = 0;
        this.crouch = false;
        this.anim = 'idle';
        this.animTimer = 0; this.animFrame = 0;
        this.stepT = 0; this.jumps = 0; this.maxJumps = 2;
        this.alive = true; this.finishLock = false;
        this.sprintT = 0; this.trailT = 0;
        this.falling = false;
        this.fellAt = 0;
    }
    get bounds() {
        const hh = this.crouch ? this.h * .62 : this.h;
        return { x: this.x + 6, y: this.y + (this.h - hh), w: this.w - 12, h: hh };
    }
    setAnim(n) {
        if (this.anim !== n) {
            this.anim = n;
            this.animTimer = 0; this.animFrame = 0;
        }
    }

    update(dt, platforms, worldW) {
        this.wasGround = this.onGround;
        if (this.sprintT > 0) this.sprintT -= dt;
        this.crouch = Input.keys.crouch && this.onGround;

        let ix = 0;
        if (Input.keys.left) ix -= 1;
        if (Input.keys.right) ix += 1;
        if (ix !== 0 && !this.finishLock) this.faceRight = ix > 0;

        const sprintMult = this.sprintT > 0 ? 1.4 : 1;
        const maxS = (this.crouch ? CFG.MAX_RUN * CFG.CROUCH_MULT : CFG.MAX_RUN) * sprintMult;

        if (ix !== 0 && !this.finishLock) {
            this.vx += ix * CFG.ACCEL * dt;
            if (Math.abs(this.vx) > maxS) this.vx = Math.sign(this.vx) * maxS;
        } else {
            this.vx *= CFG.FRICTION;
            if (Math.abs(this.vx) < 4) this.vx = 0;
        }

        const running = Math.abs(this.vx) > 60 && !this.crouch && this.onGround;
        if (running) this.sp -= CFG.STAM_DRAIN * dt;
        else this.sp += CFG.STAM_REGEN * dt;
        this.sp = Math.max(0, Math.min(this.maxSp, this.sp));

        if (Input.just.jump && !this.finishLock) {
            if (this.onGround) {
                this.vy = CFG.JUMP_V;
                this.onGround = false;
                this.jumps = 1;
                Audio.play('jump');
                Particles.spawn(this.x + this.w/2, this.y + this.h, 6, '#d4a373', 100, .5, 300, 3);
            } else if (this.jumps < this.maxJumps) {
                this.vy = CFG.DBL_JUMP_V;
                this.jumps++;
                Audio.play('djump');
                Particles.spawn(this.x + this.w/2, this.y + this.h - 5, 10, '#ffdd88', 140, .6, 200, 3);
            }
        }

        this.vy += CFG.GRAV * dt;
        if (this.vy > CFG.MAX_FALL) this.vy = CFG.MAX_FALL;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.x = Math.max(0, Math.min(this.x, worldW - this.w));

        // ============ COLLISION ============
        this.onGround = false;
        const b = this.bounds;
        for (const p of platforms) {
            if (b.x + b.w > p.x && b.x < p.x + p.w &&
                b.y + b.h > p.y && b.y < p.y + p.h) {
                const oX = Math.min(b.x + b.w - p.x, p.x + p.w - b.x);
                const oY = Math.min(b.y + b.h - p.y, p.y + p.h - b.y);
                if (oY < oX) {
                    if (this.vy > 0 && b.y + b.h - this.vy * dt <= p.y + 8) {
                        // Landing on top
                        this.y = p.y - this.h;
                        if (!this.wasGround && this.vy > 200) {
                            Audio.play('land');
                            Particles.spawn(this.x + this.w/2, this.y + this.h, 8, '#d4a373', 80, .4, 300, 3);
                        }
                        this.vy = 0;
                        this.onGround = true;
                        this.jumps = 0;
                    } else if (this.vy < 0 && b.y - this.vy * dt >= p.y + p.h - 8) {
                        // Head bump
                        this.y = p.y + p.h;
                        this.vy = 0;
                    }
                } else {
                    // Horizontal collision
                    if (this.vx > 0) this.x = p.x - this.w;
                    else if (this.vx < 0) this.x = p.x + p.w;
                    this.vx = 0;
                }
            }
        }

        // IMPORTANT FIX: No universal ground. Player falls into gaps.
        // Only the platform collision keeps the player on ground.

        if (this.invuln > 0) this.invuln -= dt;

        // Falling into pit — death
        if (this.y > CFG.KILL_Y) {
            if (!this.falling) {
                this.falling = true;
                this.fellAt = performance.now();
            }
            // After 0.5s of falling, take damage + respawn at checkpoint
            if (performance.now() - this.fellAt > 500) {
                this.falling = false;
                this.hurt(true);
            }
        } else {
            this.falling = false;
        }

        // Footstep sounds
        if (this.onGround && Math.abs(this.vx) > 60) {
            this.stepT -= dt;
            if (this.stepT <= 0) {
                this.stepT = .28;
                Audio.play('step');
                Particles.spawn(this.x + this.w/2, this.y + this.h, 2, '#b8a888', 40, .3, 200, 1.5);
            }
        }

        // Anim
        if (!this.onGround) this.setAnim(this.vy < 0 ? 'jump' : 'fall');
        else if (this.crouch) this.setAnim('crouch');
        else if (Math.abs(this.vx) > 20) this.setAnim('run');
        else this.setAnim('idle');

        const s = Assets.get(this.anim);
        if (s && s.loaded) {
            const fps = (s.cfg.fps || 8) * (running ? 1.15 : 1);
            this.animTimer += dt;
            if (this.animTimer >= 1 / fps) {
                this.animTimer -= 1 / fps;
                const total = s.cfg.cols * s.cfg.rows;
                if (s.cfg.loop) this.animFrame = (this.animFrame + 1) % total;
                else this.animFrame = Math.min(this.animFrame + 1, total - 1);
            }
        }
    }

    hurt(force) {
        if (this.invuln > 0 && !force) return;
        this.hp--;
        this.invuln = CFG.INVULN_TIME;
        Audio.play('hurt');
        Particles.spawn(this.x + this.w/2, this.y + this.h/2, 14, '#ff4444', 160, .7, 400, 3);
        if (Game.cam) Game.cam.shake(8, .4);
        if (force) {
            this.x = Level.checkpoint.x;
            this.y = Level.checkpoint.y;
            this.vx = 0; this.vy = 0;
            this.falling = false;
        }
        if (this.hp <= 0) {
            this.hp = 0; this.alive = false;
            Game.fail();
        }
    }
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    shield(t) { this.invuln = Math.max(this.invuln, t); }

    draw(ctx, cam) {
        const s = Assets.get(this.anim);
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy;

        if (this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0) ctx.globalAlpha = .5;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath();
        ctx.ellipse(sx + this.w/2, sy + this.h + 3, this.w * .6, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield
        if (this.invuln > .3) {
            ctx.strokeStyle = `rgba(80,180,255,${.5 + Math.sin(performance.now() * .02) * .3})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(sx + this.w/2, sy + this.h/2, this.w * 1.15, this.h * .95, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (s && s.loaded) {
            const r = s.frame(this.animFrame);
            const destH = this.h * CFG.CHAR_SCALE;
            const destW = destH * (r.sw / r.sh);
            const dx = sx + this.w/2 - destW/2;
            const dy = sy + this.h - destH;
            ctx.save();
            if (!this.faceRight) {
                ctx.translate(dx + destW/2, dy + destH/2);
                ctx.scale(-1, 1);
                ctx.drawImage(s.img, r.sx, r.sy, r.sw, r.sh, -destW/2, -destH/2, destW, destH);
            } else {
                ctx.drawImage(s.img, r.sx, r.sy, r.sw, r.sh, dx, dy, destW, destH);
            }
            ctx.restore();
        } else {
            this.fallback(ctx, sx, sy);
        }
        ctx.globalAlpha = 1;
    }
    fallback(ctx, sx, sy) {
        const hh = this.crouch ? this.h * .62 : this.h;
        const yo = this.crouch ? this.h * .38 : 0;
        ctx.fillStyle = '#c8b590';
        ctx.fillRect(sx + 6, sy + yo + 16, this.w - 12, hh - 22);
        ctx.fillStyle = '#5a6a4a';
        ctx.fillRect(sx + 9, sy + yo + 20, this.w - 18, hh - 28);
        ctx.fillStyle = '#d4a373';
        ctx.beginPath(); ctx.arc(sx + this.w/2, sy + yo + 11, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a7a5a';
        ctx.beginPath(); ctx.arc(sx + this.w/2, sy + yo + 9, 13, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#2a4a6a';
        ctx.fillRect(sx - 3, sy + yo + 20, 9, 24);
    }
}

/* ---------- COIN ---------- */
class Coin {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.w = 26; this.h = 26; this.taken = false;
        this.bob = Math.random() * Math.PI * 2;
        this.rot = 0;
    }
    update(dt) { this.bob += dt * 2.4; this.rot += dt * 3; }
    draw(ctx, cam) {
        if (this.taken) return;
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy + Math.sin(this.bob) * 5;
        const s = this.type === 'soul' ? Assets.get('soul') : Assets.get('coin');
        if (s && s.loaded) {
            ctx.save();
            // Simpler shadow for performance
            ctx.shadowColor = this.type === 'soul' ? '#ff66aa' : '#ffdd00';
            ctx.shadowBlur = 10;
            ctx.translate(sx + 13, sy + 13);
            if (this.type === 'coin') ctx.rotate(Math.sin(this.rot) * .15);
            ctx.drawImage(s.img, -16, -16, 32, 32);
            ctx.restore();
        } else {
            ctx.fillStyle = this.type === 'soul' ? '#ff88cc' : '#ffdd00';
            ctx.beginPath(); ctx.arc(sx + 13, sy + 13, 12, 0, Math.PI * 2); ctx.fill();
        }
    }
    bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

/* ---------- CHECKPOINT ---------- */
class Checkpoint {
    constructor(x, y) { this.x = x; this.y = y; this.on = false; this.pulse = 0; }
    update(dt) { this.pulse += dt * 4; }
    draw(ctx, cam) {
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy;
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(sx + 10, sy + 44, 6, 6);
        ctx.fillStyle = '#8a8a8a'; ctx.fillRect(sx + 12, sy, 3, 44);
        ctx.fillStyle = this.on ? '#44ff44' : '#ff4444';
        ctx.beginPath(); ctx.arc(sx + 13.5, sy - 3, 5, 0, Math.PI * 2); ctx.fill();
        if (this.on) {
            ctx.globalAlpha = (.6 + Math.sin(this.pulse) * .4) * .6;
            ctx.beginPath(); ctx.arc(sx + 13.5, sy - 3, 12, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = this.on ? '#44dd44' : '#dd4444';
        ctx.beginPath();
        ctx.moveTo(sx + 15, sy + 4);
        ctx.lineTo(sx + 30, sy + 12);
        ctx.lineTo(sx + 15, sy + 20);
        ctx.closePath(); ctx.fill();
    }
    bounds() { return { x: this.x - 6, y: this.y - 10, w: 38, h: 64 }; }
}

/* ---------- OBSTACLE ---------- */
class Obstacle {
    constructor(x, y, w, h, type) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.type = type;
    }
    draw(ctx, cam) {
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy;
        if (this.type === 'rock') {
            ctx.fillStyle = '#7a6a5a';
            ctx.beginPath();
            ctx.moveTo(sx, sy + this.h);
            ctx.lineTo(sx + this.w * .25, sy + 4);
            ctx.lineTo(sx + this.w * .55, sy);
            ctx.lineTo(sx + this.w * .85, sy + 8);
            ctx.lineTo(sx + this.w, sy + this.h);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#9a8a7a';
            ctx.beginPath();
            ctx.moveTo(sx + this.w * .25, sy + 4);
            ctx.lineTo(sx + this.w * .55, sy);
            ctx.lineTo(sx + this.w * .6, sy + this.h);
            ctx.lineTo(sx + this.w * .35, sy + this.h);
            ctx.closePath(); ctx.fill();
        } else if (this.type === 'cactus') {
            ctx.fillStyle = '#2a5a2a';
            ctx.fillRect(sx + this.w/2 - 5, sy, 10, this.h);
            ctx.fillRect(sx, sy + this.h * .35, this.w, 7);
            ctx.fillRect(sx, sy + this.h * .15, 6, 15);
            ctx.fillStyle = '#3a7a3a';
            ctx.fillRect(sx + this.w/2 - 4, sy + 4, 3, this.h - 8);
        }
    }
    bounds() { return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 }; }
}

/* ---------- ENEMY (new!) ---------- */
class Enemy {
    constructor(x, y, range, speed) {
        this.startX = x;
        this.x = x; this.y = y;
        this.w = 32; this.h = 48;
        this.range = range || CFG.ENEMY_RANGE;
        this.speed = speed || CFG.ENEMY_SPEED;
        this.dir = 1;
        this.bob = 0;
    }
    update(dt) {
        this.bob += dt * 4;
        this.x += this.dir * this.speed * dt;
        if (this.x > this.startX + this.range) { this.x = this.startX + this.range; this.dir = -1; }
        if (this.x < this.startX - this.range) { this.x = this.startX - this.range; this.dir = 1; }
    }
    draw(ctx, cam) {
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.ellipse(sx + this.w/2, sy + this.h + 2, this.w * .5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#3a3a2a';
        ctx.fillRect(sx + 4, sy + 12, this.w - 8, this.h - 20);
        // Head
        ctx.fillStyle = '#8a6a4a';
        ctx.beginPath(); ctx.arc(sx + this.w/2, sy + 9, 9, 0, Math.PI * 2); ctx.fill();
        // Helmet
        ctx.fillStyle = '#2a2a1a';
        ctx.beginPath(); ctx.arc(sx + this.w/2, sy + 7, 10, Math.PI, 0); ctx.fill();
        // Eye
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(sx + this.w/2 - 3, sy + 8, 6, 2);
        // Vest
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(sx + 7, sy + 18, this.w - 14, 12);
        // Direction arrow
        ctx.fillStyle = '#ff8844';
        const ax = this.dir > 0 ? sx + this.w + 4 : sx - 4;
        ctx.beginPath();
        ctx.moveTo(ax, sy + this.h/2);
        ctx.lineTo(ax + this.dir * 8, sy + this.h/2 - 4);
        ctx.lineTo(ax + this.dir * 8, sy + this.h/2 + 4);
        ctx.closePath(); ctx.fill();
    }
    bounds() { return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 }; }
}

/* ---------- ROCK ---------- */
class Rock {
    constructor(x, y) {
        this.x = x; this.y = y; this.vy = 0;
        this.size = 14 + Math.random() * 10;
        this.alive = true;
        this.rot = Math.random() * Math.PI;
        this.rotS = (Math.random() - .5) * 6;
        this.delay = .6; this.warned = false;
    }
    update(dt, player) {
        if (this.delay > 0) { this.delay -= dt; return; }
        if (!this.warned) { this.warned = true; Audio.play('rock'); }
        this.vy += 1400 * dt;
        this.y += this.vy * dt;
        this.rot += this.rotS * dt;
        if (this.y > 800) this.alive = false;
        const b = this.bounds(), pb = player.bounds;
        if (pb.x + pb.w > b.x && pb.x < b.x + b.w &&
            pb.y + pb.h > b.y && pb.y < b.y + b.h) {
            if (player.invuln <= 0) player.hurt();
            this.alive = false;
            Particles.spawn(this.x, this.y, 12, '#8a7a6a', 180, .6, 400, 3);
        }
    }
    draw(ctx, cam) {
        if (this.delay > 0) {
            const sx = this.x - cam.x + cam.ox;
            const sy = this.y - cam.y + cam.oy;
            const a = .4 + Math.sin(this.delay * 30) * .4;
            ctx.strokeStyle = `rgba(255,80,80,${a})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 12, sy); ctx.lineTo(sx + 12, sy);
            ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy + 12);
            ctx.stroke();
            return;
        }
        const sx = this.x - cam.x + cam.ox;
        const sy = this.y - cam.y + cam.oy;
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(this.rot);
        ctx.fillStyle = '#7a6a5a';
        ctx.beginPath();
        ctx.moveTo(-this.size, 0);
        ctx.lineTo(-this.size * .5, -this.size);
        ctx.lineTo(this.size * .5, -this.size * .8);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(this.size * .4, this.size * .7);
        ctx.lineTo(-this.size * .6, this.size * .6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    bounds() { return { x: this.x - this.size * .7, y: this.y - this.size * .7, w: this.size * 1.4, h: this.size * 1.4 }; }
}

/* ============ LEVEL DEFINITIONS ============ */
const LEVELS = [
    { id:0, name:'بداية الدورية', op:'DESERT WATCH', grid:'GRID 22-R', time:'05:45', loc:'جبال البحر الأحمر',
      obj:'الوصول إلى نقطة المراقبة', hint:'من جبال مصر إلى السودان.', ww:5500, theme:'night',
      density:{platforms:35, coins:60, obstacles:12, enemies:3, checkpoints:4} },
    { id:1, name:'طريق الجبال', op:'MOUNTAIN PASS', grid:'GRID 24-Q', time:'07:20', loc:'المرتفعات الجبلية',
      obj:'اعبر الطريق الجبلي', hint:'احذر من الانهيارات.', ww:6500, theme:'night',
      density:{platforms:40, coins:70, obstacles:14, enemies:4, checkpoints:5} },
    { id:2, name:'الوادي الصخري', op:'ROCKY VALLEY', grid:'GRID 26-N', time:'09:15', loc:'الوادي الجاف',
      obj:'اعبر الوادي واجمع العملات', hint:'الوادي وعر.', ww:7000, theme:'dawn',
      density:{platforms:44, coins:80, obstacles:16, enemies:5, checkpoints:5} },
    { id:3, name:'العاصفة الرملية', op:'SANDSTORM', grid:'GRID 28-S', time:'11:40', loc:'صحراء مفتوحة',
      obj:'الوصول للمنطقة الآمنة', hint:'احتمِ! العاصفة قادمة.', ww:6500, theme:'storm', storm:true,
      density:{platforms:40, coins:70, obstacles:18, enemies:5, checkpoints:5} },
    { id:4, name:'الكهف الليلي', op:'CAVE PATROL', grid:'GRID 30-K', time:'14:20', loc:'الكهف الجبلي',
      obj:'اعثر على حقيبة الإسعافات', hint:'الظلام دامس.', ww:6000, theme:'cave',
      density:{platforms:38, coins:65, obstacles:14, enemies:5, checkpoints:4} },
    { id:5, name:'إنقاذ الجندي', op:'RESCUE OP', grid:'GRID 32-R', time:'16:55', loc:'منطقة الدوريات',
      obj:'ساعد الجندي العالق', hint:'جندي يحتاج مساعدتك.', ww:6800, theme:'dusk',
      density:{platforms:42, coins:75, obstacles:15, enemies:6, checkpoints:5} },
    { id:6, name:'الطريق الليلي', op:'NIGHT RUN', grid:'GRID 34-N', time:'21:30', loc:'طريق العودة',
      obj:'الوصول قبل الفجر', hint:'الليل طويل.', ww:7200, theme:'night',
      density:{platforms:46, coins:85, obstacles:16, enemies:7, checkpoints:6} },
    { id:7, name:'العودة النهائية', op:'FINAL RETURN', grid:'GRID 36-R', time:'04:50', loc:'نقطة الحراسة',
      obj:'العودة إلى نقطة الحراسة', hint:'آخر مرحلة.', ww:7500, theme:'dawn',
      density:{platforms:50, coins:90, obstacles:18, enemies:8, checkpoints:6} }
];

/* ============ LEVEL BUILDER ============ */
function buildLevel(L) {
    const platforms = [];
    const coins = [];
    const obstacles = [];
    const checkpoints = [];
    const enemies = [];
    const W = L.ww;
    const GY = CFG.GROUND_Y;  // real ground level y

    // Build segments with gaps
    const segmentW = 250;
    const totalSegments = Math.floor(W / segmentW);
    const checkpointInterval = Math.floor(totalSegments / L.density.checkpoints);
    const enemyInterval = Math.floor(totalSegments / L.density.enemies);
    const obstacleInterval = Math.floor(totalSegments / L.density.obstacles);

    let segmentIdx = 0;
    let x = 0;
    let gapCount = 0;

    while (x < W - 300) {
        // Decide segment size
        const segW = 220 + Math.floor(Math.random() * 180);

        // Create gap every 5-8 segments (but not in first 3)
        const makeGap = (segmentIdx > 3 && gapCount < 15 && Math.random() < 0.18);
        if (makeGap) {
            gapCount++;
            x += 90 + Math.floor(Math.random() * 50);
            segmentIdx++;
            continue;
        }

        // Ground platform
        platforms.push({ x, y: GY, w: segW, h: 40 });

        // Elevated platforms (2 per segment max)
        const eCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < eCount; i++) {
            const eH = 90 + Math.floor(Math.random() * 120);
            const eW = 90 + Math.floor(Math.random() * 100);
            const eX = x + 30 + Math.floor(Math.random() * (segW - eW - 60));
            platforms.push({ x: eX, y: GY - eH, w: eW, h: 18 });
        }

        // Coins
        const coinsN = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < coinsN; i++) {
            const t = Math.random() < 0.12 ? 'soul' : 'coin';
            coins.push({
                x: x + 40 + i * 50 + Math.random() * 30,
                y: GY - 40 - Math.random() * 60,
                type: t
            });
        }

        // Obstacles (only on ground of certain segments)
        if (segmentIdx % Math.max(1, Math.floor(totalSegments / L.density.obstacles)) === 0
            && segmentIdx > 2 && segmentIdx < totalSegments - 2) {
            const oX = x + 60 + Math.floor(Math.random() * (segW - 100));
            obstacles.push({
                x: oX,
                y: GY - 22,
                w: 22, h: 22,
                type: Math.random() < .6 ? 'rock' : 'cactus'
            });
        }

        // Checkpoint
        if (segmentIdx > 0 && segmentIdx % Math.max(4, checkpointInterval) === 0
            && checkpoints.length < L.density.checkpoints) {
            checkpoints.push({ x: x + 40, y: GY - 20 });
        }

        // Enemy
        if (segmentIdx > 4 && segmentIdx % Math.max(4, enemyInterval) === 0
            && enemies.length < L.density.enemies) {
            enemies.push({
                x: x + 80,
                y: GY - 48,
                range: 70 + Math.random() * 50,
                speed: 50 + Math.random() * 25
            });
        }

        x += segW + 20;
        segmentIdx++;
    }

    // Final ground segment for finish
    platforms.push({ x: W - 500, y: GY, w: 500, h: 40 });

    return { platforms, coins, obstacles, checkpoints, enemies };
}

/* ============ LEVEL RUNTIME ============ */
const Level = {
    data: null,
    platforms: [], coins: [], obstacles: [], checkpoints: [], enemies: [],
    rocks: [],
    checkpoint: { x: 60, y: 400 },
    startX: 60, startY: CFG.GROUND_Y - 60,
    ww: 5000,
    time: 0, stormT: 0, stormI: 0,
    rockTimer: 0,
    endless: false, chunkId: 0,
    finishX: 0,

    load(idx) {
        this.data = LEVELS[idx];
        this.ww = this.data.ww;
        this.finishX = this.ww - 300;
        const built = buildLevel(this.data);
        this.platforms = built.platforms;
        this.coins = built.coins.map(c => new Coin(c.x, c.y, c.type));
        this.obstacles = built.obstacles.map(o => new Obstacle(o.x, o.y, o.w, o.h, o.type));
        this.checkpoints = built.checkpoints.map(c => new Checkpoint(c.x, c.y));
        this.enemies = built.enemies.map(e => new Enemy(e.x, e.y, e.range, e.speed));
        this.rocks = [];
        this.startX = 60;
        this.startY = CFG.GROUND_Y - 60;
        this.checkpoint = { x: 60, y: this.startY };
        this.time = 0; this.stormT = 0; this.stormI = 0;
        this.rockTimer = 6 + Math.random() * 6;
        this.endless = false; this.chunkId = 0;
        Particles.clear();
    },

    loadEndless() {
        this.data = {
            id: 99, name: 'دورية مفتوحة', op: 'ENDLESS PATROL', grid: 'GRID ∞',
            time: '∞', loc: 'الحدود المصرية السودانية', theme: 'night',
            obj: 'اصمد أطول وقت ممكن', hint: 'ENDLESS — لا نهاية.',
            ww: 100000
        };
        this.ww = 100000;
        this.finishX = Infinity;
        this.platforms = [];
        this.coins = [];
        this.obstacles = [];
        this.checkpoints = [];
        this.enemies = [];
        this.rocks = [];
        this.startX = 60;
        this.startY = CFG.GROUND_Y - 60;
        this.checkpoint = { x: 60, y: this.startY };
        this.time = 0; this.stormT = 0; this.stormI = 0;
        this.rockTimer = 8;
        this.endless = true; this.chunkId = 0;
        this.genChunk();
        Particles.clear();
    },

    genChunk() {
        const cx = this.chunkId * 1600;
        const GY = CFG.GROUND_Y;
        let x = cx;
        const chunkSegs = 5;

        for (let i = 0; i < chunkSegs; i++) {
            const segW = 220 + Math.floor(Math.random() * 120);

            // Ground platform
            this.platforms.push({ x, y: GY, w: segW, h: 40 });

            // Elevated
            if (Math.random() < 0.5) {
                const eH = 100 + Math.floor(Math.random() * 100);
                this.platforms.push({
                    x: x + 30,
                    y: GY - eH,
                    w: 90, h: 18
                });
            }

            // Coins
            for (let k = 0; k < 3; k++) {
                this.coins.push(new Coin(
                    x + 40 + k * 60,
                    GY - 40 - Math.random() * 50,
                    Math.random() < 0.12 ? 'soul' : 'coin'
                ));
            }

            // Obstacles
            if (i > 0 && Math.random() < 0.5) {
                this.obstacles.push(new Obstacle(
                    x + segW * .5,
                    GY - 22,
                    22, 22,
                    Math.random() < .5 ? 'rock' : 'cactus'
                ));
            }

            // Enemy
            if (i > 1 && Math.random() < 0.4) {
                this.enemies.push(new Enemy(
                    x + 60, GY - 48,
                    70 + Math.random() * 40,
                    50 + Math.random() * 25
                ));
            }

            x += segW + 20;
        }

        // Checkpoint at chunk start
        this.checkpoints.push(new Checkpoint(cx + 50, GY - 20));
        this.chunkId++;
    },

    ensureChunk(px) {
        if (!this.endless) return;
        if (px > (this.chunkId * 1600) - 2500) this.genChunk();
    },

    update(dt, player) {
        this.time += dt;
        this.stormT += dt;
        for (const c of this.coins) c.update(dt);
        for (const cp of this.checkpoints) cp.update(dt);
        for (const e of this.enemies) e.update(dt);

        if (this.data.storm && this.stormT > 3) {
            this.stormI = Math.min(1, (this.stormT - 3) / 6);
        }
        if (this.endless) this.ensureChunk(player.x);

        // Falling rocks — spawn above player's nearby area (logical)
        this.rockTimer -= dt;
        if (this.rockTimer <= 0) {
            this.rockTimer = 12 + Math.random() * 10;
            const baseX = player.x + CFG.W * .35;
            const n = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                this.rocks.push(new Rock(
                    baseX + (i - n/2) * 45 + (Math.random() - .5) * 60,
                    player.y - 450
                ));
            }
            UI.radio('⚠ انهيار صخري! احتمِ!', 2200);
            if (Game.cam) Game.cam.shake(5, .5);
        }
        for (let i = this.rocks.length - 1; i >= 0; i--) {
            this.rocks[i].update(dt, player);
            if (!this.rocks[i].alive) this.rocks.splice(i, 1);
        }
    },

    draw(ctx, cam) {
        // Platforms
        for (const p of this.platforms) {
            const sx = p.x - cam.x + cam.ox;
            const sy = p.y - cam.y + cam.oy;
            if (sx + p.w < -100 || sx > CFG.W + 100) continue;
            // Main body
            ctx.fillStyle = '#2a2820';
            ctx.fillRect(sx, sy, p.w, p.h);
            // Rocky top gradient (cached)
            const g = ctx.createLinearGradient(0, sy, 0, sy + 10);
            g.addColorStop(0, '#5a5548');
            g.addColorStop(1, '#3a3528');
            ctx.fillStyle = g;
            ctx.fillRect(sx, sy, p.w, 10);
            // Bottom shadow
            ctx.fillStyle = 'rgba(0,0,0,.4)';
            ctx.fillRect(sx, sy + p.h, p.w, 5);
        }

        for (const o of this.obstacles) o.draw(ctx, cam);
        for (const c of this.checkpoints) c.draw(ctx, cam);
        for (const e of this.enemies) e.draw(ctx, cam);
        for (const c of this.coins) c.draw(ctx, cam);
        for (const r of this.rocks) r.draw(ctx, cam);

        // ============ FINISH FLAG (visible!) ============
        if (!this.endless) {
            const fx = this.finishX - cam.x + cam.ox;
            const fy = CFG.H - 40;

            // Pole
            ctx.fillStyle = '#8a8a8a';
            ctx.fillRect(fx, fy - 140, 6, 140);
            // Flag
            ctx.fillStyle = '#44dd44';
            ctx.beginPath();
            ctx.moveTo(fx + 6, fy - 140);
            ctx.lineTo(fx + 55, fy - 125);
            ctx.lineTo(fx + 6, fy - 110);
            ctx.closePath();
            ctx.fill();
            // Star
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px Tahoma';
            ctx.textAlign = 'center';
            ctx.fillText('★', fx + 22, fy - 118);
            // Base
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(fx - 10, fy - 4, 26, 8);
            // Glow
            const t = performance.now() * 0.003;
            ctx.globalAlpha = .5 + Math.sin(t) * .3;
            ctx.strokeStyle = '#44dd44';
            ctx.lineWidth = 3;
            ctx.strokeRect(fx - 20, fy - 160, 100, 170);
            ctx.globalAlpha = 1;
            // Label
            ctx.fillStyle = '#44dd44';
            ctx.font = 'bold 14px Tahoma';
            ctx.fillText('EXTRACT', fx + 25, fy - 155);
        }
    }
};

/* ============ BACKGROUND (cached for performance) ============ */
const Bg = {
    cache: {},
    themes: {
        night:  { top: '#020210', mid: '#0a0a2a', low: '#151532', bot: '#1a1020', mount1: '#0a0a1a', mount2: '#080814', mount3: '#030308' },
        dawn:   { top: '#3a2050', mid: '#8a4060', low: '#d47050', bot: '#3a1a20', mount1: '#1a1020', mount2: '#100818', mount3: '#050308' },
        dusk:   { top: '#2a1030', mid: '#6a3040', low: '#a06040', bot: '#2a1810', mount1: '#1a0a15', mount2: '#100508', mount3: '#050208' },
        storm:  { top: '#8a6030', mid: '#a08050', low: '#d4a373', bot: '#8a6a40', mount1: '#4a3018', mount2: '#3a2008', mount3: '#2a1008' },
        cave:   { top: '#0a0510', mid: '#100820', low: '#1a1030', bot: '#080410', mount1: '#0a0518', mount2: '#050210', mount3: '#020008' }
    },
    draw(ctx, cam, data) {
        const th = this.themes[data.theme || 'night'];
        const key = data.theme || 'night';

        // Sky gradient (cache)
        if (!this.cache[key]) {
            const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
            g.addColorStop(0, th.top);
            g.addColorStop(.4, th.mid);
            g.addColorStop(.75, th.low);
            g.addColorStop(1, th.bot);
            this.cache[key] = g;
        }
        ctx.fillStyle = this.cache[key];
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        // Stars (only for night/dusk themes)
        if (data.theme === 'night' || data.theme === 'dusk' || data.theme === 'dawn') {
            for (let i = 0; i < 50; i++) {
                const sx = (i * 137 + 30) % CFG.W;
                const sy = (i * 71) % 250;
                ctx.globalAlpha = 0.5 + Math.abs(Math.sin(cam.x * .001 + i * .7)) * .5;
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
            ctx.globalAlpha = 1;
        }

        // Moon (or sun for dawn/dusk)
        const mx = CFG.W * .78, my = 110;
        if (data.theme === 'night' || data.theme === 'cave') {
            ctx.fillStyle = 'rgba(255,240,200,.15)';
            ctx.beginPath(); ctx.arc(mx, my, 70, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f8e8b8';
            ctx.beginPath(); ctx.arc(mx, my, 32, 0, Math.PI * 2); ctx.fill();
        } else if (data.theme === 'dawn' || data.theme === 'dusk') {
            ctx.fillStyle = 'rgba(255,200,120,.35)';
            ctx.beginPath(); ctx.arc(mx, my, 80, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffcc66';
            ctx.beginPath(); ctx.arc(mx, my, 42, 0, Math.PI * 2); ctx.fill();
        } else if (data.theme === 'storm') {
            ctx.fillStyle = 'rgba(255,220,150,.25)';
            ctx.beginPath(); ctx.arc(mx, 100, 60, 0, Math.PI * 2); ctx.fill();
        }

        // Mountain layers
        this.mountains(ctx, cam, .08, 200, th.mount1, 60, 130);
        this.mountains(ctx, cam, .20, 280, th.mount2, 80, 160);
        this.mountains(ctx, cam, .42, 360, th.mount3, 100, 200);

        // Ground band
        ctx.fillStyle = 'rgba(5,5,15,.6)';
        ctx.fillRect(0, CFG.H - 45, CFG.W, 45);
    },
    mountains(ctx, cam, px, baseY, color, amp, spread) {
        const off = (cam.x * px) % spread;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-spread, CFG.H);
        for (let i = -spread; i <= CFG.W + spread * 2; i += 30) {
            const wx = i + off;
            // Smoother mountains — lower frequencies
            const y = baseY + Math.sin(wx * .0015) * amp * .6 + Math.cos(wx * .0035) * amp * .35;
            ctx.lineTo(i, y);
        }
        ctx.lineTo(CFG.W + spread, CFG.H);
        ctx.closePath(); ctx.fill();
    },
    storm(ctx, i, t) {
        if (i <= 0) return;
        ctx.fillStyle = `rgba(140,110,70,${i * .25})`;
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        // Less lines = more perf
        for (let k = 0; k < 35; k++) {
            const sx = ((k * 89 + t * 400 * i) % (CFG.W + 200)) - 100;
            const sy = (k * 53) % CFG.H;
            const len = 20 + Math.random() * 40;
            ctx.strokeStyle = `rgba(200,170,110,${.2 + Math.random() * .25})`;
            ctx.lineWidth = 1 + Math.random();
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(sx - len, sy + 4);
            ctx.stroke();
        }
    },
    darkness(ctx, player, cam) {
        const px = player ? player.x - cam.x + cam.ox : CFG.W / 2;
        const py = player ? player.y - cam.y + cam.oy : CFG.H / 2;
        const v = ctx.createRadialGradient(px, py, 120, px, py, 500);
        v.addColorStop(0, 'rgba(0,0,20,.15)');
        v.addColorStop(1, 'rgba(0,0,20,.75)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, CFG.W, CFG.H);
    }
};

/* ============ UI ============ */
const UI = {
    els: {},
    radioTO: null,
    init() {
        ['hudOp','hudGrid','hudDist','spFill','hudScore','hudCombo','missionText',
         'radioText','radio','ldFill','ldPct','briefNum','briefTitle','briefLoc','briefTime',
         'briefObj','briefHint','cScore','cTime','cItems','cHp','cStars','oScore','oDist',
         'mHigh','missionGrid','hearts','hudCoins','radarPlayer','radarEnemy1','radarEnemy2'
        ].forEach(id => this.els[id] = document.getElementById(id));
    },

    drawHearts(hp, maxHp) {
        if (!this.els.hearts) return;
        if (this.els.hearts.children.length !== maxHp) {
            this.els.hearts.innerHTML = '';
            for (let i = 0; i < maxHp; i++) {
                const d = document.createElement('div');
                d.className = 'heart';
                this.els.hearts.appendChild(d);
            }
        }
        for (let i = 0; i < maxHp; i++) {
            const c = this.els.hearts.children[i];
            if (i < hp) c.classList.remove('empty');
            else c.classList.add('empty');
        }
    },

    hud(p, lv, coins) {
        if (!this.els.spFill) return;
        this.drawHearts(p.hp, p.maxHp);
        this.els.spFill.style.width = (p.sp / p.maxSp * 100) + '%';
        this.els.hudScore.textContent = Game.score;
        this.els.hudCoins.textContent = coins;
        this.els.missionText.textContent = lv.data.obj;
        this.els.hudOp.textContent = lv.data.op;
        this.els.hudGrid.textContent = lv.data.grid;
        const d = Math.round(p.x / 10);
        this.els.hudDist.textContent = String(d).padStart(4, '0') + 'm';

        if (Game.combo > 1) {
            this.els.hudCombo.textContent = '×' + Game.combo;
            this.els.hudCombo.classList.remove('hidden');
        } else {
            this.els.hudCombo.classList.add('hidden');
        }

        // ============ RADAR (working!) ============
        const radarSize = 56;
        const worldW = lv.ww;
        const viewStart = Game.cam.x;
        const viewEnd = viewStart + CFG.W;

        // Player position on radar
        if (this.els.radarPlayer) {
            const relX = (p.x - viewStart) / CFG.W;
            const relY = (p.y - 200) / 400;  // rough vertical
            const rx = Math.max(5, Math.min(radarSize - 5, relX * radarSize));
            const ry = Math.max(5, Math.min(radarSize - 5, relY * radarSize));
            this.els.radarPlayer.style.left = rx + 'px';
            this.els.radarPlayer.style.top = ry + 'px';
        }

        // Nearest 2 enemies on radar
        if (lv.enemies && lv.enemies.length > 0) {
            const visible = lv.enemies
                .filter(e => e.x > viewStart - 200 && e.x < viewEnd + 200)
                .slice(0, 2);

            for (let i = 0; i < 2; i++) {
                const el = i === 0 ? this.els.radarEnemy1 : this.els.radarEnemy2;
                if (visible[i]) {
                    const relX = (visible[i].x - viewStart) / CFG.W;
                    const relY = (visible[i].y - 200) / 400;
                    el.style.left = Math.max(5, Math.min(radarSize - 5, relX * radarSize)) + 'px';
                    el.style.top = Math.max(5, Math.min(radarSize - 5, relY * radarSize)) + 'px';
                    el.style.display = 'block';
                } else {
                    el.style.display = 'none';
                }
            }
        } else {
            if (this.els.radarEnemy1) this.els.radarEnemy1.style.display = 'none';
            if (this.els.radarEnemy2) this.els.radarEnemy2.style.display = 'none';
        }
    },

    radio(text, dur = 3000) {
        if (!this.els.radio) return;
        this.els.radioText.textContent = text;
        this.els.radio.classList.remove('hidden');
        Audio.play('radio');
        clearTimeout(this.radioTO);
        this.radioTO = setTimeout(() => this.els.radio.classList.add('hidden'), dur);
    },
    brief(data, idx) {
        this.els.briefNum.textContent = `MISSION ${String(idx + 1).padStart(2, '0')}`;
        this.els.briefTitle.textContent = data.name;
        this.els.briefLoc.textContent = data.loc;
        this.els.briefTime.textContent = data.time;
        this.els.briefObj.textContent = data.obj;
        this.els.briefHint.textContent = data.hint;
        document.getElementById('briefing').classList.remove('hidden');
    },
    complete(s) {
        this.els.cScore.textContent = s.score;
        this.els.cTime.textContent = s.time.toFixed(1) + 's';
        this.els.cItems.textContent = s.items;
        this.els.cHp.textContent = s.hp + '/' + s.maxHp;
        const pct = Math.min(s.score / 800, 1);
        const stars = Math.max(1, Math.round(pct * 3));
        this.els.cStars.textContent = '★ '.repeat(stars).trim() + ' ☆'.repeat(3 - stars);
        document.getElementById('complete').classList.remove('hidden');
    },
    fail(score, dist) {
        this.els.oScore.textContent = score;
        this.els.oDist.textContent = dist + 'm';
        document.getElementById('gameover').classList.remove('hidden');
    },
    missions(unlocked, current) {
        const g = this.els.missionGrid;
        if (!g) return;
        g.innerHTML = '';
        LEVELS.forEach((lv, i) => {
            const card = document.createElement('div');
            card.className = 'mcard';
            if (i >= unlocked) card.classList.add('locked');
            if (i < current) card.classList.add('completed');
            card.innerHTML = `
                <div class="num">${String(i+1).padStart(2,'0')}</div>
                <div class="name">${lv.name}</div>
                <div class="status">${i < unlocked ? (i < current ? '✓ مكتملة' : 'متاحة') : '🔒'}</div>
            `;
            if (i < unlocked) {
                card.addEventListener('click', () => {
                    Audio.play('select');
                    Game.startLevel(i);
                    document.getElementById('missions').classList.add('hidden');
                });
            }
            g.appendChild(card);
        });
        document.getElementById('missions').classList.remove('hidden');
    }
};

/* ============ GAME ============ */
const Game = {
    state: S.LOADING,
    score: 0, combo: 1, coins: 0,
    lastPickup: 0, shieldMilestone: 0,
    currentLevel: 0, unlocked: 1, high: 0,
    lastT: 0, player: null, cam: null,
    canvas: null, ctx: null,
    endless: false,

    init() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        UI.init();
        Input.init();

        try {
            const save = JSON.parse(localStorage.getItem('sayed_save_v6'));
            if (save) {
                this.unlocked = save.unlocked || 1;
                this.high = save.high || 0;
            }
        } catch(e) {}

        this.state = S.MENU;
        document.getElementById('menu').classList.remove('hidden');
        if (UI.els.mHigh) UI.els.mHigh.textContent = 'HIGH SCORE: ' + this.high;

        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', () => {
                Audio.init(); Audio.resume(); Audio.play('select');
                fn();
            });
        };
        bind('mStart', () => this.startLevel(0));
        bind('mEndless', () => this.startEndless());
        bind('mContinue', () => {
            const lvl = Math.max(0, Math.min(this.unlocked - 1, LEVELS.length - 1));
            this.startLevel(lvl);
        });
        bind('mMissions', () => UI.missions(this.unlocked, this.currentLevel));
        bind('mSettings', () => document.getElementById('settings').classList.remove('hidden'));
        bind('mManual', () => document.getElementById('manual').classList.remove('hidden'));

        document.getElementById('btnCloseSet').onclick = () => document.getElementById('settings').classList.add('hidden');
        document.getElementById('btnCloseMis').onclick = () => document.getElementById('missions').classList.add('hidden');
        document.getElementById('btnCloseMan').onclick = () => document.getElementById('manual').classList.add('hidden');
        document.getElementById('btnDeploy').onclick = () => {
            Audio.play('select');
            document.getElementById('briefing').classList.add('hidden');
            this.beginPlay();
        };
        document.getElementById('btnPause').onclick = () => this.togglePause();
        document.getElementById('btnResume').onclick = () => this.togglePause();
        document.getElementById('btnRestart').onclick = () => { Audio.play('select'); this.restart(); };
        document.getElementById('btnMenu2').onclick = () => { Audio.play('select'); this.toMenu(); };
        document.getElementById('btnNext').onclick = () => { Audio.play('select'); this.nextLevel(); };
        document.getElementById('btnRetry').onclick = () => { Audio.play('select'); this.restart(); };
        document.getElementById('btnMenuGo').onclick = () => { Audio.play('select'); this.toMenu(); };

        const bindSlider = (id, key, labelId) => {
            const el = document.getElementById(id);
            const lbl = document.getElementById(labelId);
            if (!el) return;
            el.addEventListener('input', () => {
                const v = parseFloat(el.value);
                Audio.setVol(key, v);
                if (lbl) lbl.textContent = Math.round(v * 100) + '%';
            });
        };
        bindSlider('vMaster', 'master', 'vMasterL');
        bindSlider('vMusic', 'music', 'vMusicL');
        bindSlider('vSfx', 'sfx', 'vSfxL');

        requestAnimationFrame(t => this.loop(t));
    },

    startLevel(idx) {
        this.endless = false;
        this.currentLevel = Math.max(0, Math.min(idx, LEVELS.length - 1));
        document.getElementById('menu').classList.add('hidden');
        UI.brief(LEVELS[this.currentLevel], this.currentLevel);
        this.state = S.BRIEF;
    },

    startEndless() {
        this.endless = true;
        this.currentLevel = -1;
        document.getElementById('menu').classList.add('hidden');
        UI.brief({
            name: 'دورية مفتوحة', loc: 'الحدود المصرية السودانية',
            time: '∞', obj: 'اصمد أطول وقت ممكن',
            hint: 'ENDLESS MODE — لا نهاية. كل 1600م تُولَّد أرض جديدة.'
        }, 0);
        this.state = S.BRIEF;
    },

    beginPlay() {
        this.canvas.width = CFG.W;
        this.canvas.height = CFG.H;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        this.player = new Player(60, CFG.GROUND_Y - 60);
        this.cam = new Camera();

        if (this.endless) Level.loadEndless();
        else Level.load(this.currentLevel);

        this.player.x = Level.startX;
        this.player.y = Level.startY;
        this.score = 0;
        this.combo = 1;
        this.coins = 0;
        this.shieldMilestone = 0;
        this.lastPickup = 0;
        this.state = S.PLAY;

        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('btnPause').classList.remove('hidden');
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (isTouch) document.getElementById('mc').classList.remove('hidden');

        ['complete','gameover','pause','briefing','missions','manual','settings'].forEach(id =>
            document.getElementById(id).classList.add('hidden'));

        if (Audio.ctx) Audio.startMusic();
        setTimeout(() => UI.radio('سيّد، ابدأ الدورية. جبال مصر والسودان.', 4000), 800);
    },

    restart() {
        document.getElementById('pause').classList.add('hidden');
        document.getElementById('gameover').classList.add('hidden');
        this.beginPlay();
    },

    nextLevel() {
        document.getElementById('complete').classList.add('hidden');
        if (this.currentLevel + 1 >= LEVELS.length) { this.toMenu(); return; }
        this.startLevel(this.currentLevel + 1);
    },

    toMenu() {
        this.state = S.MENU;
        this.endless = false;
        Audio.stopMusic();
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('btnPause').classList.add('hidden');
        document.getElementById('mc').classList.add('hidden');
        ['pause','gameover','complete','briefing'].forEach(id =>
            document.getElementById(id).classList.add('hidden'));
        document.getElementById('menu').classList.remove('hidden');
        if (UI.els.mHigh) UI.els.mHigh.textContent = 'HIGH SCORE: ' + this.high;
    },

    togglePause() {
        if (this.state === S.PLAY) {
            this.state = S.PAUSE;
            document.getElementById('pause').classList.remove('hidden');
        } else if (this.state === S.PAUSE) {
            this.state = S.PLAY;
            document.getElementById('pause').classList.add('hidden');
        }
    },

    fail() {
        this.state = S.FAIL;
        Audio.stopMusic();
        Audio.play('fail');
        if (this.score > this.high) this.high = this.score;
        this.save();
        UI.fail(this.score, this.player ? Math.round(this.player.x / 10) : 0);
        document.getElementById('mc').classList.add('hidden');
    },

    complete() {
        this.state = S.DONE;
        Audio.stopMusic();
        Audio.play('done');
        if (this.score > this.high) this.high = this.score;
        if (this.currentLevel + 2 > this.unlocked) this.unlocked = this.currentLevel + 2;
        this.save();
        UI.complete({
            score: this.score,
            time: Level.time,
            items: this.coins,
            hp: this.player.hp,
            maxHp: this.player.maxHp
        });
        document.getElementById('mc').classList.add('hidden');
    },

    save() {
        try {
            localStorage.setItem('sayed_save_v6', JSON.stringify({
                unlocked: this.unlocked, high: this.high, currentLevel: this.currentLevel
            }));
        } catch(e) {}
    },

    loop(t) {
        const dt = Math.min((t - this.lastT) / 1000, .05);
        this.lastT = t;
        if (!this.ctx) { requestAnimationFrame(tt => this.loop(tt)); return; }

        if (this.state === S.PLAY) {
            this.update(dt);
            this.render();
        } else if (this.state === S.PAUSE) {
            this.render();
        }
        Input.update();
        requestAnimationFrame(tt => this.loop(tt));
    },

    update(dt) {
        const p = this.player;
        if (!p) return;

        p.update(dt, Level.platforms, Level.ww);
        Level.update(dt, p);
        this.cam.follow(p, Level.ww, dt);
        this.cam.update(dt);
        Particles.update(dt);

        // Coins
        for (const c of Level.coins) {
            if (c.taken) continue;
            const cb = c.bounds(), pb = p.bounds;
            if (pb.x + pb.w > cb.x && pb.x < cb.x + cb.w &&
                pb.y + pb.h > cb.y && pb.y < cb.y + cb.h) {
                c.taken = true;
                const now = performance.now();
                if (this.lastPickup && now - this.lastPickup < 2500) this.combo = Math.min(this.combo + 1, 5);
                else this.combo = 1;
                this.lastPickup = now;

                const v = c.type === 'soul' ? 25 : 10;
                const g = v * this.combo;
                this.score += g;
                this.coins++;

                if (c.type === 'soul') {
                    Audio.play('soul');
                    p.heal(2);
                    p.sp = Math.min(p.maxSp, p.sp + 50);
                    UI.radio('💖 روح مُطهرة! +صحة وطاقة', 2500);
                } else {
                    Audio.play('pick');
                    if (this.combo > 1) {
                        Audio.play('combo');
                        UI.radio(`🔥 COMBO ×${this.combo}  +${g}`, 1400);
                    }
                }
                Particles.spawn(c.x + 13, c.y + 13, 6, '#ffdd88', 140, .6, 200, 3);

                const ms = Math.floor(this.score / 500);
                if (ms > this.shieldMilestone) {
                    this.shieldMilestone = ms;
                    p.shield(3);
                    UI.radio('🛡 رصيد ترقية! درع مؤقت', 2500);
                    Audio.play('check');
                }
            }
        }

        // Checkpoints
        for (const cp of Level.checkpoints) {
            if (cp.on) continue;
            const cb = cp.bounds(), pb = p.bounds;
            if (pb.x + pb.w > cb.x && pb.x < cb.x + cb.w &&
                pb.y + pb.h > cb.y && pb.y < cb.y + cb.h) {
                cp.on = true;
                Level.checkpoint = { x: cp.x - 10, y: cp.y - 20 };
                Audio.play('check');
                Particles.spawn(cp.x + 13, cp.y, 10, '#44ff44', 120, .8, 200, 3);
                UI.radio('✓ CHECKPOINT — تم التفعيل');
            }
        }

        // Obstacles
        if (p.invuln <= 0) {
            for (const o of Level.obstacles) {
                const ob = o.bounds(), pb = p.bounds;
                if (pb.x + pb.w > ob.x && pb.x < ob.x + ob.w &&
                    pb.y + pb.h > ob.y && pb.y < ob.y + ob.h) {
                    p.hurt();
                    p.vx = p.faceRight ? -180 : 180;
                    p.vy = -260;
                    break;
                }
            }
        }

        // Enemies
        if (p.invuln <= 0) {
            for (const e of Level.enemies) {
                const eb = e.bounds(), pb = p.bounds;
                if (pb.x + pb.w > eb.x && pb.x < eb.x + eb.w &&
                    pb.y + pb.h > eb.y && pb.y < eb.y + eb.h) {
                    p.hurt();
                    p.vx = p.faceRight ? -220 : 220;
                    p.vy = -300;
                    break;
                }
            }
        }

        // Storm damage
        if (Level.data.storm && Level.stormI > .4) {
            p.sp -= 8 * dt;
            if (p.sp <= 0 && Math.random() < .05) {
                p.hp = Math.max(0, p.hp - 1);
                Audio.play('hurt');
                if (p.hp <= 0 && p.alive) { p.alive = false; this.fail(); }
            }
        }

        // Finish
        if (!Level.endless && p.x >= Level.finishX && !p.finishLock) {
            p.finishLock = true;
            this.complete();
            return;
        }

        UI.hud(p, Level, this.coins);

        // Storm particles (reduced)
        if (Level.data.storm && Level.stormI > .2 && Math.random() < .3) {
            Particles.spawn(this.cam.x + CFG.W + 40, Math.random() * CFG.H, 1, '#d4a373', 0, .7, -30, 2);
            const last = Particles.list[Particles.list.length - 1];
            if (last) {
                last.vx = -(300 + Math.random() * 400) * Level.stormI;
                last.vy = (Math.random() - .5) * 60;
            }
        }
    },

    render() {
        const ctx = this.ctx;
        if (!ctx) return;

        Bg.draw(ctx, this.cam, Level.data);
        Level.draw(ctx, this.cam);
        Particles.draw(ctx, this.cam);
        if (this.player) this.player.draw(ctx, this.cam);

        if (Level.data.storm) Bg.storm(ctx, Level.stormI, Level.time);

        // Dark overlay for night/cave themes
        if (Level.data.theme === 'night' || Level.data.theme === 'cave') {
            Bg.darkness(ctx, this.player, this.cam);
            if (this.player) {
                const px = this.player.x - this.cam.x + this.cam.ox;
                const py = this.player.y - this.cam.y + this.cam.oy;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(px, py, 0, px, py, 180);
                g.addColorStop(0, 'rgba(255,220,150,.22)');
                g.addColorStop(1, 'rgba(255,220,150,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, CFG.W, CFG.H);
                ctx.restore();
            }
        }
    }
};

/* ============ BOOT ============ */
(function boot() {
    const ldFill = document.getElementById('ldFill');
    const ldPct = document.getElementById('ldPct');
    const ldScreen = document.getElementById('loading');
    const ldSkip = document.getElementById('ldSkip');
    let started = false;

    const go = () => {
        if (started) return;
        started = true;
        ldScreen.classList.add('hide');
        setTimeout(() => {
            ldScreen.style.display = 'none';
            try { Game.init(); }
            catch(e) {
                console.error(e);
                alert('خطأ في بدء اللعبة: ' + e.message);
            }
        }, 400);
    };

    const safety = setTimeout(go, 10000);
    if (ldSkip) ldSkip.addEventListener('click', go);

    Assets.loadAll(p => {
        const pct = Math.round(p * 100);
        if (ldFill) ldFill.style.width = pct + '%';
        if (ldPct) ldPct.textContent = pct + '%';
    }).then(() => { clearTimeout(safety); setTimeout(go, 300); })
      .catch(() => { clearTimeout(safety); go(); });

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && Game.state === S.PLAY) {
            Game.togglePause();
            Input.reset();
        }
    });
})();
