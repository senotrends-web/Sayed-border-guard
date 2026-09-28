/* ============================================================
   SAYED — BORDER GUARD | v3.0
   Professional 2D Side-Scrolling Platform Adventure
   ============================================================ */

'use strict';

/* ============================================================
   1. CONFIG
   ============================================================ */
const CFG = {
    W: 960, H: 540,
    GRAVITY: 1500,
    MOVE_ACCEL: 2600,
    MOVE_MAX: 245,
    MOVE_FRICTION: 0.80,
    JUMP_VELOCITY: -540,
    DOUBLE_JUMP_VELOCITY: -450,
    MAX_FALL: 720,
    CROUCH_SPEED: 0.42,
    STAMINA_DRAIN: 18,
    STAMINA_REGEN: 24,
    INVINCIBLE_TIME: 1.6,
    KILL_Y: 900
};

const STATES = {
    LOADING: 'loading', MENU: 'menu', BRIEFING: 'briefing',
    PLAYING: 'playing', PAUSED: 'paused', COMPLETE: 'complete', OVER: 'over'
};

/* ============================================================
   2. SPRITE REGISTRY
   ============================================================ */
const SPRITE_REGISTRY = {
    idle:   { url: 'https://i.ibb.co/LhsGjz0c/sayed-idle.png',   cols: 4, rows: 1, fps: 6,  loop: true  },
    run:    { url: 'https://i.ibb.co/N6ytgTdD/Sayed-Run.png',    cols: 4, rows: 2, fps: 12, loop: true  },
    jump:   { url: 'https://i.ibb.co/3Yj326G7/sayed-jump.png',   cols: 4, rows: 1, fps: 8,  loop: false },
    fall:   { url: 'https://i.ibb.co/FkwTvrRK/Sayed-fall.png',   cols: 2, rows: 1, fps: 5,  loop: true  },
    crouch: { url: 'https://i.ibb.co/9m41w4r4/Sayed-Crouch.png', cols: 3, rows: 1, fps: 5,  loop: false },
    hero:   { url: 'https://i.ibb.co/nN47cnR9/Sayed.png',        cols: 1, rows: 1, fps: 1,  loop: true  },
    coin:   { url: 'https://i.ibb.co/TqPBgBww/Coin.png',         cols: 1, rows: 1, fps: 1,  loop: true  },
    soul:   { url: 'https://i.ibb.co/n8sjtTq9/Soul-Heart.png',   cols: 1, rows: 1, fps: 1,  loop: true  }
};

/* Backgrounds (parallax layers) */
const BG_LAYERS = {
    sky:      'https://i.ibb.co/fbDMqJ9/background.png',
    far:      'https://i.ibb.co/ZpYXsQgx/background3.png',
    mid:      'https://i.ibb.co/chBBdqvT/background2.png',
    near:     'https://i.ibb.co/NnVkSfkq/1786196340828.png',
    menu:     'https://i.ibb.co/RpmxMHwm/Assets-3.png'
};

/* ============================================================
   3. SPRITE CLASS
   ============================================================ */
class Sprite {
    constructor(cfg) {
        this.cfg = cfg;
        this.img = new Image();
        this.loaded = false;
        this.failed = false;
        this.frameW = 64;
        this.frameH = 64;
        this._done = false;
    }
    load() {
        return new Promise((resolve) => {
            const finish = (ok) => {
                if (this._done) return;
                this._done = true;
                if (ok && this.img.width > 0 && this.img.height > 0) {
                    const c = Math.max(1, this.cfg.cols || 1);
                    const r = Math.max(1, this.cfg.rows || 1);
                    this.frameW = Math.max(1, Math.floor(this.img.width / c));
                    this.frameH = Math.max(1, Math.floor(this.img.height / r));
                    this.loaded = true;
                } else {
                    this.failed = true;
                }
                resolve(this.loaded);
            };
            const tm = setTimeout(() => finish(false), 6000);
            this.img.onload = () => { clearTimeout(tm); finish(true); };
            this.img.onerror = () => { clearTimeout(tm); finish(false); };
            try { this.img.src = this.cfg.url; }
            catch (e) { clearTimeout(tm); finish(false); }
        });
    }
    getFrame(i) {
        const c = Math.max(1, this.cfg.cols || 1);
        const col = i % c;
        const row = Math.floor(i / c);
        return { sx: col * this.frameW, sy: row * this.frameH, sw: this.frameW, sh: this.frameH };
    }
}

/* ============================================================
   4. ASSETS
   ============================================================ */
const Assets = {
    sprites: {},
    backgrounds: {},
    ready: false,

    async loadAll(onProgress) {
        const keys = Object.keys(SPRITE_REGISTRY);
        let loaded = 0;
        const total = keys.length + Object.keys(BG_LAYERS).length;

        for (const key of keys) {
            this.sprites[key] = new Sprite(SPRITE_REGISTRY[key]);
        }
        for (const key in BG_LAYERS) {
            const img = new Image();
            this.backgrounds[key] = { img, loaded: false };
        }

        const spriteTasks = keys.map(key =>
            this.sprites[key].load().then(() => {
                loaded++;
                if (onProgress) onProgress(loaded / total);
            })
        );

        const bgTasks = Object.keys(BG_LAYERS).map(key => {
            return new Promise((resolve) => {
                const bg = this.backgrounds[key];
                const tm = setTimeout(() => { bg.loaded = false; loaded++; resolve(); }, 6000);
                bg.img.onload = () => { clearTimeout(tm); bg.loaded = true; loaded++; if (onProgress) onProgress(loaded/total); resolve(); };
                bg.img.onerror = () => { clearTimeout(tm); bg.loaded = false; loaded++; if (onProgress) onProgress(loaded/total); resolve(); };
                try { bg.img.src = BG_LAYERS[key]; } catch(e) { clearTimeout(tm); loaded++; resolve(); }
            });
        });

        await Promise.all([...spriteTasks, ...bgTasks]);
        this.ready = true;
    },

    get(name) { return this.sprites[name] || null; },
    getBg(name) { return this.backgrounds[name] || null; }
};

/* ============================================================
   5. AUDIO
   ============================================================ */
const AudioMgr = {
    ctx: null, masterGain: null, musicGain: null, sfxGain: null,
    volumes: { master: 0.7, music: 0.4, sfx: 0.8 },
    musicNodes: [], started: false,

    init() {
        if (this.ctx) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();
            this.masterGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volumes.master;
            this.musicGain.gain.value = this.volumes.music;
            this.sfxGain.gain.value = this.volumes.sfx;
            this.musicGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
        } catch (e) { console.warn('Audio init failed', e); }
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVolume(ch, val) {
        this.volumes[ch] = val;
        if (!this.ctx) return;
        if (ch === 'master') this.masterGain.gain.value = val;
        if (ch === 'music') this.musicGain.gain.value = val;
        if (ch === 'sfx') this.sfxGain.gain.value = val;
    },
    tone(freq, dur, type = 'sine', gain = 0.3, delay = 0) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g); g.connect(this.sfxGain);
        osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, gain = 0.2, filterFreq = 800) {
        if (!this.ctx) return;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = filterFreq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
        src.start();
    },
    sfx: {
        jump()    { AudioMgr.tone(420, 0.12, 'square', 0.18); AudioMgr.tone(640, 0.10, 'square', 0.12, 0.06); },
        dblJump() { AudioMgr.tone(600, 0.10, 'square', 0.18); AudioMgr.tone(900, 0.12, 'square', 0.14, 0.05); },
        land()    { AudioMgr.tone(120, 0.15, 'sine', 0.2); AudioMgr.noise(0.12, 0.15, 400); },
        step()    { AudioMgr.noise(0.04, 0.06, 600); },
        pickup()  { AudioMgr.tone(880, 0.1, 'sine', 0.25); AudioMgr.tone(1320, 0.12, 'sine', 0.2, 0.08); },
        soul()    { [659,880,1047].forEach((f,i)=>AudioMgr.tone(f,0.2,'sine',0.22,i*0.08)); },
        checkpoint() { [523,659,784].forEach((f,i)=>AudioMgr.tone(f,0.18,'sine',0.25,i*0.1)); },
        hurt()    { AudioMgr.tone(150, 0.25, 'sawtooth', 0.25); AudioMgr.noise(0.2, 0.2, 300); },
        radio()   { AudioMgr.tone(1200, 0.04, 'square', 0.15); AudioMgr.tone(1500, 0.04, 'square', 0.15, 0.08); },
        complete(){ [523,659,784,1047,1319].forEach((f,i)=>AudioMgr.tone(f,0.3,'sine',0.28,i*0.14)); },
        fail()    { [400,320,240,160].forEach((f,i)=>AudioMgr.tone(f,0.4,'sawtooth',0.22,i*0.18)); },
        select()  { AudioMgr.tone(900, 0.08, 'sine', 0.18); },
        rock()    { AudioMgr.noise(0.4, 0.25, 300); AudioMgr.tone(80, 0.3, 'sawtooth', 0.2); },
        combo()   { AudioMgr.tone(1400, 0.08, 'sine', 0.15); AudioMgr.tone(1800, 0.1, 'sine', 0.12, 0.05); }
    },
    startMusic() {
        if (!this.ctx || this.started) return;
        this.started = true;
        const notes = [130.81, 146.83, 174.61, 196.00];
        notes.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine'; osc.frequency.value = f;
            const g = this.ctx.createGain();
            g.gain.value = 0.12 / (i + 1);
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 0.05 + i * 0.02;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.04;
            lfo.connect(lfoGain); lfoGain.connect(g.gain);
            osc.connect(g); g.connect(this.musicGain);
            osc.start(); lfo.start();
            this.musicNodes.push(osc, lfo);
        });
    },
    stopMusic() {
        this.musicNodes.forEach(n => { try { n.stop(); } catch(e){} });
        this.musicNodes = []; this.started = false;
    }
};

/* ============================================================
   6. INPUT
   ============================================================ */
const Input = {
    keys: { left: false, right: false, jump: false, crouch: false, interact: false },
    prev: { left: false, right: false, jump: false, crouch: false, interact: false },
    justPressed: { jump: false, interact: false },
    keyMap: {
        'ArrowLeft': 'left', 'KeyA': 'left',
        'ArrowRight': 'right', 'KeyD': 'right',
        'ArrowUp': 'jump', 'Space': 'jump', 'KeyW': 'jump',
        'ArrowDown': 'crouch', 'KeyS': 'crouch',
        'KeyE': 'interact', 'Enter': 'interact'
    },
    init() {
        window.addEventListener('keydown', e => {
            const a = this.keyMap[e.code];
            if (a) { this.keys[a] = true; e.preventDefault(); }
            if (e.code === 'Escape') Game.togglePause();
        }, { passive: false });
        window.addEventListener('keyup', e => {
            const a = this.keyMap[e.code];
            if (a) { this.keys[a] = false; e.preventDefault(); }
        }, { passive: false });

        const bind = (id, action) => {
            const el = document.getElementById(id);
            if (!el) return;
            const press = e => { e.preventDefault(); this.keys[action] = true; };
            const release = e => { e.preventDefault(); this.keys[action] = false; };
            el.addEventListener('touchstart', press, { passive: false });
            el.addEventListener('touchend', release, { passive: false });
            el.addEventListener('touchcancel', release, { passive: false });
            el.addEventListener('mousedown', press);
            el.addEventListener('mouseup', release);
            el.addEventListener('mouseleave', release);
        };
        bind('btn-left', 'left'); bind('btn-right', 'right');
        bind('btn-jump', 'jump'); bind('btn-crouch', 'crouch');
        bind('btn-interact', 'interact');
    },
    update() {
        for (const k in this.keys) {
            this.justPressed[k] = this.keys[k] && !this.prev[k];
            this.prev[k] = this.keys[k];
        }
    }
};

/* ============================================================
   7. CAMERA
   ============================================================ */
class Camera {
    constructor() {
        this.x = 0; this.y = 0;
        this.shakeMag = 0; this.shakeTime = 0;
        this.offsetX = 0; this.offsetY = 0;
    }
    follow(target, worldW, dt) {
        const desiredX = target.x + target.width / 2 - CFG.W * 0.38;
        const clampedX = Math.max(0, Math.min(desiredX, Math.max(0, worldW - CFG.W)));
        this.x += (clampedX - this.x) * Math.min(1, 8 * dt);
    }
    shake(mag, time) {
        this.shakeMag = Math.max(this.shakeMag, mag);
        this.shakeTime = Math.max(this.shakeTime, time);
    }
    update(dt) {
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            const f = Math.max(0, this.shakeTime);
            this.offsetX = (Math.random() - 0.5) * this.shakeMag * f * 2;
            this.offsetY = (Math.random() - 0.5) * this.shakeMag * f * 2;
            if (this.shakeTime <= 0) { this.shakeMag = 0; this.offsetX = 0; this.offsetY = 0; }
        }
    }
}

/* ============================================================
   8. PARTICLES
   ============================================================ */
class Particle {
    constructor(x, y, vx, vy, life, color, size, gravity = 400) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.color = color; this.size = size;
        this.gravity = gravity;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vy += this.gravity * dt;
        this.vx *= 0.98; this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx, cam) {
        const a = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        const sx = this.x - cam.x + cam.offsetX;
        const sy = this.y - cam.y + cam.offsetY;
        const s = this.size * (0.5 + a * 0.5);
        ctx.fillRect(sx - s/2, sy - s/2, s, s);
        ctx.globalAlpha = 1;
    }
}
const Particles = {
    list: [],
    spawn(x, y, count, color, speed = 120, life = 0.6, gravity = 400, size = 2) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = speed * (0.4 + Math.random() * 0.6);
            this.list.push(new Particle(
                x, y, Math.cos(ang) * sp, Math.sin(ang) * sp - 40,
                life * (0.6 + Math.random() * 0.5),
                color, size * (0.7 + Math.random() * 0.6), gravity
            ));
        }
    },
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            this.list[i].update(dt);
            if (!this.list[i].active) this.list.splice(i, 1);
        }
        if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
    },
    draw(ctx, cam) { for (const p of this.list) p.draw(ctx, cam); },
    clear() { this.list.length = 0; }
};

/* ============================================================
   9. PLAYER
   ============================================================ */
class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.width = 38; this.height = 54;
        this.onGround = false; this.wasOnGround = false;
        this.facingRight = true;
        this.health = 5; this.maxHealth = 5;
        this.stamina = 100; this.maxStamina = 100;
        this.invincible = 0;
        this.isCrouching = false;
        this.currentAnim = 'idle';
        this.animTimer = 0; this.animFrame = 0;
        this.stepTimer = 0; this.jumpCount = 0; this.maxJumps = 2;
        this.alive = true; this.finishLock = false;
        this.sprintTime = 0; this.trailTimer = 0;
    }
    get bounds() {
        const h = this.isCrouching ? this.height * 0.62 : this.height;
        return { x: this.x + 5, y: this.y + (this.height - h), w: this.width - 10, h: h };
    }
    setAnim(name) {
        if (this.currentAnim !== name) {
            this.currentAnim = name;
            this.animTimer = 0; this.animFrame = 0;
        }
    }
    update(dt, platforms, worldW) {
        this.wasOnGround = this.onGround;
        if (this.sprintTime > 0) this.sprintTime -= dt;
        this.isCrouching = Input.keys.crouch && this.onGround;

        let ix = 0;
        if (Input.keys.left) ix -= 1;
        if (Input.keys.right) ix += 1;
        if (ix !== 0 && !this.finishLock) this.facingRight = ix > 0;

        const sprintMult = this.sprintTime > 0 ? 1.4 : 1;
        const maxSpeed = (this.isCrouching ? CFG.MOVE_MAX * CFG.CROUCH_SPEED : CFG.MOVE_MAX) * sprintMult;

        if (ix !== 0 && !this.finishLock) {
            this.vx += ix * CFG.MOVE_ACCEL * dt;
            if (Math.abs(this.vx) > maxSpeed) this.vx = Math.sign(this.vx) * maxSpeed;
        } else {
            this.vx *= CFG.MOVE_FRICTION;
            if (Math.abs(this.vx) < 4) this.vx = 0;
        }

        const running = Math.abs(this.vx) > 60 && !this.isCrouching && this.onGround;
        if (running) this.stamina -= CFG.STAMINA_DRAIN * dt;
        else this.stamina += CFG.STAMINA_REGEN * dt;
        this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina));

        if (Input.justPressed.jump && !this.finishLock) {
            if (this.onGround) {
                this.vy = CFG.JUMP_VELOCITY;
                this.onGround = false; this.jumpCount = 1;
                AudioMgr.sfx.jump();
                Particles.spawn(this.x + this.width/2, this.y + this.height, 8, '#d4a373', 100, 0.5, 300, 3);
            } else if (this.jumpCount < this.maxJumps) {
                this.vy = CFG.DOUBLE_JUMP_VELOCITY;
                this.jumpCount++;
                AudioMgr.sfx.dblJump();
                Particles.spawn(this.x + this.width/2, this.y + this.height - 5, 12, '#ffdd88', 140, 0.6, 200, 3);
            }
        }

        this.vy += CFG.GRAVITY * dt;
        if (this.vy > CFG.MAX_FALL) this.vy = CFG.MAX_FALL;

        this.x += this.vx * dt; this.y += this.vy * dt;
        this.x = Math.max(0, Math.min(this.x, worldW - this.width));

        this.onGround = false;
        const b2 = this.bounds;
        for (const p of platforms) {
            if (b2.x + b2.w > p.x && b2.x < p.x + p.w &&
                b2.y + b2.h > p.y && b2.y < p.y + p.h) {
                const overlapX = Math.min(b2.x + b2.w - p.x, p.x + p.w - b2.x);
                const overlapY = Math.min(b2.y + b2.h - p.y, p.y + p.h - b2.y);
                if (overlapY < overlapX) {
                    if (this.vy > 0 && b2.y + b2.h - this.vy * dt <= p.y + 8) {
                        this.y = p.y - this.height;
                        if (!this.wasOnGround && this.vy > 200) {
                            AudioMgr.sfx.land();
                            Particles.spawn(this.x + this.width/2, this.y + this.height, 10, '#d4a373', 80, 0.4, 300, 3);
                        }
                        this.vy = 0; this.onGround = true; this.jumpCount = 0;
                    } else if (this.vy < 0 && b2.y - this.vy * dt >= p.y + p.h - 8) {
                        this.y = p.y + p.h; this.vy = 0;
                    }
                } else {
                    if (this.vx > 0) this.x = p.x - this.width;
                    else if (this.vx < 0) this.x = p.x + p.w;
                    this.vx = 0;
                }
            }
        }

        const groundY = CFG.H - 40;
        if (this.y + this.height > groundY) {
            this.y = groundY - this.height;
            if (!this.wasOnGround && this.vy > 200) {
                AudioMgr.sfx.land();
                Particles.spawn(this.x + this.width/2, this.y + this.height, 10, '#d4a373', 80, 0.4, 300, 3);
            }
            this.vy = 0; this.onGround = true; this.jumpCount = 0;
        }

        if (this.invincible > 0) this.invincible -= dt;
        if (this.y > CFG.KILL_Y) this.takeDamage(true);

        if (this.onGround && Math.abs(this.vx) > 60) {
            this.stepTimer -= dt;
            if (this.stepTimer <= 0) {
                this.stepTimer = 0.28;
                AudioMgr.sfx.step();
                Particles.spawn(this.x + this.width/2, this.y + this.height, 2, '#b8a888', 40, 0.3, 200, 1.5);
            }
        }

        if (this.sprintTime > 0 && Math.abs(this.vx) > 100) {
            this.trailTimer -= dt;
            if (this.trailTimer <= 0) {
                this.trailTimer = 0.05;
                Particles.spawn(this.x + this.width/2, this.y + this.height/2, 2, '#ffdd88', 30, 0.4, 50, 4);
            }
        }

        if (!this.onGround) this.setAnim(this.vy < 0 ? 'jump' : 'fall');
        else if (this.isCrouching) this.setAnim('crouch');
        else if (Math.abs(this.vx) > 20) this.setAnim('run');
        else this.setAnim('idle');

        const spr = Assets.get(this.currentAnim);
        if (spr && spr.loaded) {
            const fps = (spr.cfg.fps || 8) * (running ? 1.15 : 1);
            this.animTimer += dt;
            const frameDur = 1 / fps;
            if (this.animTimer >= frameDur) {
                this.animTimer -= frameDur;
                const total = (spr.cfg.cols || 1) * (spr.cfg.rows || 1);
                if (spr.cfg.loop) this.animFrame = (this.animFrame + 1) % total;
                else this.animFrame = Math.min(this.animFrame + 1, total - 1);
            }
        }
    }
    takeDamage(forceRespawn = false) {
        if (this.invincible > 0 && !forceRespawn) return;
        this.health--;
        this.invincible = CFG.INVINCIBLE_TIME;
        AudioMgr.sfx.hurt();
        Particles.spawn(this.x + this.width/2, this.y + this.height/2, 16, '#ff4444', 160, 0.7, 400, 3);
        if (Game.camera) Game.camera.shake(8, 0.4);
        if (forceRespawn) {
            this.x = Level.lastCheckpoint.x;
            this.y = Level.lastCheckpoint.y;
            this.vx = 0; this.vy = 0;
        }
        if (this.health <= 0) {
            this.health = 0; this.alive = false;
            Game.gameOver();
        }
    }
    heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }
    shield(d) { this.invincible = Math.max(this.invincible, d); }

    draw(ctx, cam) {
        const spr = Assets.get(this.currentAnim);
        const sx = this.x - cam.x + cam.offsetX;
        const sy = this.y - cam.y + cam.offsetY;

        if (this.invincible > 0 && Math.floor(this.invincible * 16) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(sx + this.width/2, sy + this.height + 3, this.width * 0.55, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield aura
        if (this.invincible > 0.3) {
            ctx.strokeStyle = `rgba(80,180,255,${0.4 + Math.sin(performance.now() * 0.02) * 0.3})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(sx + this.width/2, sy + this.height/2, this.width * 1.1, this.height * 0.9, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (spr && spr.loaded) {
            const rect = spr.getFrame(this.animFrame);
            const destH = this.height * 1.30;
            const destW = destH * (rect.sw / rect.sh);
            const drawX = sx + this.width/2 - destW/2;
            const drawY = sy + this.height - destH;

            ctx.save();
            if (!this.facingRight) {
                ctx.translate(drawX + destW/2, drawY + destH/2);
                ctx.scale(-1, 1);
                ctx.drawImage(spr.img, rect.sx, rect.sy, rect.sw, rect.sh,
                              -destW/2, -destH/2, destW, destH);
            } else {
                ctx.drawImage(spr.img, rect.sx, rect.sy, rect.sw, rect.sh,
                              drawX, drawY, destW, destH);
            }
            ctx.restore();
        } else {
            this.drawFallback(ctx, sx, sy);
        }
        ctx.globalAlpha = 1;
    }
    drawFallback(ctx, sx, sy) {
        const h = this.isCrouching ? this.height * 0.62 : this.height;
        const yOff = this.isCrouching ? this.height * 0.38 : 0;
        ctx.fillStyle = '#c8b590';
        ctx.fillRect(sx + 5, sy + yOff + 14, this.width - 10, h - 20);
        ctx.fillStyle = '#5a6a4a';
        ctx.fillRect(sx + 8, sy + yOff + 18, this.width - 16, h - 26);
        ctx.fillStyle = '#d4a373';
        ctx.beginPath();
        ctx.arc(sx + this.width/2, sy + yOff + 10, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a7a5a';
        ctx.beginPath();
        ctx.arc(sx + this.width/2, sy + yOff + 8, 12, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(sx + this.width/2 - 12, sy + yOff + 6, 24, 4);
        ctx.fillStyle = '#2a4a6a';
        ctx.fillRect(sx - 3, sy + yOff + 18, 8, 22);
    }
}

/* ============================================================
   10. COLLECTIBLES (with image assets for coin & soul)
   ============================================================ */
class Collectible {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.width = 24; this.height = 24;
        this.collected = false;
        this.bob = Math.random() * Math.PI * 2;
        this.rot = 0;
    }
    update(dt) { this.bob += dt * 2.4; this.rot += dt * 3; }
    draw(ctx, cam) {
        if (this.collected) return;
        const sx = this.x - cam.x + cam.offsetX;
        const sy = this.y - cam.y + cam.offsetY + Math.sin(this.bob) * 4;

        // Try using image for coin and soul
        const imgSprite = (this.type === 'coin') ? Assets.get('coin') :
                          (this.type === 'soul') ? Assets.get('soul') : null;

        if (imgSprite && imgSprite.loaded) {
            ctx.save();
            ctx.shadowColor = this.type === 'soul' ? '#ff66aa' : '#ffdd00';
            ctx.shadowBlur = 16;
            // Rotate coin
            ctx.translate(sx + 12, sy + 12);
            if (this.type === 'coin') ctx.rotate(Math.sin(this.rot) * 0.15);
            ctx.drawImage(imgSprite.img, -16, -16, 32, 32);
            ctx.restore();
            return;
        }

        // Fallback shapes
        const colors = {
            coin:     ['#ffdd00', '#8a6a00'],
            soul:     ['#ff88cc', '#8a2a5a'],
            water:    ['#44aaff', '#0a5a8a'],
            food:     ['#ff8844', '#8a3a0a'],
            supplies: ['#88cc44', '#3a6a1a'],
            star:     ['#ffdd00', '#8a6a00']
        };
        const [c1, c2] = colors[this.type] || ['#fff', '#888'];
        const icons = { coin: '🪙', soul: '💖', water: '💧', food: '🥫', supplies: '📦', star: '★' };

        ctx.save();
        ctx.shadowColor = c1;
        ctx.shadowBlur = 14;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(sx + 12, sy + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = c1; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx + 12, sy + 12, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Tahoma';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icons[this.type] || '?', sx + 12, sy + 13);
        ctx.restore();
    }
    getBounds() { return { x: this.x, y: this.y, w: this.width, h: this.height }; }
}

/* ============================================================
   11. CHECKPOINT
   ============================================================ */
class Checkpoint {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 26; this.height = 50;
        this.activated = false; this.pulse = 0;
    }
    update(dt) { this.pulse += dt * 4; }
    draw(ctx, cam) {
        const sx = this.x - cam.x + cam.offsetX;
        const sy = this.y - cam.y + cam.offsetY;
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(sx + 10, sy + this.height - 6, 6, 6);
        ctx.fillStyle = '#8a8a8a';
        ctx.fillRect(sx + 12, sy, 3, this.height - 6);
        ctx.fillStyle = this.activated ? '#44ff44' : '#ff4444';
        ctx.beginPath(); ctx.arc(sx + 13.5, sy - 3, 5, 0, Math.PI * 2); ctx.fill();
        if (this.activated) {
            const glow = 0.6 + Math.sin(this.pulse) * 0.4;
            ctx.globalAlpha = glow * 0.6;
            ctx.beginPath(); ctx.arc(sx + 13.5, sy - 3, 12, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = this.activated ? '#44dd44' : '#dd4444';
        ctx.beginPath();
        ctx.moveTo(sx + 15, sy + 4);
        ctx.lineTo(sx + 30, sy + 12);
        ctx.lineTo(sx + 15, sy + 20);
        ctx.closePath(); ctx.fill();
    }
    getBounds() { return { x: this.x - 6, y: this.y - 10, w: this.width + 12, h: this.height + 14 }; }
}

/* ============================================================
   12. OBSTACLE
   ============================================================ */
class Obstacle {
    constructor(x, y, w, h, type) {
        this.x = x; this.y = y;
        this.width = w; this.height = h;
        this.type = type;
    }
    draw(ctx, cam) {
        const sx = this.x - cam.x + cam.offsetX;
        const sy = this.y - cam.y + cam.offsetY;
        if (this.type === 'rock') {
            ctx.fillStyle = '#7a6a5a';
            ctx.beginPath();
            ctx.moveTo(sx, sy + this.height);
            ctx.lineTo(sx + this.width * 0.25, sy + 4);
            ctx.lineTo(sx + this.width * 0.55, sy);
            ctx.lineTo(sx + this.width * 0.85, sy + 8);
            ctx.lineTo(sx + this.width, sy + this.height);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#9a8a7a';
            ctx.beginPath();
            ctx.moveTo(sx + this.width * 0.25, sy + 4);
            ctx.lineTo(sx + this.width * 0.55, sy);
            ctx.lineTo(sx + this.width * 0.6, sy + this.height);
            ctx.lineTo(sx + this.width * 0.35, sy + this.height);
            ctx.closePath(); ctx.fill();
        } else if (this.type === 'cactus') {
            ctx.fillStyle = '#2a5a2a';
            ctx.fillRect(sx + this.width/2 - 5, sy, 10, this.height);
            ctx.fillRect(sx, sy + this.height * 0.35, this.width, 7);
            ctx.fillRect(sx, sy + this.height * 0.15, 6, 15);
        }
    }
    getBounds() { return { x: this.x + 4, y: this.y + 4, w: this.width - 8, h: this.height - 8 }; }
}

/* ============================================================
   13. FALLING ROCK
   ============================================================ */
class FallingRock {
    constructor(x, y) {
        this.x = x; this.y = y; this.vy = 0;
        this.size = 14 + Math.random() * 10;
        this.active = true;
        this.rot = Math.random() * Math.PI;
        this.rotSpeed = (Math.random() - 0.5) * 6;
        this.delay = 0.6; this.warned = false;
    }
    update(dt, player) {
        if (this.delay > 0) { this.delay -= dt; return; }
        if (!this.warned) { this.warned = true; AudioMgr.sfx.rock(); }
        this.vy += 1400 * dt; this.y += this.vy * dt;
        this.rot += this.rotSpeed * dt;
        if (this.y > 700) this.active = false;
        const b = this.getBounds(); const pb = player.bounds;
        if (pb.x + pb.w > b.x && pb.x < b.x + b.w &&
            pb.y + pb.h > b.y && pb.y < b.y + b.h) {
            if (player.invincible <= 0) player.takeDamage();
            this.active = false;
            Particles.spawn(this.x, this.y, 12, '#8a7a6a', 180, 0.6, 400, 3);
        }
    }
    draw(ctx, cam) {
        if (this.delay > 0) {
            const sx = this.x - cam.x + cam.offsetX;
            const sy = this.y - cam.y + cam.offsetY;
            const a = 0.4 + Math.sin(this.delay * 30) * 0.4;
            ctx.strokeStyle = `rgba(255,80,80,${a})`; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 12, sy); ctx.lineTo(sx + 12, sy);
            ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy + 12);
            ctx.stroke(); return;
        }
        const sx = this.x - cam.x + cam.offsetX;
        const sy = this.y - cam.y + cam.offsetY;
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(this.rot);
        ctx.fillStyle = '#7a6a5a';
        ctx.beginPath();
        ctx.moveTo(-this.size, 0);
        ctx.lineTo(-this.size * 0.5, -this.size);
        ctx.lineTo(this.size * 0.5, -this.size * 0.8);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(this.size * 0.4, this.size * 0.7);
        ctx.lineTo(-this.size * 0.6, this.size * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    getBounds() { return { x: this.x - this.size * 0.7, y: this.y - this.size * 0.7, w: this.size * 1.4, h: this.size * 1.4 }; }
}

/* ============================================================
   14. LEVELS DATA
   ============================================================ */
const LEVELS = [
    {
        id: 0, name: 'بداية الدورية', op: 'DESERT WATCH', grid: 'GRID 22-R',
        time: '05:45', loc: 'جنوب البحر الأحمر',
        objective: 'الوصول إلى نقطة المراقبة',
        hint: 'من جبال مصر إلى السودان... الطريق طويل.',
        worldWidth: 2600, dark: false, sandstorm: false,
        platforms: [
            { x: 0, y: 480, w: 400, h: 60 }, { x: 470, y: 440, w: 220, h: 100 },
            { x: 740, y: 400, w: 180, h: 140 }, { x: 970, y: 460, w: 260, h: 80 },
            { x: 1280, y: 420, w: 200, h: 120 }, { x: 1530, y: 380, w: 160, h: 160 },
            { x: 1740, y: 440, w: 260, h: 100 }, { x: 2050, y: 400, w: 200, h: 140 },
            { x: 2300, y: 480, w: 300, h: 60 }
        ],
        collectibles: [
            { x: 200, y: 430, type: 'coin' }, { x: 520, y: 400, type: 'coin' },
            { x: 800, y: 350, type: 'soul' }, { x: 1050, y: 410, type: 'coin' },
            { x: 1350, y: 370, type: 'coin' }, { x: 1600, y: 330, type: 'soul' },
            { x: 1850, y: 390, type: 'coin' }, { x: 2130, y: 350, type: 'coin' }
        ],
        obstacles: [
            { x: 440, y: 460, w: 22, h: 22, type: 'rock' },
            { x: 950, y: 440, w: 18, h: 22, type: 'cactus' },
            { x: 1270, y: 460, w: 24, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 1150, y: 430 }],
        enemies: [], npcs: [],
        finishX: 2480
    },
    {
        id: 1, name: 'طريق الجبال', op: 'MOUNTAIN PASS', grid: 'GRID 24-Q',
        time: '07:20', loc: 'المرتفعات الجبلية',
        objective: 'اعبر الطريق الجبلي بأمان',
        hint: 'احذر من الانهيارات الصخرية.',
        worldWidth: 2900, dark: false, sandstorm: false,
        platforms: [
            { x: 0, y: 490, w: 320, h: 50 }, { x: 380, y: 440, w: 180, h: 100 },
            { x: 620, y: 380, w: 160, h: 160 }, { x: 840, y: 320, w: 200, h: 220 },
            { x: 1100, y: 400, w: 220, h: 140 }, { x: 1380, y: 350, w: 160, h: 190 },
            { x: 1600, y: 420, w: 240, h: 120 }, { x: 1900, y: 370, w: 180, h: 170 },
            { x: 2130, y: 440, w: 260, h: 100 }, { x: 2440, y: 490, w: 460, h: 50 }
        ],
        collectibles: [
            { x: 150, y: 440, type: 'coin' }, { x: 450, y: 400, type: 'coin' },
            { x: 700, y: 340, type: 'soul' }, { x: 900, y: 280, type: 'coin' },
            { x: 1180, y: 360, type: 'coin' }, { x: 1450, y: 310, type: 'soul' },
            { x: 1680, y: 380, type: 'coin' }, { x: 1970, y: 330, type: 'coin' }
        ],
        obstacles: [
            { x: 360, y: 460, w: 20, h: 22, type: 'rock' },
            { x: 830, y: 300, w: 22, h: 22, type: 'rock' },
            { x: 1880, y: 460, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 1050, y: 380 }, { x: 1850, y: 400 }],
        enemies: [{ x: 1500, y: 380, range: 100, speed: 50 }],
        npcs: [], finishX: 2750
    },
    {
        id: 2, name: 'الوادي الصخري', op: 'ROCKY VALLEY', grid: 'GRID 26-N',
        time: '09:15', loc: 'الوادي الجاف',
        objective: 'اعبر الوادي واجمع العملات',
        hint: 'الطريق وعر. راقب الطاقة.',
        worldWidth: 3100, dark: false, sandstorm: false,
        platforms: [
            { x: 0, y: 490, w: 300, h: 50 }, { x: 350, y: 450, w: 130, h: 90 },
            { x: 530, y: 400, w: 110, h: 140 }, { x: 690, y: 350, w: 130, h: 190 },
            { x: 870, y: 400, w: 110, h: 140 }, { x: 1030, y: 450, w: 160, h: 90 },
            { x: 1240, y: 400, w: 140, h: 140 }, { x: 1430, y: 350, w: 120, h: 190 },
            { x: 1600, y: 400, w: 150, h: 140 }, { x: 1800, y: 450, w: 190, h: 90 },
            { x: 2040, y: 400, w: 130, h: 140 }, { x: 2220, y: 350, w: 140, h: 190 },
            { x: 2410, y: 420, w: 210, h: 120 }, { x: 2670, y: 490, w: 430, h: 50 }
        ],
        collectibles: [
            { x: 120, y: 440, type: 'coin' }, { x: 580, y: 350, type: 'soul' },
            { x: 740, y: 300, type: 'coin' }, { x: 1080, y: 410, type: 'coin' },
            { x: 1290, y: 350, type: 'soul' }, { x: 1650, y: 350, type: 'coin' },
            { x: 1870, y: 410, type: 'coin' }, { x: 2080, y: 350, type: 'soul' },
            { x: 2270, y: 300, type: 'coin' }, { x: 2500, y: 380, type: 'coin' }
        ],
        obstacles: [
            { x: 330, y: 430, w: 22, h: 22, type: 'rock' },
            { x: 1010, y: 430, w: 22, h: 22, type: 'rock' },
            { x: 1580, y: 380, w: 22, h: 22, type: 'rock' },
            { x: 2020, y: 430, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 1000, y: 430 }, { x: 1790, y: 430 }],
        enemies: [{ x: 1250, y: 350, range: 90, speed: 55 }, { x: 2200, y: 300, range: 110, speed: 60 }],
        npcs: [], finishX: 2950
    },
    {
        id: 3, name: 'العاصفة الرملية', op: 'SANDSTORM', grid: 'GRID 28-S',
        time: '11:40', loc: 'صحراء مفتوحة',
        objective: 'الوصول للمنطقة الآمنة',
        hint: 'احتمِ! العاصفة قادمة.',
        worldWidth: 2700, dark: false, sandstorm: true, sandstormStart: 3,
        platforms: [
            { x: 0, y: 490, w: 400, h: 50 }, { x: 450, y: 450, w: 200, h: 90 },
            { x: 700, y: 410, w: 180, h: 130 }, { x: 940, y: 450, w: 240, h: 90 },
            { x: 1230, y: 410, w: 160, h: 130 }, { x: 1440, y: 360, w: 140, h: 180 },
            { x: 1630, y: 420, w: 220, h: 120 }, { x: 1900, y: 380, w: 160, h: 160 },
            { x: 2110, y: 450, w: 280, h: 90 }, { x: 2440, y: 490, w: 260, h: 50 }
        ],
        collectibles: [
            { x: 180, y: 440, type: 'coin' }, { x: 540, y: 410, type: 'soul' },
            { x: 780, y: 370, type: 'coin' }, { x: 1000, y: 410, type: 'coin' },
            { x: 1290, y: 370, type: 'soul' }, { x: 1500, y: 320, type: 'coin' },
            { x: 1720, y: 380, type: 'coin' }, { x: 1980, y: 340, type: 'soul' }
        ],
        obstacles: [
            { x: 430, y: 470, w: 22, h: 22, type: 'rock' },
            { x: 920, y: 430, w: 22, h: 22, type: 'rock' },
            { x: 1880, y: 460, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 1180, y: 410 }, { x: 2080, y: 430 }],
        enemies: [{ x: 1650, y: 380, range: 100, speed: 70 }],
        npcs: [], finishX: 2580
    },
    {
        id: 4, name: 'الكهف', op: 'CAVE PATROL', grid: 'GRID 30-K',
        time: '14:20', loc: 'الكهف الجبلي',
        objective: 'اعثر على حقيبة الإسعافات',
        hint: 'الظلام دامس. تحرك بحذر.',
        worldWidth: 2400, dark: true, sandstorm: false,
        platforms: [
            { x: 0, y: 490, w: 320, h: 50 }, { x: 370, y: 450, w: 160, h: 90 },
            { x: 580, y: 400, w: 140, h: 140 }, { x: 770, y: 360, w: 130, h: 180 },
            { x: 950, y: 410, w: 190, h: 130 }, { x: 1190, y: 370, w: 150, h: 170 },
            { x: 1390, y: 420, w: 210, h: 120 }, { x: 1650, y: 380, w: 160, h: 160 },
            { x: 1860, y: 430, w: 210, h: 110 }, { x: 2120, y: 490, w: 280, h: 50 }
        ],
        collectibles: [
            { x: 150, y: 440, type: 'coin' }, { x: 430, y: 410, type: 'soul' },
            { x: 640, y: 360, type: 'coin' }, { x: 820, y: 320, type: 'coin' },
            { x: 1000, y: 370, type: 'soul' }, { x: 1250, y: 330, type: 'coin' },
            { x: 1450, y: 380, type: 'coin' }, { x: 1720, y: 340, type: 'soul' }
        ],
        obstacles: [
            { x: 350, y: 430, w: 22, h: 22, type: 'rock' },
            { x: 750, y: 340, w: 22, h: 22, type: 'rock' },
            { x: 1630, y: 440, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 930, y: 430 }],
        enemies: [{ x: 1200, y: 330, range: 80, speed: 55 }],
        npcs: [], finishX: 2280
    },
    {
        id: 5, name: 'إنقاذ الجندي', op: 'RESCUE OP', grid: 'GRID 32-R',
        time: '16:55', loc: 'منطقة الدوريات',
        objective: 'ساعد الجندي العالق',
        hint: 'جندي يحتاج مساعدتك.',
        worldWidth: 2700, dark: false, sandstorm: false,
        platforms: [
            { x: 0, y: 490, w: 350, h: 50 }, { x: 400, y: 450, w: 180, h: 90 },
            { x: 630, y: 400, w: 160, h: 140 }, { x: 840, y: 350, w: 200, h: 190 },
            { x: 1090, y: 410, w: 220, h: 130 }, { x: 1360, y: 370, w: 150, h: 170 },
            { x: 1560, y: 420, w: 260, h: 120 }, { x: 1870, y: 380, w: 170, h: 160 },
            { x: 2090, y: 460, w: 260, h: 80 }, { x: 2400, y: 490, w: 300, h: 50 }
        ],
        collectibles: [
            { x: 200, y: 440, type: 'coin' }, { x: 480, y: 410, type: 'soul' },
            { x: 700, y: 360, type: 'coin' }, { x: 900, y: 310, type: 'coin' },
            { x: 1150, y: 370, type: 'soul' }, { x: 1420, y: 330, type: 'coin' },
            { x: 1650, y: 380, type: 'coin' }, { x: 1930, y: 340, type: 'soul' }
        ],
        obstacles: [
            { x: 380, y: 470, w: 22, h: 22, type: 'rock' },
            { x: 820, y: 330, w: 22, h: 22, type: 'rock' },
            { x: 1850, y: 440, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 800, y: 430 }, { x: 1830, y: 420 }],
        enemies: [{ x: 1400, y: 330, range: 100, speed: 65 }],
        npcs: [], finishX: 2580
    },
    {
        id: 6, name: 'الطريق الليلي', op: 'NIGHT RUN', grid: 'GRID 34-N',
        time: '21:30', loc: 'طريق العودة',
        objective: 'الوصول قبل الفجر',
        hint: 'الليل طويل. لا تتوقف.',
        worldWidth: 2900, dark: true, sandstorm: false,
        platforms: [
            { x: 0, y: 490, w: 300, h: 50 }, { x: 350, y: 450, w: 160, h: 90 },
            { x: 560, y: 400, w: 140, h: 140 }, { x: 750, y: 360, w: 130, h: 180 },
            { x: 930, y: 410, w: 190, h: 130 }, { x: 1170, y: 370, w: 150, h: 170 },
            { x: 1370, y: 420, w: 210, h: 120 }, { x: 1630, y: 380, w: 160, h: 160 },
            { x: 1840, y: 430, w: 220, h: 110 }, { x: 2110, y: 490, w: 300, h: 50 },
            { x: 2460, y: 450, w: 200, h: 90 }
        ],
        collectibles: [
            { x: 150, y: 440, type: 'coin' }, { x: 420, y: 410, type: 'soul' },
            { x: 620, y: 360, type: 'coin' }, { x: 800, y: 320, type: 'coin' },
            { x: 980, y: 370, type: 'soul' }, { x: 1220, y: 330, type: 'coin' },
            { x: 1430, y: 380, type: 'coin' }, { x: 1700, y: 340, type: 'soul' },
            { x: 1910, y: 390, type: 'coin' }, { x: 2250, y: 440, type: 'coin' }
        ],
        obstacles: [
            { x: 330, y: 430, w: 22, h: 22, type: 'rock' },
            { x: 730, y: 340, w: 22, h: 22, type: 'rock' },
            { x: 1610, y: 440, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 910, y: 430 }, { x: 1820, y: 420 }],
        enemies: [{ x: 1000, y: 370, range: 90, speed: 60 }, { x: 1700, y: 340, range: 100, speed: 55 }],
        npcs: [], finishX: 2780
    },
    {
        id: 7, name: 'العودة النهائية', op: 'FINAL RETURN', grid: 'GRID 36-R',
        time: '04:50', loc: 'نقطة الحراسة',
        objective: 'العودة إلى نقطة الحراسة',
        hint: 'آخر مرحلة. أثبت جدارتك.',
        worldWidth: 3000, dark: false, sandstorm: false,
        platforms: [
            { x: 0, y: 490, w: 400, h: 50 }, { x: 450, y: 450, w: 200, h: 90 },
            { x: 700, y: 400, w: 180, h: 140 }, { x: 930, y: 450, w: 220, h: 90 },
            { x: 1200, y: 400, w: 160, h: 140 }, { x: 1410, y: 350, w: 140, h: 190 },
            { x: 1600, y: 410, w: 200, h: 130 }, { x: 1850, y: 370, w: 160, h: 170 },
            { x: 2060, y: 430, w: 250, h: 110 }, { x: 2360, y: 400, w: 180, h: 140 },
            { x: 2590, y: 490, w: 410, h: 50 }
        ],
        collectibles: [
            { x: 200, y: 440, type: 'coin' }, { x: 500, y: 410, type: 'coin' },
            { x: 750, y: 360, type: 'soul' }, { x: 1000, y: 410, type: 'coin' },
            { x: 1260, y: 360, type: 'soul' }, { x: 1470, y: 310, type: 'coin' },
            { x: 1700, y: 370, type: 'coin' }, { x: 1920, y: 330, type: 'soul' },
            { x: 2180, y: 390, type: 'coin' }, { x: 2450, y: 360, type: 'coin' }
        ],
        obstacles: [
            { x: 430, y: 470, w: 22, h: 22, type: 'rock' },
            { x: 680, y: 380, w: 22, h: 22, type: 'rock' },
            { x: 1830, y: 460, w: 22, h: 22, type: 'rock' }
        ],
        checkpoints: [{ x: 1150, y: 400 }, { x: 2040, y: 410 }],
        enemies: [{ x: 1450, y: 310, range: 100, speed: 60 }, { x: 2200, y: 390, range: 110, speed: 65 }],
        npcs: [], finishX: 2900
    }
];

/* ============================================================
   15. LEVEL RUNTIME
   ============================================================ */
const Level = {
    data: null,
    platforms: [], collectibles: [], checkpoints: [], obstacles: [], enemies: [], npcs: [],
    fallingRocks: [],
    lastCheckpoint: { x: 60, y: 400 },
    startX: 60, startY: 400,
    worldWidth: 2600,
    time: 0, stormTimer: 0, stormIntensity: 0,
    collectTarget: 0, rockEventTimer: 0,

    load(index) {
        this.data = LEVELS[index];
        this.worldWidth = this.data.worldWidth;
        this.platforms = this.data.platforms.map(p => ({...p}));
        this.collectibles = this.data.collectibles.map(c => new Collectible(c.x, c.y, c.type));
        this.checkpoints = this.data.checkpoints.map(c => new Checkpoint(c.x, c.y));
        this.obstacles = this.data.obstacles.map(o => new Obstacle(o.x, o.y, o.w, o.h, o.type));
        this.enemies = [];
        this.npcs = [];
        this.fallingRocks = [];
        this.startX = 60; this.startY = 400;
        this.lastCheckpoint = { x: this.startX, y: this.startY };
        this.time = 0; this.stormTimer = 0; this.stormIntensity = 0;
        this.collectTarget = this.data.collectibles.filter(c => c.type === 'coin').length;
        this.rockEventTimer = 6 + Math.random() * 6;
        Particles.clear();
    },

    update(dt, player) {
        this.time += dt; this.stormTimer += dt;
        for (const c of this.collectibles) c.update(dt);
        for (const cp of this.checkpoints) cp.update(dt);

        if (this.data.sandstorm && this.stormTimer > (this.data.sandstormStart || 3)) {
            this.stormIntensity = Math.min(1, (this.stormTimer - (this.data.sandstormStart || 3)) / 6);
        }

        // Falling rocks
        this.rockEventTimer -= dt;
        if (this.rockEventTimer <= 0) {
            this.rockEventTimer = 10 + Math.random() * 8;
            const baseX = player.x + CFG.W * 0.35;
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                this.fallingRocks.push(new FallingRock(
                    baseX + (i - count/2) * 45 + (Math.random() - 0.5) * 60,
                    player.y - 450
                ));
            }
            UI.showRadio('⚠ انهيار صخري! احتمِ!', 2200);
            if (Game.camera) Game.camera.shake(5, 0.5);
        }
        for (let i = this.fallingRocks.length - 1; i >= 0; i--) {
            this.fallingRocks[i].update(dt, player);
            if (!this.fallingRocks[i].active) this.fallingRocks.splice(i, 1);
        }
    },

    draw(ctx, cam) {
        for (const p of this.platforms) {
            const sx = p.x - cam.x + cam.offsetX;
            const sy = p.y - cam.y + cam.offsetY;
            if (sx + p.w < -100 || sx > CFG.W + 100) continue;
            ctx.fillStyle = this.data.dark ? '#3a3528' : '#8a7a6a';
            ctx.fillRect(sx, sy, p.w, p.h);
            ctx.fillStyle = this.data.dark ? '#4a4538' : '#c8b590';
            ctx.fillRect(sx, sy, p.w, 10);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(sx, sy + p.h, p.w, 5);
        }
        for (const o of this.obstacles) o.draw(ctx, cam);
        for (const c of this.checkpoints) c.draw(ctx, cam);
        for (const c of this.collectibles) c.draw(ctx, cam);
        for (const r of this.fallingRocks) r.draw(ctx, cam);

        // Finish flag
        const fx = this.data.finishX - cam.x + cam.offsetX;
        const fy = CFG.H - 40;
        ctx.fillStyle = '#8a8a8a';
        ctx.fillRect(fx, fy - 120, 5, 120);
        ctx.fillStyle = '#44dd44';
        ctx.beginPath();
        ctx.moveTo(fx + 5, fy - 120);
        ctx.lineTo(fx + 45, fy - 105);
        ctx.lineTo(fx + 5, fy - 90);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EXTRACT', fx + 20, fy - 128);
    }
};

/* ============================================================
   16. BACKGROUND (with image assets)
   ============================================================ */
const Background = {
    draw(ctx, cam, data) {
        // Sky fallback
        const skyBg = Assets.getBg('sky');
        const farBg = Assets.getBg('far');
        const midBg = Assets.getBg('mid');
        const nearBg = Assets.getBg('near');

        // Layer 0: Sky
        if (skyBg && skyBg.loaded) {
            ctx.drawImage(skyBg.img, 0, 0, CFG.W, CFG.H);
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, CFG.H);
            if (data.dark) {
                grad.addColorStop(0, '#05050f'); grad.addColorStop(1, '#1a1a30');
            } else if (data.sandstorm) {
                grad.addColorStop(0, '#a08050'); grad.addColorStop(1, '#e0c090');
            } else {
                grad.addColorStop(0, '#3a6ba8'); grad.addColorStop(0.8, '#d4c090'); grad.addColorStop(1, '#e8c890');
            }
            ctx.fillStyle = grad; ctx.fillRect(0, 0, CFG.W, CFG.H);
        }

        // Sun / Moon
        if (data.dark) {
            ctx.fillStyle = '#e8e8d0';
            ctx.beginPath(); ctx.arc(CFG.W * 0.78, 120, 26, 0, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 40; i++) {
                const sx = (i * 137) % CFG.W;
                const sy = (i * 71) % 200;
                ctx.globalAlpha = 0.5 + Math.abs(Math.sin(cam.x * 0.001 + i)) * 0.5;
                ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1.5, 1.5);
            }
            ctx.globalAlpha = 1;
        }

        // Layer 1: Far mountains (parallax 0.10)
        if (farBg && farBg.loaded) {
            const off = (cam.x * 0.10) % CFG.W;
            ctx.globalAlpha = 0.9;
            ctx.drawImage(farBg.img, -off, 100, CFG.W + 10, 320);
            ctx.drawImage(farBg.img, CFG.W - off, 100, CFG.W + 10, 320);
            ctx.globalAlpha = 1;
        }

        // Layer 2: Mid mountains (parallax 0.25)
        if (midBg && midBg.loaded) {
            const off = (cam.x * 0.25) % CFG.W;
            ctx.globalAlpha = 0.95;
            ctx.drawImage(midBg.img, -off, 150, CFG.W + 10, 340);
            ctx.drawImage(midBg.img, CFG.W - off, 150, CFG.W + 10, 340);
            ctx.globalAlpha = 1;
        }

        // Layer 3: Near desert (parallax 0.45)
        if (nearBg && nearBg.loaded) {
            const off = (cam.x * 0.45) % CFG.W;
            ctx.drawImage(nearBg.img, -off, 340, CFG.W + 10, 200);
            ctx.drawImage(nearBg.img, CFG.W - off, 340, CFG.W + 10, 200);
        } else {
            ctx.fillStyle = data.dark ? '#2a2518' : (data.sandstorm ? '#c8a373' : '#d4b088');
            ctx.fillRect(0, 400, CFG.W, CFG.H - 400);
        }
    },

    drawStormOverlay(ctx, intensity, time) {
        if (intensity <= 0) return;
        ctx.fillStyle = `rgba(180, 150, 100, ${intensity * 0.25})`;
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        for (let i = 0; i < 60; i++) {
            const sx = ((i * 89 + time * 400 * intensity) % (CFG.W + 200)) - 100;
            const sy = (i * 53) % CFG.H;
            const len = 20 + Math.random() * 40;
            ctx.strokeStyle = `rgba(210, 180, 120, ${0.2 + Math.random() * 0.25})`;
            ctx.lineWidth = 1 + Math.random();
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(sx - len, sy + 4);
            ctx.stroke();
        }
        const vg = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 100, CFG.W/2, CFG.H/2, 700);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(0,0,0,${intensity * 0.5})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, CFG.W, CFG.H);
    },

    drawDarkOverlay(ctx) {
        const vg = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 80, CFG.W/2, CFG.H/2, 480);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,20,0.85)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, CFG.W, CFG.H);
    }
};

/* ============================================================
   17. UI
   ============================================================ */
const UI = {
    els: {},
    _radioT: null,
    init() {
        const ids = [
            'hudOpName','hudTime','hudGrid',
            'healthFill','staminaFill','hudScore','hudCombo','missionText','objectiveProgress',
            'radioText','radioChatter','loaderFill','loaderPct',
            'statScore','statTime','statItems','statHealth','rankAward',
            'overScore','overLevel','menuHighScore',
            'briefingNum','briefingTitle','briefingLoc','briefingTime','briefingObjective','briefingHint',
            'missionGrid'
        ];
        ids.forEach(id => { this.els[id] = document.getElementById(id); });
    },
    updateHUD(player, level) {
        if (!this.els.healthFill) return;
        this.els.healthFill.style.width = (player.health / player.maxHealth * 100) + '%';
        this.els.staminaFill.style.width = (player.stamina / player.maxStamina * 100) + '%';
        this.els.hudScore.textContent = Game.score;
        this.els.missionText.textContent = level.data.objective;
        this.els.hudOpName.textContent = level.data.op;
        this.els.hudGrid.textContent = level.data.grid;
        this.els.hudTime.textContent = level.data.time;
        if (Game.combo > 1) {
            this.els.hudCombo.textContent = '×' + Game.combo;
            this.els.hudCombo.classList.add('active');
        } else {
            this.els.hudCombo.classList.remove('active');
        }
        const done = level.collectibles.filter(c => c.collected && c.type === 'coin').length;
        if (level.collectTarget > 0) {
            this.els.objectiveProgress.textContent = `COINS  ${done} / ${level.collectTarget}`;
        } else {
            const total = level.collectibles.length;
            const got = level.collectibles.filter(c => c.collected).length;
            this.els.objectiveProgress.textContent = `INTEL  ${got} / ${total}`;
        }
    },
    showRadio(text, duration = 3000) {
        if (!this.els.radioChatter) return;
        this.els.radioText.textContent = text;
        this.els.radioChatter.classList.remove('hidden');
        AudioMgr.sfx.radio();
        clearTimeout(this._radioT);
        this._radioT = setTimeout(() => {
            this.els.radioChatter.classList.add('hidden');
        }, duration);
    },
    showBriefing(levelData, index) {
        this.els.briefingNum.textContent = `MISSION ${String(index + 1).padStart(2, '0')}`;
        this.els.briefingTitle.textContent = levelData.name;
        this.els.briefingLoc.textContent = levelData.loc;
        this.els.briefingTime.textContent = levelData.time;
        this.els.briefingObjective.textContent = levelData.objective;
        this.els.briefingHint.textContent = levelData.hint;
        document.getElementById('briefing').classList.remove('hidden');
    },
    showComplete(stats) {
        this.els.statScore.textContent = stats.score;
        this.els.statTime.textContent = stats.time.toFixed(1) + 's';
        this.els.statItems.textContent = stats.items;
        this.els.statHealth.textContent = stats.health + '/' + stats.maxHealth;
        const pct = Math.min(stats.score / 400, 1);
        const stars = Math.max(1, Math.round(pct * 3));
        this.els.rankAward.textContent = '★ '.repeat(stars).trim() + ' ☆'.repeat(3 - stars);
        document.getElementById('missionComplete').classList.remove('hidden');
    },
    showGameOver(score, level) {
        this.els.overScore.textContent = score;
        this.els.overLevel.textContent = level + 1;
        document.getElementById('gameOver').classList.remove('hidden');
    },
    showMissionGrid(unlocked, current) {
        const grid = this.els.missionGrid;
        if (!grid) return;
        grid.innerHTML = '';
        LEVELS.forEach((lvl, i) => {
            const card = document.createElement('div');
            card.className = 'mission-card';
            if (i >= unlocked) card.classList.add('locked');
            if (i < current) card.classList.add('completed');
            card.innerHTML = `
                <div class="num">${String(i+1).padStart(2,'0')}</div>
                <div class="name">${lvl.name}</div>
                <div class="status">${i < unlocked ? (i < current ? '✓ مكتملة' : 'متاحة') : '🔒 مقفلة'}</div>
            `;
            if (i < unlocked) {
                card.addEventListener('click', () => {
                    AudioMgr.sfx.select();
                    Game.startLevel(i);
                    document.getElementById('missionsPanel').classList.add('hidden');
                });
            }
            grid.appendChild(card);
        });
        document.getElementById('missionsPanel').classList.remove('hidden');
    }
};

/* ============================================================
   18. GAME CONTROLLER
   ============================================================ */
const Game = {
    state: STATES.LOADING,
    score: 0, combo: 1,
    _lastPickupTime: 0, _crateMilestone: 0,
    currentLevel: 0, unlockedLevels: 1, highScore: 0,
    lastFrame: 0, player: null, camera: null,
    canvas: null, ctx: null,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        UI.init();
        Input.init();

        try {
            const save = JSON.parse(localStorage.getItem('sayed_save_v3'));
            if (save) {
                this.unlockedLevels = save.unlockedLevels || 1;
                this.highScore = save.highScore || 0;
            }
        } catch(e){}

        this.state = STATES.MENU;
        document.getElementById('mainMenu').classList.remove('hidden');
        if (UI.els.menuHighScore) UI.els.menuHighScore.textContent = 'HIGH SCORE: ' + this.highScore;

        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => {
                AudioMgr.init(); AudioMgr.resume(); AudioMgr.sfx.select();
                fn();
            });
        };
        bind('menuStart', () => this.startLevel(0));
        bind('menuContinue', () => {
            const lvl = Math.max(0, Math.min(this.unlockedLevels - 1, LEVELS.length - 1));
            this.startLevel(lvl);
        });
        bind('menuMissions', () => UI.showMissionGrid(this.unlockedLevels, this.currentLevel));
        bind('menuSettings', () => document.getElementById('settingsPanel').classList.remove('hidden'));
        bind('menuManual', () => document.getElementById('manualPanel').classList.remove('hidden'));

        document.getElementById('btnCloseSettings').onclick = () => {
            document.getElementById('settingsPanel').classList.add('hidden');
        };
        document.getElementById('btnCloseMissions').onclick = () => {
            document.getElementById('missionsPanel').classList.add('hidden');
        };
        document.getElementById('btnCloseManual').onclick = () => {
            document.getElementById('manualPanel').classList.add('hidden');
        };
        document.getElementById('btnDeploy').onclick = () => {
            AudioMgr.sfx.select();
            document.getElementById('briefing').classList.add('hidden');
            this.beginPlay();
        };

        document.getElementById('btn-pause').onclick = () => this.togglePause();
        document.getElementById('btnResume').onclick = () => this.togglePause();
        document.getElementById('btnRestart').onclick = () => { AudioMgr.sfx.select(); this.restartLevel(); };
        document.getElementById('btnQuit').onclick = () => { AudioMgr.sfx.select(); this.returnToMenu(); };
        document.getElementById('btnNext').onclick = () => { AudioMgr.sfx.select(); this.nextLevel(); };
        document.getElementById('btnRetry').onclick = () => { AudioMgr.sfx.select(); this.restartLevel(); };
        document.getElementById('btnMenuFromOver').onclick = () => { AudioMgr.sfx.select(); this.returnToMenu(); };

        const bindSlider = (id, key, valId) => {
            const el = document.getElementById(id);
            const lbl = document.getElementById(valId);
            if (!el) return;
            el.addEventListener('input', () => {
                const v = parseFloat(el.value);
                AudioMgr.setVolume(key, v);
                if (lbl) lbl.textContent = Math.round(v * 100) + '%';
            });
        };
        bindSlider('volMaster', 'master', 'volMasterVal');
        bindSlider('volMusic', 'music', 'volMusicVal');
        bindSlider('volSfx', 'sfx', 'volSfxVal');

        requestAnimationFrame(this.loop.bind(this));
    },

    startLevel(index) {
        this.currentLevel = Math.max(0, Math.min(index, LEVELS.length - 1));
        document.getElementById('mainMenu').classList.add('hidden');
        UI.showBriefing(LEVELS[this.currentLevel], this.currentLevel);
        this.state = STATES.BRIEFING;
    },

    beginPlay() {
        // ✅ FIX: Reset canvas size to ensure rendering works
        this.canvas.width = CFG.W;
        this.canvas.height = CFG.H;

        this.player = new Player(60, 400);
        this.camera = new Camera();
        Level.load(this.currentLevel);
        this.player.x = Level.startX;
        this.player.y = Level.startY;
        this.score = 0;
        this.combo = 1;
        this._crateMilestone = 0;
        this._lastPickupTime = 0;
        this.state = STATES.PLAYING;

        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('btn-pause').classList.remove('hidden');

        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (isTouch) document.getElementById('mobile-controls').classList.remove('hidden');

        ['missionComplete','gameOver','pauseOverlay','briefing','missionsPanel','manualPanel','settingsPanel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (AudioMgr.ctx) AudioMgr.startMusic();

        setTimeout(() => UI.showRadio('سيّد، ابدأ الدورية من جبال مصر إلى السودان.', 4000), 800);
    },

    restartLevel() {
        document.getElementById('pauseOverlay').classList.add('hidden');
        document.getElementById('gameOver').classList.add('hidden');
        this.beginPlay();
    },

    nextLevel() {
        document.getElementById('missionComplete').classList.add('hidden');
        if (this.currentLevel + 1 >= LEVELS.length) {
            this.returnToMenu();
            return;
        }
        this.startLevel(this.currentLevel + 1);
    },

    returnToMenu() {
        this.state = STATES.MENU;
        AudioMgr.stopMusic();
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('btn-pause').classList.add('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        ['pauseOverlay','gameOver','missionComplete'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById('mainMenu').classList.remove('hidden');
        if (UI.els.menuHighScore) UI.els.menuHighScore.textContent = 'HIGH SCORE: ' + this.highScore;
    },

    togglePause() {
        if (this.state === STATES.PLAYING) {
            this.state = STATES.PAUSED;
            document.getElementById('pauseOverlay').classList.remove('hidden');
        } else if (this.state === STATES.PAUSED) {
            this.state = STATES.PLAYING;
            document.getElementById('pauseOverlay').classList.add('hidden');
        }
    },

    gameOver() {
        this.state = STATES.OVER;
        AudioMgr.stopMusic();
        AudioMgr.sfx.fail();
        if (this.score > this.highScore) this.highScore = this.score;
        this.save();
        UI.showGameOver(this.score, this.currentLevel);
        document.getElementById('mobile-controls').classList.add('hidden');
    },

    completeLevel() {
        this.state = STATES.COMPLETE;
        AudioMgr.stopMusic();
        AudioMgr.sfx.complete();
        if (this.score > this.highScore) this.highScore = this.score;
        if (this.currentLevel + 2 > this.unlockedLevels) this.unlockedLevels = this.currentLevel + 2;
        this.save();
        UI.showComplete({
            score: this.score,
            time: Level.time,
            items: Level.collectibles.filter(c => c.collected).length,
            health: this.player.health,
            maxHealth: this.player.maxHealth
        });
        document.getElementById('mobile-controls').classList.add('hidden');
    },

    save() {
        try {
            localStorage.setItem('sayed_save_v3', JSON.stringify({
                unlockedLevels: this.unlockedLevels,
                highScore: this.highScore,
                currentLevel: this.currentLevel
            }));
        } catch(e){}
    },

    loop(t) {
        const dt = Math.min((t - this.lastFrame) / 1000, 0.05);
        this.lastFrame = t;

        if (!this.ctx) {
            requestAnimationFrame(this.loop.bind(this));
            return;
        }

        if (this.state === STATES.PLAYING) {
            this.update(dt);
            this.render();
        } else if (this.state === STATES.PAUSED) {
            this.render();
        }

        Input.update();
        requestAnimationFrame(this.loop.bind(this));
    },

    update(dt) {
        const p = this.player;
        if (!p) return;

        p.update(dt, Level.platforms, Level.worldWidth);
        Level.update(dt, p);
        this.camera.follow(p, Level.worldWidth, dt);
        this.camera.update(dt);
        Particles.update(dt);

        // Collectibles
        for (const c of Level.collectibles) {
            if (c.collected) continue;
            const cb = c.getBounds();
            const pb = p.bounds;
            if (pb.x + pb.w > cb.x && pb.x < cb.x + cb.w &&
                pb.y + pb.h > cb.y && pb.y < cb.y + cb.h) {
                c.collected = true;

                const now = performance.now();
                if (this._lastPickupTime && now - this._lastPickupTime < 2500) {
                    this.combo = Math.min(this.combo + 1, 5);
                } else {
                    this.combo = 1;
                }
                this._lastPickupTime = now;

                const values = { coin: 10, soul: 25, water: 10, food: 15, supplies: 25, star: 50 };
                const gained = (values[c.type] || 10) * this.combo;
                this.score += gained;

                if (c.type === 'soul') {
                    AudioMgr.sfx.soul();
                    p.heal(2);
                    p.stamina = Math.min(p.maxStamina, p.stamina + 50);
                    UI.showRadio('💖 روح مُطهرة! +صحة وطاقة', 2500);
                } else {
                    AudioMgr.sfx.pickup();
                }
                if (this.combo > 1 && c.type !== 'soul') {
                    AudioMgr.sfx.combo();
                    UI.showRadio(`🔥 COMBO ×${this.combo}  +${gained}`, 1400);
                }
                Particles.spawn(c.x + 12, c.y + 12, 8, '#ffdd88', 140, 0.6, 200, 3);

                const milestone = Math.floor(this.score / 500);
                if (milestone > this._crateMilestone) {
                    this._crateMilestone = milestone;
                    p.shield(3);
                    UI.showRadio('🛡 رصيد ترقية! درع مؤقت مفعّل', 2500);
                    AudioMgr.sfx.checkpoint();
                }
            }
        }

        // Checkpoints
        for (const cp of Level.checkpoints) {
            if (cp.activated) continue;
            const cb = cp.getBounds();
            const pb = p.bounds;
            if (pb.x + pb.w > cb.x && pb.x < cb.x + cb.w &&
                pb.y + pb.h > cb.y && pb.y < cb.y + cb.h) {
                cp.activated = true;
                Level.lastCheckpoint = { x: cp.x - 10, y: cp.y - 20 };
                AudioMgr.sfx.checkpoint();
                Particles.spawn(cp.x + 13, cp.y, 12, '#44ff44', 120, 0.8, 200, 3);
                UI.showRadio('✓ CHECKPOINT — تم تفعيل نقطة التفتيش');
            }
        }

        // Obstacles
        if (p.invincible <= 0) {
            for (const o of Level.obstacles) {
                const ob = o.getBounds();
                const pb = p.bounds;
                if (pb.x + pb.w > ob.x && pb.x < ob.x + ob.w &&
                    pb.y + pb.h > ob.y && pb.y < ob.y + ob.h) {
                    p.takeDamage();
                    p.vx = p.facingRight ? -180 : 180;
                    p.vy = -260;
                    break;
                }
            }
        }

        // Sandstorm damage
        if (Level.data.sandstorm && Level.stormIntensity > 0.4) {
            p.stamina -= 8 * dt;
            if (p.stamina <= 0 && Math.random() < 0.05) {
                p.health = Math.max(0, p.health - 1);
                AudioMgr.sfx.hurt();
                if (p.health <= 0 && p.alive) { p.alive = false; this.gameOver(); }
            }
        }

        // Finish
        if (p.x >= Level.data.finishX && !p.finishLock) {
            p.finishLock = true;
            this.completeLevel();
            return;
        }

        UI.updateHUD(p, Level);

        // Sandstorm particles
        if (Level.data.sandstorm && Level.stormIntensity > 0.2) {
            if (Math.random() < 0.5) {
                Particles.spawn(
                    this.camera.x + CFG.W + 40,
                    Math.random() * CFG.H,
                    1, '#d4a373', 0, 0.7, -30, 2
                );
                const last = Particles.list[Particles.list.length - 1];
                if (last) {
                    last.vx = -(300 + Math.random() * 400) * Level.stormIntensity;
                    last.vy = (Math.random() - 0.5) * 60;
                }
            }
        }
    },

    render() {
        const ctx = this.ctx;
        if (!ctx) return;

        Background.draw(ctx, this.camera, Level.data);
        Level.draw(ctx, this.camera);
        Particles.draw(ctx, this.camera);
        if (this.player) this.player.draw(ctx, this.camera);

        if (Level.data.sandstorm) Background.drawStormOverlay(ctx, Level.stormIntensity, Level.time);
        if (Level.data.dark) {
            Background.drawDarkOverlay(ctx);
            if (this.player) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const px = this.player.x - this.camera.x + this.camera.offsetX;
                const py = this.player.y - this.camera.y + this.camera.offsetY;
                const glow = ctx.createRadialGradient(px, py, 0, px, py, 200);
                glow.addColorStop(0, 'rgba(255,220,150,0.18)');
                glow.addColorStop(1, 'rgba(255,220,150,0)');
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, CFG.W, CFG.H);
                ctx.restore();
            }
        }
    }
};

/* ============================================================
   19. BOOTSTRAP
   ============================================================ */
(function bootstrap() {
    const loaderFill = document.getElementById('loaderFill');
    const loaderPct = document.getElementById('loaderPct');
    const loadingScreen = document.getElementById('loading-screen');
    const skipBtn = document.getElementById('loaderSkip');

    let started = false;
    const forceStart = () => {
        if (started) return;
        started = true;
        loadingScreen.classList.add('hide');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            try {
                Game.init();
            } catch (e) {
                console.error('Game init error:', e);
                alert('حدث خطأ في بدء اللعبة: ' + e.message);
            }
        }, 400);
    };

    const safetyTimeout = setTimeout(() => {
        console.warn('⚠ Safety timeout — forcing start');
        forceStart();
    }, 10000);

    if (skipBtn) skipBtn.addEventListener('click', forceStart);

    Assets.loadAll((progress) => {
        const pct = Math.round(progress * 100);
        if (loaderFill) loaderFill.style.width = pct + '%';
        if (loaderPct) loaderPct.textContent = pct + '%';
    }).then(() => {
        clearTimeout(safetyTimeout);
        setTimeout(forceStart, 400);
    }).catch((err) => {
        console.error('Assets load error:', err);
        clearTimeout(safetyTimeout);
        forceStart();
    });

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && Game.state === STATES.PLAYING) {
            Game.togglePause();
        }
    });
})();
