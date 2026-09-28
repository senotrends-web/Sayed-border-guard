/* ============================================================
SAYED — BORDER GUARD
Professional 2D Side-Scrolling Platform Adventure
============================================================ */

'use strict';

/* ============================================================
1. CONSTANTS & CONFIG
============================================================ */
const CFG = {
W: 960, H: 540,
GRAVITY: 1450,
MOVE_ACCEL: 2400,
MOVE_MAX: 235,
MOVE_FRICTION: 0.82,
JUMP_VELOCITY: -520,
DOUBLE_JUMP_VELOCITY: -430,
MAX_FALL: 720,
CROUCH_SPEED: 0.45,
STAMINA_DRAIN: 18,
STAMINA_REGEN: 22,
STAMINA_RUN_THRESHOLD: 40,
INVINCIBLE_TIME: 1.6,
CHECKPOINT_RADIUS: 44,
PICKUP_RADIUS: 26,
KILL_Y: 900
};

const STATES = {
LOADING: 'loading',
MENU: 'menu',
BRIEFING: 'briefing',
PLAYING: 'playing',
PAUSED: 'paused',
COMPLETE: 'complete',
OVER: 'over',
MISSIONS: 'missions',
SETTINGS: 'settings',
MANUAL: 'manual'
};

/* ============================================================
2. ASSET REGISTRY (Actual Sprites from provided URLs)
============================================================ */
const SPRITE_REGISTRY = {
idle: { url: 'https://i.ibb.co/LhsGjz0c/sayed-idle.png', cols: 4, rows: 1, frames: 4, fps: 6, loop: true },
run: { url: 'https://i.ibb.co/N6ytgTdD/Sayed-Run.png', cols: 4, rows: 2, frames: 8, fps: 14, loop: true },
jump: { url: 'https://i.ibb.co/3Yj326G7/sayed-jump.png', cols: 4, rows: 1, frames: 4, fps: 10, loop: false },
fall: { url: 'https://i.ibb.co/FkwTvrRK/Sayed-fall.png', cols: 2, rows: 1, frames: 2, fps: 5, loop: true },
crouch: { url: 'https://i.ibb.co/9m41w4r4/Sayed-Crouch.png', cols: 3, rows: 1, frames: 3, fps: 5, loop: false },
hero: { url: 'https://i.ibb.co/nN47cnR9/Sayed.png', cols: 1, rows: 1, frames: 1, fps: 1, loop: true }
};

/* ============================================================
3. SPRITE CLASS
============================================================ */
class Sprite {
constructor(cfg) {
this.cfg = cfg;
this.img = new Image();
this.img.crossOrigin = 'anonymous';
this.loaded = false;
this.failed = false;
this.frameW = 64;
this.frameH = 64;
}
load() {
return new Promise((resolve) => {
this.img.onload = () => {
const c = this.cfg.cols || 1;
const r = this.cfg.rows || 1;
this.frameW = Math.max(1, Math.floor(this.img.width / c));
this.frameH = Math.max(1, Math.floor(this.img.height / r));
this.loaded = true;
resolve(true);
};
this.img.onerror = () => {
this.failed = true;
console.warn('Sprite failed:', this.cfg.url);
resolve(false);
};
this.img.src = this.cfg.url;
});
}
getFrame(i) {
const c = this.cfg.cols || 1;
const col = i % c;
const row = Math.floor(i / c);
return {
sx: col * this.frameW,
sy: row * this.frameH,
sw: this.frameW,
sh: this.frameH
};
}
}

/* ============================================================
4. ASSET LOADER
============================================================ */
const Assets = {
sprites: {},
audio: {},
ready: false,
progress: 0,
total: 0,
loaded: 0,

async loadAll(onProgress) {
const tasks = [];
for (const key in SPRITE_REGISTRY) {
this.sprites[key] = new Sprite(SPRITE_REGISTRY[key]);
this.total++;
}
// Also load the "hero" portrait as menu image
this.sprites.hero.cfg.cols = 1;
this.sprites.hero.cfg.rows = 1;

for (const key in this.sprites) {
tasks.push(
this.sprites[key].load().then(() => {
this.loaded++;
this.progress = this.loaded / this.total;
if (onProgress) onProgress(this.progress);
})
);
}
await Promise.all(tasks);
this.ready = true;
},

get(name) {
return this.sprites[name] || null;
}
};

/* ============================================================
5. AUDIO MANAGER (Web Audio API - Procedural)
============================================================ */
const Audio = {
ctx: null,
masterGain: null,
musicGain: null,
sfxGain: null,
volumes: { master: 0.7, music: 0.5, sfx: 0.8 },
musicNode: null,

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

resume() {
if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
},

setVolume(channel, val) {
this.volumes[channel] = val;
if (!this.ctx) return;
if (channel === 'master') this.masterGain.gain.value = val;
if (channel === 'music') this.musicGain.gain.value = val;
if (channel === 'sfx') this.sfxGain.gain.value = val;
},

tone(freq, dur, type = 'sine', gain = 0.3, delay = 0, target = null) {
if (!this.ctx) return;
const t = this.ctx.currentTime + delay;
const osc = this.ctx.createOscillator();
const g = this.ctx.createGain();
osc.type = type;
osc.frequency.setValueAtTime(freq, t);
g.gain.setValueAtTime(0, t);
g.gain.linearRampToValueAtTime(gain, t + 0.01);
g.gain.exponentialRampToValueAtTime(0.001, t + dur);
osc.connect(g);
g.connect(target || this.sfxGain);
osc.start(t);
osc.stop(t + dur + 0.05);
},

noise(dur, gain = 0.2, filterFreq = 800) {
if (!this.ctx) return;
const bufferSize = this.ctx.sampleRate * dur;
const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
const src = this.ctx.createBufferSource();
src.buffer = buffer;
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = filterFreq;
const g = this.ctx.createGain();
g.gain.setValueAtTime(gain, this.ctx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
src.start();
},

// SFX library
sfx: {
jump() { Audio.tone(420, 0.12, 'square', 0.18); Audio.tone(640, 0.1, 'square', 0.12, 0.06); },
land() { Audio.tone(120, 0.15, 'sine', 0.2); Audio.noise(0.12, 0.15, 400); },
step() { Audio.noise(0.04, 0.08, 600); },
pickup() { Audio.tone(880, 0.1, 'sine', 0.25); Audio.tone(1320, 0.12, 'sine', 0.2, 0.08); },
checkpoint() { [523, 659, 784].forEach((f,i)=>Audio.tone(f, 0.18, 'sine', 0.25, i0.1)); },
hurt() { Audio.tone(150, 0.25, 'sawtooth', 0.25); Audio.noise(0.2, 0.2, 300); },
radio() { Audio.tone(1200, 0.04, 'square', 0.15); Audio.tone(1500, 0.04, 'square', 0.15, 0.08); },
complete(){ [523,659,784,1047,1319].forEach((f,i)=>Audio.tone(f, 0.3, 'sine', 0.28, i0.14)); },
fail() { [400,320,240,160].forEach((f,i)=>Audio.tone(f, 0.4, 'sawtooth', 0.22, i*0.18)); },
ui() { Audio.tone(700, 0.06, 'square', 0.15); },
select() { Audio.tone(900, 0.08, 'sine', 0.18); },
sandstorm(){ Audio.noise(0.5, 0.05, 500); }
},

startMusic() {
if (!this.ctx || this.musicNode) return;
// Simple ambient desert drone
const notes = [130.81, 146.83, 174.61, 196.00];
const master = this.ctx.createGain();
master.gain.value = 0.12;
master.connect(this.musicGain);
this.musicNode = { nodes: [], master };
notes.forEach((f, i) => {
const osc = this.ctx.createOscillator();
osc.type = 'sine';
osc.frequency.value = f;
const g = this.ctx.createGain();
g.gain.value = 0.15 / (i + 1);
// Slow LFO
const lfo = this.ctx.createOscillator();
lfo.frequency.value = 0.05 + i * 0.02;
const lfoGain = this.ctx.createGain();
lfoGain.gain.value = 0.05;
lfo.connect(lfoGain);
lfoGain.connect(g.gain);
osc.connect(g); g.connect(master);
osc.start(); lfo.start();
this.musicNode.nodes.push(osc, lfo);
});
},

stopMusic() {
if (!this.musicNode) return;
this.musicNode.nodes.forEach(n => { try { n.stop(); } catch(e){} });
try { this.musicNode.master.disconnect(); } catch(e){}
this.musicNode = null;
}
};

/* ============================================================
6. INPUT MANAGER
============================================================ */
const Input = {
keys: { left: false, right: false, jump: false, crouch: false, interact: false },
prev: { left: false, right: false, jump: false, crouch: false, interact: false },
justPressed: { jump: false, interact: false },
touchActive: false,

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

// Mobile
const bind = (id, action) => {
const el = document.getElementById(id);
if (!el) return;
const press = e => { e.preventDefault(); this.keys[action] = true; this.touchActive = true; };
const release = e => { e.preventDefault(); this.keys[action] = false; };
el.addEventListener('touchstart', press, { passive: false });
el.addEventListener('touchend', release, { passive: false });
el.addEventListener('touchcancel', release, { passive: false });
el.addEventListener('mousedown', press);
el.addEventListener('mouseup', release);
el.addEventListener('mouseleave', release);
};
bind('btn-left', 'left');
bind('btn-right', 'right');
bind('btn-jump', 'jump');
bind('btn-crouch', 'crouch');
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
const clampedX = Math.max(0, Math.min(desiredX, worldW - CFG.W));
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
8. PARTICLE SYSTEM
============================================================ */
class Particle {
constructor(x, y, vx, vy, life, color, size, gravity = 400, fade = true) {
this.x = x; this.y = y; this.vx = vx; this.vy = vy;
this.life = life; this.maxLife = life;
this.color = color; this.size = size;
this.gravity = gravity; this.fade = fade;
this.active = true;
}
update(dt) {
this.x += this.vx * dt;
this.y += this.vy * dt;
this.vy += this.gravity * dt;
this.vx *= 0.98;
this.life -= dt;
if (this.life <= 0) this.active = false;
}
draw(ctx, cam) {
const a = this.fade ? Math.max(0, this.life / this.maxLife) : 1;
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
x, y,
Math.cos(ang) * sp,
Math.sin(ang) * sp - 40,
life * (0.6 + Math.random() * 0.5),
color,
size * (0.7 + Math.random() * 0.6),
gravity
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
draw(ctx, cam) {
for (const p of this.list) p.draw(ctx, cam);
},
clear() { this.list.length = 0; }
};

/* ============================================================
9. PLAYER
============================================================ */
class Player {
constructor(x, y) {
this.x = x; this.y = y;
this.vx = 0; this.vy = 0;
this.width = 36; this.height = 52;
this.prevY = y;
this.onGround = false;
this.wasOnGround = false;
this.facingRight = true;
this.health = 5; this.maxHealth = 5;
this.stamina = 100; this.maxStamina = 100;
this.invincible = 0;
this.isCrouching = false;
this.climbing = false;
this.currentAnim = 'idle';
this.animTimer = 0;
this.animFrame = 0;
this.stepTimer = 0;
this.jumpCount = 0;
this.maxJumps = 2;
this.alive = true;
this.finishLock = false;
}

get bounds() {
const h = this.isCrouching ? this.height * 0.62 : this.height;
return {
x: this.x + 4,
y: this.y + (this.height - h),
w: this.width - 8,
h: h
};
}

setAnim(name, reset = true) {
if (this.currentAnim === name && !reset) return;
if (this.currentAnim !== name) {
this.currentAnim = name;
this.animTimer = 0;
this.animFrame = 0;
}
}

update(dt, platforms, worldW, solids) {
this.wasOnGround = this.onGround;
this.prevY = this.y;

const B = this.bounds;

// Crouch state
const wantCrouch = Input.keys.crouch && this.onGround;
if (wantCrouch !== this.isCrouching) this.isCrouching = wantCrouch;

// Horizontal intent
let ix = 0;
if (Input.keys.left) ix -= 1;
if (Input.keys.right) ix += 1;

if (ix !== 0 && !this.finishLock) this.facingRight = ix > 0;

const maxSpeed = this.isCrouching ? CFG.MOVE_MAX * CFG.CROUCH_SPEED : CFG.MOVE_MAX;

// Accelerate
if (ix !== 0 && !this.finishLock) {
this.vx += ix * CFG.MOVE_ACCEL * dt;
const sp = Math.abs(this.vx);
if (sp > maxSpeed) this.vx = Math.sign(this.vx) * maxSpeed;
} else {
this.vx *= CFG.MOVE_FRICTION;
if (Math.abs(this.vx) < 4) this.vx = 0;
}

// Stamina drain/regen
const running = Math.abs(this.vx) > 60 && !this.isCrouching && this.onGround;
if (running) this.stamina -= CFG.STAMINA_DRAIN * dt;
else this.stamina += CFG.STAMINA_REGEN * dt;
this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina));

if (this.stamina < 5) {
this.vx *= 0.85;
this.setAnim('crouch');
}

// Jump
if (Input.justPressed.jump && !this.finishLock) {
if (this.onGround) {
this.vy = CFG.JUMP_VELOCITY;
this.onGround = false;
this.jumpCount = 1;
Audio.sfx.jump();
Particles.spawn(this.x + this.width/2, this.y + this.height, 8, '#d4a373', 100, 0.5, 300, 3);
} else if (this.jumpCount < this.maxJumps) {
this.vy = CFG.DOUBLE_JUMP_VELOCITY;
this.jumpCount++;
Audio.sfx.jump();
Particles.spawn(this.x + this.width/2, this.y + this.height - 5, 12, '#ffdd88', 140, 0.6, 200, 3);
}
}

// Gravity
this.vy += CFG.GRAVITY * dt;
if (this.vy > CFG.MAX_FALL) this.vy = CFG.MAX_FALL;

// Apply motion
this.x += this.vx * dt;
this.y += this.vy * dt;

// World bounds
this.x = Math.max(0, Math.min(this.x, worldW - this.width));

// Collision with platforms
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
Audio.sfx.land();
Particles.spawn(this.x + this.width/2, this.y + this.height, 10, '#d4a373', 80, 0.4, 300, 3);
}
this.vy = 0;
this.onGround = true;
this.jumpCount = 0;
} else if (this.vy < 0 && b2.y - this.vy * dt >= p.y + p.h - 8) {
this.y = p.y + p.h;
this.vy = 0;
}
} else {
if (this.vx > 0) this.x = p.x - this.width;
else if (this.vx < 0) this.x = p.x + p.w;
this.vx = 0;
}
}
}

// Ground
if (this.y + this.height > CFG.H - 40) {
this.y = CFG.H - 40 - this.height;
if (!this.wasOnGround && this.vy > 200) {
Audio.sfx.land();
Particles.spawn(this.x + this.width/2, this.y + this.height, 10, '#d4a373', 80, 0.4, 300, 3);
}
this.vy = 0;
this.onGround = true;
this.jumpCount = 0;
}

// Invincibility
if (this.invincible > 0) this.invincible -= dt;

// Fallen off
if (this.y > CFG.KILL_Y) {
this.takeDamage(true);
}

// Footsteps
if (this.onGround && Math.abs(this.vx) > 60) {
this.stepTimer -= dt;
if (this.stepTimer <= 0) {
this.stepTimer = 0.28;
Audio.sfx.step();
Particles.spawn(this.x + this.width/2, this.y + this.height, 2, '#b8a888', 40, 0.3, 200, 1.5);
}
}

// Animation state machine
if (this.invincible > 0.1 && Math.abs(this.vx) < 20) {
// Keep current
} else if (!this.onGround) {
this.setAnim(this.vy < 0 ? 'jump' : 'fall');
} else if (this.isCrouching) {
this.setAnim('crouch');
} else if (Math.abs(this.vx) > 20) {
this.setAnim('run');
} else {
this.setAnim('idle');
}

// Advance anim
const spr = Assets.get(this.currentAnim);
if (spr && spr.loaded) {
const fps = (spr.cfg.fps || 8) * (running ? 1.15 : 1);
this.animTimer += dt;
const frameDur = 1 / fps;
if (this.animTimer >= frameDur) {
this.animTimer -= frameDur;
const total = spr.cfg.frames || 1;
if (spr.cfg.loop) this.animFrame = (this.animFrame + 1) % total;
else this.animFrame = Math.min(this.animFrame + 1, total - 1);
}
}
}

takeDamage(forceRespawn = false) {
if (this.invincible > 0 && !forceRespawn) return;
this.health--;
this.invincible = CFG.INVINCIBLE_TIME;
Audio.sfx.hurt();
Particles.spawn(this.x + this.width/2, this.y + this.height/2, 16, '#ff4444', 160, 0.7, 400, 3);
CameraRef.shake(8, 0.4);
if (forceRespawn) {
this.x = Level.lastCheckpoint.x;
this.y = Level.lastCheckpoint.y;
this.vx = 0; this.vy = 0;
}
if (this.health <= 0) {
this.health = 0;
this.alive = false;
Game.gameOver();
}
}

heal(n) {
this.health = Math.min(this.maxHealth, this.health + n);
}

draw(ctx, cam) {
const spr = Assets.get(this.currentAnim);
const sx = this.x - cam.x + cam.offsetX;
const sy = this.y - cam.y + cam.offsetY;

// Invincibility flicker
if (this.invincible > 0 && Math.floor(this.invincible * 16) % 2 === 0) {
ctx.globalAlpha = 0.4;
}

// Shadow
ctx.fillStyle = 'rgba(0,0,0,0.28)';
ctx.beginPath();
ctx.ellipse(sx + this.width/2, sy + this.height + 3, this.width * 0.55, 5, 0, 0, Math.PI * 2);
ctx.fill();

if (spr && spr.loaded) {
const rect = spr.getFrame(this.animFrame);
// Destination size — scale sprite to fit player nicely
const destH = this.height * 1.28; // slightly larger than hitbox
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
// Body
ctx.fillStyle = '#c8b590';
ctx.fillRect(sx + 4, sy + yOff + 14, this.width - 8, h - 20);
// Vest
ctx.fillStyle = '#5a6a4a';
ctx.fillRect(sx + 7, sy + yOff + 18, this.width - 14, h - 26);
// Head
ctx.fillStyle = '#d4a373';
ctx.beginPath();
ctx.arc(sx + this.width/2, sy + yOff + 10, 10, 0, Math.PI * 2);
ctx.fill();
// Helmet
ctx.fillStyle = '#8a7a5a';
ctx.beginPath();
ctx.arc(sx + this.width/2, sy + yOff + 8, 11, Math.PI, 0);
ctx.fill();
ctx.fillRect(sx + this.width/2 - 11, sy + yOff + 6, 22, 4);
// Backpack
ctx.fillStyle = '#2a4a6a';
ctx.fillRect(sx - 3, sy + yOff + 18, 7, 20);
}
}

/* ============================================================
10. COLLECTIBLES / CHECKPOINTS / OBSTACLES / NPCs
============================================================ */
class Collectible {
constructor(x, y, type) {
this.x = x; this.y = y;
this.type = type;
this.width = 22; this.height = 22;
this.collected = false;
this.bob = Math.random() * Math.PI * 2;
this.rot = 0;
}
update(dt) { this.bob += dt * 2.4; this.rot += dt * 2; }
draw(ctx, cam) {
if (this.collected) return;
const sx = this.x - cam.x + cam.offsetX;
const sy = this.y - cam.y + cam.offsetY + Math.sin(this.bob) * 4;

const colors = {
water: ['#44aaff', '#0a5a8a'],
food: ['#ff8844', '#8a3a0a'],
supplies: ['#88cc44', '#3a6a1a'],
star: ['#ffdd00', '#8a6a00']
};
const [c1, c2] = colors[this.type] || ['#fff', '#888'];
const icons = { water: '💧', food: '🥫', supplies: '📦', star: '★' };

ctx.save();
ctx.shadowColor = c1;
ctx.shadowBlur = 14;
ctx.fillStyle = c1;
ctx.beginPath();
ctx.arc(sx + 11, sy + 11, 11, 0, Math.PI * 2);
ctx.fill();
ctx.shadowBlur = 0;
ctx.fillStyle = c2;
ctx.beginPath();
ctx.arc(sx + 11, sy + 11, 11, 0, Math.PI * 2);
ctx.strokeStyle = c1;
ctx.lineWidth = 2;
ctx.stroke();
ctx.fillStyle = '#fff';
ctx.font = 'bold 12px Tahoma';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(icons[this.type] || '?', sx + 11, sy + 12);
ctx.restore();
}
getBounds() { return { x: this.x, y: this.y, w: this.width, h: this.height }; }
}

class Checkpoint {
constructor(x, y) {
this.x = x; this.y = y;
this.width = 26; this.height = 50;
this.activated = false;
this.pulse = 0;
}
update(dt) { this.pulse += dt * 4; }
draw(ctx, cam) {
const sx = this.x - cam.x + cam.offsetX;
const sy = this.y - cam.y + cam.offsetY;
// Base
ctx.fillStyle = '#5a4a3a';
ctx.fillRect(sx + 10, sy + this.height - 6, 6, 6);
// Pole
ctx.fillStyle = '#8a8a8a';
ctx.fillRect(sx + 12, sy, 3, this.height - 6);
// Light
const lightColor = this.activated ? '#44ff44' : '#ff4444';
ctx.fillStyle = lightColor;
ctx.beginPath();
ctx.arc(sx + 13.5, sy - 3, 5, 0, Math.PI * 2);
ctx.fill();
if (this.activated) {
const glow = 0.6 + Math.sin(this.pulse) * 0.4;
ctx.globalAlpha = glow * 0.6;
ctx.beginPath();
ctx.arc(sx + 13.5, sy - 3, 12, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = 1;
}
// Flag
ctx.fillStyle = this.activated ? '#44dd44' : '#dd4444';
ctx.beginPath();
ctx.moveTo(sx + 15, sy + 4);
ctx.lineTo(sx + 30, sy + 12);
ctx.lineTo(sx + 15, sy + 20);
ctx.closePath();
ctx.fill();
}
getBounds() { return { x: this.x - 6, y: this.y - 10, w: this.width + 12, h: this.height + 14 }; }
}

class Obstacle {
constructor(x, y, w, h, type) {
this.x = x; this.y = y;
this.width = w; this.height = h;
this.type = type;
this.shake = 0;
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
ctx.closePath();
ctx.fill();
ctx.fillStyle = '#9a8a7a';
ctx.beginPath();
ctx.moveTo(sx + this.width * 0.25, sy + 4);
ctx.lineTo(sx + this.width * 0.55, sy);
ctx.lineTo(sx + this.width * 0.6, sy + this.height);
ctx.lineTo(sx + this.width * 0.35, sy + this.height);
ctx.closePath();
ctx.fill();
} else if (this.type === 'cactus') {
ctx.fillStyle = '#2a5a2a';
ctx.fillRect(sx + this.width/2 - 5, sy, 10, this.height);
ctx.fillRect(sx, sy + this.height * 0.35, this.width, 7);
ctx.fillRect(sx, sy + this.height * 0.15, 6, 15);
ctx.fillStyle = '#3a7a3a';
ctx.fillRect(sx + this.width/2 - 4, sy + 4, 3, this.height - 8);
// Spikes
ctx.strokeStyle = '#aae0aa';
ctx.lineWidth = 1;
for (let i = 0; i < 6; i++) {
const sy2 = sy + 8 + i * (this.height - 16) / 6;
ctx.beginPath();
ctx.moveTo(sx + this.width/2 - 5, sy2);
ctx.lineTo(sx + this.width/2 - 8, sy2 + 2);
ctx.moveTo(sx + this.width/2 + 5, sy2);
ctx.lineTo(sx + this.width/2 + 8, sy2 + 2);
ctx.stroke();
}
} else if (this.type === 'barbed') {
ctx.fillStyle = '#6a6a6a';
ctx.fillRect(sx, sy + this.height/2 - 1, this.width, 2);
ctx.fillRect(sx, sy + this.height/2 - 20, this.width, 2);
ctx.fillRect(sx, sy + this.height/2 + 18, this.width, 2);
for (let i = 0; i < 5; i++) {
const px = sx + i * (this.width / 5);
ctx.fillRect(px, sy, 2, this.height);
ctx.beginPath();
ctx.moveTo(px - 4, sy + 5);
ctx.lineTo(px + 6, sy + 5);
ctx.moveTo(px - 4, sy + this.height - 5);
ctx.lineTo(px + 6, sy + this.height - 5);
ctx.strokeStyle = '#8a8a8a';
ctx.stroke();
}
}
}
getBounds() {
if (this.type === 'barbed') return { x: this.x + 6, y: this.y + 4, w: this.width - 12, h: this.height - 8 };
return { x: this.x + 4, y: this.y + 4, w: this.width - 8, h: this.height - 8 };
}
}

class NPC {
constructor(x, y, name, dialogue) {
this.x = x; this.y = y;
this.name = name;
this.dialogue = dialogue;
this.width = 30; this.height = 48;
this.bob = 0;
this.talked = false;
}
update(dt) { this.bob += dt * 2; }
draw(ctx, cam) {
const sx = this.x - cam.x + cam.offsetX;
const sy = this.y - cam.y + cam.offsetY + Math.sin(this.bob) * 2;
// Body
ctx.fillStyle = '#b8a888';
ctx.fillRect(sx + 4, sy + 14, this.width - 8, this.height - 20);
// Vest
ctx.fillStyle = '#4a5a3a';
ctx.fillRect(sx + 7, sy + 18, this.width - 14, this.height - 26);
// Head
ctx.fillStyle = '#d4a373';
ctx.beginPath();
ctx.arc(sx + this.width/2, sy + 10, 10, 0, Math.PI * 2);
ctx.fill();
// Helmet
ctx.fillStyle = '#8a7a5a';
ctx.beginPath();
ctx.arc(sx + this.width/2, sy + 8, 11, Math.PI, 0);
ctx.fill();
// Name tag
ctx.fillStyle = 'rgba(0,0,0,0.7)';
ctx.fillRect(sx - 10, sy - 30, this.width + 20, 18);
ctx.fillStyle = '#ffdd88';
ctx.font = 'bold 11px Tahoma';
ctx.textAlign = 'center';
ctx.fillText(this.name, sx + this.width/2, sy - 17);
// Exclamation
if (!this.talked) {
ctx.fillStyle = '#ffdd00';
ctx.font = 'bold 22px Tahoma';
ctx.fillText('!', sx + this.width/2, sy - 34);
}
}
getBounds() { return { x: this.x - 20, y: this.y - 20, w: this.width + 40, h: this.height + 30 }; }
}

/* ============================================================
11. LEVELS DATA
============================================================ */
const LEVELS = [
{
id: 0,
name: 'بداية الدورية',
op: 'DESERT WATCH',
grid: 'GRID 22-R',
time: '05:45',
loc: 'جنوب البحر الأحمر',
objective: 'الوصول إلى نقطة المراقبة',
hint: 'تنقّل بحذر. الطريق طويل.',
worldWidth: 2600,
dark: false, sandstorm: false,
platforms: [
{ x: 0, y: 480, w: 400, h: 60 },
{ x: 470, y: 440, w: 220, h: 100 },
{ x: 740, y: 400, w: 180, h: 140 },
{ x: 970, y: 460, w: 260, h: 80 },
{ x: 1280, y: 420, w: 200, h: 120 },
{ x: 1530, y: 380, w: 160, h: 160 },
{ x: 1740, y: 440, w: 260, h: 100 },
{ x: 2050, y: 400, w: 200, h: 140 },
{ x: 2300, y: 480, w: 300, h: 60 }
 ],
collectibles: [
{ x: 200, y: 430, type: 'water' },
{ x: 520, y: 400, type: 'food' },
{ x: 800, y: 350, type: 'supplies' },
{ x: 1050, y: 410, type: 'star' },
{ x: 1350, y: 370, type: 'water' },
{ x: 1600, y: 330, type: 'food' },
{ x: 1850, y: 390, type: 'supplies' },
{ x: 2130, y: 350, type: 'star' }
 ],
obstacles: [
{ x: 440, y: 460, w: 22, h: 22, type: 'rock' },
{ x: 950, y: 440, w: 18, h: 22, type: 'cactus' },
{ x: 1270, y: 460, w: 24, h: 22, type: 'rock' },
{ x: 2040, y: 460, w: 20, h: 22, type: 'cactus' }
 ],
checkpoints: [{ x: 1150, y: 430 }],
npcs: [],
finishX: 2480
},
{
id: 1,
name: 'طريق الجبال',
op: 'MOUNTAIN PASS',
grid: 'GRID 24-Q',
time: '07:20',
loc: 'المرتفعات الجبلية',
objective: 'اعبر الطريق الجبلي بأمان',
hint: 'احذر من الانهيارات الصخرية.',
worldWidth: 2900,
dark: false, sandstorm: false,
platforms: [
{ x: 0, y: 490, w: 320, h: 50 },
{ x: 380, y: 440, w: 180, h: 100 },
{ x: 620, y: 380, w: 160, h: 160 },
{ x: 840, y: 320, w: 200, h: 220 },
{ x: 1100, y: 400, w: 220, h: 140 },
{ x: 1380, y: 350, w: 160, h: 190 },
{ x: 1600, y: 420, w: 240, h: 120 },
{ x: 1900, y: 370, w: 180, h: 170 },
{ x: 2130, y: 440, w: 260, h: 100 },
{ x: 2440, y: 490, w: 460, h: 50 }
 ],
collectibles: [
{ x: 150, y: 440, type: 'water' },
{ x: 450, y: 400, type: 'food' },
{ x: 700, y: 340, type: 'supplies' },
{ x: 900, y: 280, type: 'star' },
{ x: 1180, y: 360, type: 'water' },
{ x: 1450, y: 310, type: 'food' },
{ x: 1680, y: 380, type: 'supplies' },
{ x: 1970, y: 330, type: 'star' },
{ x: 2250, y: 400, type: 'water' }
 ],
obstacles: [
{ x: 360, y: 460, w: 20, h: 22, type: 'rock' },
{ x: 830, y: 300, w: 22, h: 22, type: 'rock' },
{ x: 1080, y: 380, w: 22, h: 22, type: 'rock' },
{ x: 1880, y: 460, w: 22, h: 22, type: 'rock' },
{ x: 2110, y: 420, w: 22, h: 22, type: 'cactus' }
 ],
checkpoints: [
{ x: 1050, y: 380 },
{ x: 1850, y: 400 }
 ],
npcs: [],
finishX: 2750
},
{
id: 2,
name: 'الوادي الصخري',
op: 'ROCKY VALLEY',
grid: 'GRID 26-N',
time: '09:15',
loc: 'الوادي الجاف',
objective: 'اعبر الوادي واجمع 5 مؤن',
hint: 'أهلاً بك في الوادي. الطريق وعر.',
worldWidth: 3100,
dark: false, sandstorm: false,
platforms: [
{ x: 0, y: 490, w: 300, h: 50 },
{ x: 350, y: 450, w: 130, h: 90 },
{ x: 530, y: 400, w: 110, h: 140 },
{ x: 690, y: 350, w: 130, h: 190 },
{ x: 870, y: 400, w: 110, h: 140 },
{ x: 1030, y: 450, w: 160, h: 90 },
{ x: 1240, y: 400, w: 140, h: 140 },
{ x: 1430, y: 350, w: 120, h: 190 },
{ x: 1600, y: 400, w: 150, h: 140 },
{ x: 1800, y: 450, w: 190, h: 90 },
{ x: 2040, y: 400, w: 130, h: 140 },
{ x: 2220, y: 350, w: 140, h: 190 },
{ x: 2410, y: 420, w: 210, h: 120 },
{ x: 2670, y: 490, w: 430, h: 50 }
 ],
collectibles: [
{ x: 120, y: 440, type: 'water' },
{ x: 580, y: 350, type: 'supplies' },
{ x: 740, y: 300, type: 'star' },
{ x: 1080, y: 410, type: 'food' },
{ x: 1290, y: 350, type: 'supplies' },
{ x: 1650, y: 350, type: 'water' },
{ x: 1870, y: 410, type: 'supplies' },
{ x: 2080, y: 350, type: 'star' },
{ x: 2270, y: 300, type: 'food' },
{ x: 2500, y: 380, type: 'supplies' }
 ],
obstacles: [
{ x: 330, y: 430, w: 22, h: 22, type: 'rock' },
{ x: 1010, y: 430, w: 22, h: 22, type: 'rock' },
{ x: 1580, y: 380, w: 22, h: 22, type: 'rock' },
{ x: 2020, y: 430, w: 22, h: 22, type: 'rock' },
{ x: 2650, y: 470, w: 22, h: 22, type: 'cactus' }
 ],
checkpoints: [
{ x: 1000, y: 430 },
{ x: 1790, y: 430 }
 ],
npcs: [],
finishX: 2950
},
{
id: 3,
name: 'العاصفة الرملية',
op: 'SANDSTORM',
grid: 'GRID 28-S',
time: '11:40',
loc: 'صحراء مفتوحة',
objective: 'الوصول للمنطقة الآمنة قبل نفاذ الطاقة',
hint: 'احتمِ! العاصفة قادمة.',
worldWidth: 2700,
dark: false, sandstorm: true,
sandstormStart: 3,
platforms: [
{ x: 0, y: 490, w: 400, h: 50 },
{ x: 450, y: 450, w: 200, h: 90 },
{ x: 700, y: 410, w: 180, h: 130 },
{ x: 940, y: 450, w: 240, h: 90 },
{ x: 1230, y: 410, w: 160, h: 130 },
{ x: 1440, y: 360, w: 140, h: 180 },
{ x: 1630, y: 420, w: 220, h: 120 },
{ x: 1900, y: 380, w: 160, h: 160 },
{ x: 2110, y: 450, w: 280, h: 90 },
{ x: 2440, y: 490, w: 260, h: 50 }
 ],
collectibles: [
{ x: 180, y: 440, type: 'water' },
{ x: 540, y: 410, type: 'food' },
{ x: 780, y: 370, type: 'supplies' },
{ x: 1000, y: 410, type: 'water' },
{ x: 1290, y: 370, type: 'star' },
{ x: 1500, y: 320, type: 'water' },
{ x: 1720, y: 380, type: 'food' },
{ x: 1980, y: 340, type: 'water' },
{ x: 2250, y: 410, type: 'star' }
 ],
obstacles: [
{ x: 430, y: 470, w: 22, h: 22, type: 'rock' },
{ x: 920, y: 430, w: 22, h: 22, type: 'rock' },
{ x: 1210, y: 390, w: 22, h: 22, type: 'rock' },
{ x: 1880, y: 460, w: 22, h: 22, type: 'rock' },
{ x: 2090, y: 430, w: 22, h: 22, type: 'cactus' }
 ],
checkpoints: [
{ x: 1180, y: 410 },
{ x: 2080, y: 430 }
 ],
npcs: [],
finishX: 2580
},
{
id: 4,
name: 'الكهف',
op: 'CAVE PATROL',
grid: 'GRID 30-K',
time: '14:20',
loc: 'الكهف الجبلي',
objective: 'اعثر على حقيبة الإسعافات',
hint: 'الظلام دامس. تحرك بحذر.',
worldWidth: 2400,
dark: true, sandstorm: false,
platforms: [
{ x: 0, y: 490, w: 320, h: 50 },
{ x: 370, y: 450, w: 160, h: 90 },
{ x: 580, y: 400, w: 140, h: 140 },
{ x: 770, y: 360, w: 130, h: 180 },
{ x: 950, y: 410, w: 190, h: 130 },
{ x: 1190, y: 370, w: 150, h: 170 },
{ x: 1390, y: 420, w: 210, h: 120 },
{ x: 1650, y: 380, w: 160, h: 160 },
{ x: 1860, y: 430, w: 210, h: 110 },
{ x: 2120, y: 490, w: 280, h: 50 }
 ],
collectibles: [
{ x: 150, y: 440, type: 'water' },
{ x: 430, y: 410, type: 'food' },
{ x: 640, y: 360, type: 'supplies' },
{ x: 820, y: 320, type: 'star' },
{ x: 1000, y: 370, type: 'water' },
{ x: 1250, y: 330, type: 'food' },
{ x: 1450, y: 380, type: 'star' },
{ x: 1720, y: 340, type: 'water' },
{ x: 1920, y: 390, type: 'supplies' }
 ],
obstacles: [
{ x: 350, y: 430, w: 22, h: 22, type: 'rock' },
{ x: 750, y: 340, w: 22, h: 22, type: 'rock' },
{ x: 1170, y: 350, w: 22, h: 22, type: 'rock' },
{ x: 1630, y: 440, w: 22, h: 22, type: 'rock' }
 ],
checkpoints: [
{ x: 930, y: 430 }
 ],
npcs: [],
finishX: 2280
},
{
id: 5,
name: 'إنقاذ الجندي',
op: 'RESCUE OP',
grid: 'GRID 32-R',
time: '16:55',
loc: 'منطقة الدوريات',
objective: 'ساعد الجندي العالق',
hint: 'جندي يحتاج مساعدتك. أسرع.',
worldWidth: 2700,
dark: false, sandstorm: false,
platforms: [
{ x: 0, y: 490, w: 350, h: 50 },
{ x: 400, y: 450, w: 180, h: 90 },
{ x: 630, y: 400, w: 160, h: 140 },
{ x: 840, y: 350, w: 200, h: 190 },
{ x: 1090, y: 410, w: 220, h: 130 },
{ x: 1360, y: 370, w: 150, h: 170 },
{ x: 1560, y: 420, w: 260, h: 120 },
{ x: 1870, y: 380, w: 170, h: 160 },
{ x: 2090, y: 460, w: 260, h: 80 },
{ x: 2400, y: 490, w: 300, h: 50 }
 ],
collectibles: [
{ x: 200, y: 440, type: 'supplies' },
{ x: 480, y: 410, type: 'water' },
{ x: 700, y: 360, type: 'food' },
{ x: 900, y: 310, type: 'star' },
{ x: 1150, y: 370, type: 'supplies' },
{ x: 1420, y: 330, type: 'water' },
{ x: 1650, y: 380, type: 'food' },
{ x: 1930, y: 340, type: 'star' },
{ x: 2180, y: 420, type: 'supplies' }
 ],
obstacles: [
{ x: 380, y: 470, w: 22, h: 22, type: 'rock' },
{ x: 820, y: 330, w: 22, h: 22, type: 'rock' },
{ x: 1340, y: 440, w: 22, h: 22, type: 'cactus' },
{ x: 1850, y: 440, w: 22, h: 22, type: 'rock' }
 ],
checkpoints: [
{ x: 800, y: 430 },
{ x: 1830, y: 420 }
 ],
npcs: [
{ x: 2250, y: 420, name: 'الجندي محمود', dialogue: 'يا سيد! الحمد لله، كنت محتاج مساعدة.' }
 ],
finishX: 2580
},
{
id: 6,
name: 'الطريق الليلي',
op: 'NIGHT RUN',
grid: 'GRID 34-N',
time: '21:30',
loc: 'طريق العودة',
objective: 'الوصول لنقطة الحراسة قبل الفجر',
hint: 'الليل طويل. لا تتوقف.',
worldWidth: 2900,
dark: true, sandstorm: false,
platforms: [
{ x: 0, y: 490, w: 300, h: 50 },
{ x: 350, y: 450, w: 160, h: 90 },
{ x: 560, y: 400, w: 140, h: 140 },
{ x: 750, y: 360, w: 130, h: 180 },
{ x: 930, y: 410, w: 190, h: 130 },
{ x: 1170, y: 370, w: 150, h: 170 },
{ x: 1370, y: 420, w: 210, h: 120 },
{ x: 1630, y: 380, w: 160, h: 160 },
{ x: 1840, y: 430, w: 220, h: 110 },
{ x: 2110, y: 490, w: 300, h: 50 },
{ x: 2460, y: 450, w: 200, h: 90 }
 ],
collectibles: [
{ x: 150, y: 440, type: 'water' },
{ x: 420, y: 410, type: 'food' },
{ x: 620, y: 360, type: 'supplies' },
{ x: 800, y: 320, type: 'star' },
{ x: 980, y: 370, type: 'water' },
{ x: 1220, y: 330, type: 'food' },
{ x: 1430, y: 380, type: 'supplies' },
{ x: 1700, y: 340, type: 'water' },
{ x: 1910, y: 390, type: 'star' },
{ x: 2250, y: 440, type: 'food' }
 ],
obstacles: [
{ x: 330, y: 430, w: 22, h: 22, type: 'rock' },
{ x: 730, y: 340, w: 22, h: 22, type: 'rock' },
{ x: 1150, y: 350, w: 22, h: 22, type: 'rock' },
{ x: 1610, y: 440, w: 22, h: 22, type: 'rock' },
{ x: 2090, y: 470, w: 22, h: 22, type: 'cactus' }
 ],
checkpoints: [
{ x: 910, y: 430 },
{ x: 1820, y: 420 }
 ],
npcs: [],
finishX: 2780
},
{
id: 7,
name: 'العودة النهائية',
op: 'FINAL RETURN',
grid: 'GRID 36-R',
time: '04:50',
loc: 'نقطة الحراسة',
objective: 'العودة إلى نقطة الحراسة بأمان',
hint: 'آخر مرحلة. أثبت أنك جدير بالثقة.',
worldWidth: 3000,
dark: false, sandstorm: false,
platforms: [
{ x: 0, y: 490, w: 400, h: 50 },
{ x: 450, y: 450, w: 200, h: 90 },
{ x: 700, y: 400, w: 180, h: 140 },
{ x: 930, y: 450, w: 220, h: 90 },
{ x: 1200, y: 400, w: 160, h: 140 },
{ x: 1410, y: 350, w: 140, h: 190 },
{ x: 1600, y: 410, w: 200, h: 130 },
{ x: 1850, y: 370, w: 160, h: 170 },
{ x: 2060, y: 430, w: 250, h: 110 },
{ x: 2360, y: 400, w: 180, h: 140 },
{ x: 2590, y: 490, w: 410, h: 50 }
 ],
collectibles: [
{ x: 200, y: 440, type: 'star' },
{ x: 500, y: 410, type: 'star' },
{ x: 750, y: 360, type: 'star' },
{ x: 1000, y: 410, type: 'water' },
{ x: 1260, y: 360, type: 'star' },
{ x: 1470, y: 310, type: 'star' },
{ x: 1700, y: 370, type: 'water' },
{ x: 1920, y: 330, type: 'star' },
{ x: 2180, y: 390, type: 'food' },
{ x: 2450, y: 360, type: 'star' }
 ],
obstacles: [
{ x: 430, y: 470, w: 22, h: 22, type: 'rock' },
{ x: 680, y: 380, w: 22, h: 22, type: 'rock' },
{ x: 1180, y: 380, w: 22, h: 22, type: 'rock' },
{ x: 1830, y: 460, w: 22, h: 22, type: 'rock' },
{ x: 2040, y: 410, w: 22, h: 22, type: 'cactus' }
 ],
checkpoints: [
{ x: 1150, y: 400 },
{ x: 2040, y: 410 }
 ],
npcs: [],
finishX: 2900
}
];

/* ============================================================
12. LEVEL RUNTIME
============================================================ */
const Level = {
data: null,
platforms: [],
collectibles: [],
checkpoints: [],
obstacles: [],
npcs: [],
particles: [],
lastCheckpoint: { x: 60, y: 400 },
startX: 60, startY: 400,
worldWidth: 2600,
time: 0,
stormTimer: 0,
stormIntensity: 0,
collectTarget: 0,
collectedCount: 0,

load(index) {
this.data = LEVELS[index];
this.worldWidth = this.data.worldWidth;
this.platforms = this.data.platforms.map(p => ({...p}));
this.collectibles = this.data.collectibles.map(c => new Collectible(c.x, c.y, c.type));
this.checkpoints = this.data.checkpoints.map(c => new Checkpoint(c.x, c.y));
this.obstacles = this.data.obstacles.map(o => new Obstacle(o.x, o.y, o.w, o.h, o.type));
this.npcs = (this.data.npcs || []).map(n => new NPC(n.x, n.y, n.name, n.dialogue));
this.startX = 60;
this.startY = 400;
this.lastCheckpoint = { x: this.startX, y: this.startY };
this.time = 0;
this.stormTimer = 0;
this.stormIntensity = 0;
this.collectedCount = 0;

// Count target collectibles (supplies only for objective)
this.collectTarget = this.data.collectibles.filter(c => c.type === 'supplies').length;

Particles.clear();
},

update(dt) {
this.time += dt;
this.stormTimer += dt;

for (const c of this.collectibles) c.update(dt);
for (const cp of this.checkpoints) cp.update(dt);
for (const n of this.npcs) n.update(dt);

// Sandstorm intensity
if (this.data.sandstorm && this.stormTimer > (this.data.sandstormStart || 3)) {
this.stormIntensity = Math.min(1, (this.stormTimer - (this.data.sandstormStart || 3)) / 6);
}
},

draw(ctx, cam) {
// Platforms
for (const p of this.platforms) {
const sx = p.x - cam.x + cam.offsetX;
const sy = p.y - cam.y + cam.offsetY;
if (sx + p.w < -100 || sx > CFG.W + 100) continue;

// Body
ctx.fillStyle = this.data.dark ? '#3a3528' : '#8a7a6a';
ctx.fillRect(sx, sy, p.w, p.h);
// Top surface
ctx.fillStyle = this.data.dark ? '#4a4538' : '#c8b590';
ctx.fillRect(sx, sy, p.w, 10);
// Texture
ctx.fillStyle = 'rgba(0,0,0,0.15)';
for (let i = 0; i < p.w; i += 26) ctx.fillRect(sx + i, sy + 12, 2, 2);
// Shadow
ctx.fillStyle = 'rgba(0,0,0,0.25)';
ctx.fillRect(sx, sy + p.h, p.w, 5);
}

// Obstacles
for (const o of this.obstacles) o.draw(ctx, cam);

// Checkpoints
for (const c of this.checkpoints) c.draw(ctx, cam);

// Collectibles
for (const c of this.collectibles) c.draw(ctx, cam);

// NPCs
for (const n of this.npcs) n.draw(ctx, cam);

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
ctx.closePath();
ctx.fill();
ctx.fillStyle = '#fff';
ctx.font = 'bold 10px Consolas, monospace';
ctx.textAlign = 'center';
ctx.fillText('EXTRACT', fx + 20, fy - 128);
}
};

/* ============================================================
13. BACKGROUND RENDERER
============================================================ */
const Background = {
draw(ctx, cam, data) {
// Sky
const grad = ctx.createLinearGradient(0, 0, 0, CFG.H);
if (data.dark) {
grad.addColorStop(0, '#05050f');
grad.addColorStop(0.5, '#0f0f20');
grad.addColorStop(1, '#1a1a30');
} else if (data.sandstorm) {
grad.addColorStop(0, '#a08050');
grad.addColorStop(0.6, '#d4a373');
grad.addColorStop(1, '#e0c090');
} else {
grad.addColorStop(0, '#3a6ba8');
grad.addColorStop(0.5, '#7aa9d0');
grad.addColorStop(0.8, '#d4c090');
grad.addColorStop(1, '#e8c890');
}
ctx.fillStyle = grad;
ctx.fillRect(0, 0, CFG.W, CFG.H);

// Sun / Moon
if (data.dark) {
ctx.fillStyle = '#e8e8d0';
ctx.beginPath();
ctx.arc(CFG.W * 0.78, 120, 26, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = 'rgba(232,232,208,0.15)';
ctx.beginPath();
ctx.arc(CFG.W * 0.78, 120, 50, 0, Math.PI * 2);
ctx.fill();
// Stars
ctx.fillStyle = '#fff';
for (let i = 0; i < 40; i++) {
const sx = (i * 137) % CFG.W;
const sy = (i * 71) % 200;
const tw = 0.5 + Math.abs(Math.sin(cam.x * 0.001 + i)) * 0.5;
ctx.globalAlpha = tw;
ctx.fillRect(sx, sy, 1.5, 1.5);
}
ctx.globalAlpha = 1;
} else {
const sunColor = data.sandstorm ? '#ffddaa' : '#ffe4a0';
ctx.fillStyle = sunColor;
ctx.beginPath();
ctx.arc(CFG.W * 0.72, 130, 40, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = data.sandstorm ? 'rgba(255,200,120,0.2)' : 'rgba(255,220,150,0.25)';
ctx.beginPath();
ctx.arc(CFG.W * 0.72, 130, 80, 0, Math.PI * 2);
ctx.fill();
}

// Far mountains (slowest parallax)
const off1 = cam.x * 0.08;
ctx.fillStyle = data.dark ? '#0a0a18' : (data.sandstorm ? '#8a6a4a' : '#7a6a5a');
ctx.beginPath();
ctx.moveTo(0, CFG.H);
for (let i = -100; i <= CFG.W + 100; i += 30) {
const wx = i + off1;
const y = 250 + Math.sin(wx * 0.004) * 70 + Math.cos(wx * 0.009) * 40;
ctx.lineTo(i, y);
}
ctx.lineTo(CFG.W, CFG.H);
ctx.closePath();
ctx.fill();

// Mid mountains
const off2 = cam.x * 0.18;
ctx.fillStyle = data.dark ? '#15152a' : (data.sandstorm ? '#a08060' : '#9a8a7a');
ctx.beginPath();
ctx.moveTo(0, CFG.H);
for (let i = -100; i <= CFG.W + 100; i += 25) {
const wx = i + off2;
const y = 320 + Math.sin(wx * 0.007) * 55 + Math.cos(wx * 0.013) * 30;
ctx.lineTo(i, y);
}
ctx.lineTo(CFG.W, CFG.H);
ctx.closePath();
ctx.fill();

// Near desert / ground
const off3 = cam.x * 0.35;
ctx.fillStyle = data.dark ? '#2a2518' : (data.sandstorm ? '#c8a373' : '#d4b088');
ctx.fillRect(0, 400, CFG.W, CFG.H - 400);

// Sand ripples
ctx.strokeStyle = data.dark ? 'rgba(80,70,50,0.4)' : 'rgba(180,150,110,0.5)';
ctx.lineWidth = 1.5;
for (let i = 0; i < 12; i++) {
const rx = ((i * 180 - off3) % (CFG.W + 200)) - 100;
const ry = 420 + (i % 4) * 30;
ctx.beginPath();
for (let k = 0; k < 100; k += 6) {
const waveY = ry + Math.sin(k * 0.08 + i) * 4;
if (k === 0) ctx.moveTo(rx + k, waveY);
else ctx.lineTo(rx + k, waveY);
}
ctx.stroke();
}

// Foreground silhouettes
const off4 = cam.x * 0.55;
ctx.fillStyle = data.dark ? '#0a0a05' : 'rgba(90,70,50,0.7)';
for (let i = 0; i < 6; i++) {
const rx = ((i * 320 - off4) % (CFG.W + 400)) - 200;
ctx.beginPath();
ctx.moveTo(rx, CFG.H);
ctx.lineTo(rx + 60, 380 + (i % 3) * 20);
ctx.lineTo(rx + 120, CFG.H);
ctx.closePath();
ctx.fill();
}

// Distant watchtower
if (data.id === 0 || data.id === 7) {
const tx = 500 - cam.x * 0.15;
const twx = ((tx % (CFG.W + 200)) + CFG.W + 200) % (CFG.W + 200) - 100;
ctx.fillStyle = data.dark ? '#1a1a2a' : '#5a4a3a';
ctx.fillRect(twx, 220, 4, 100);
ctx.fillRect(twx - 8, 220, 20, 20);
ctx.fillRect(twx - 12, 215, 28, 6);
// Radar dish
ctx.beginPath();
ctx.arc(twx + 2, 218, 6, 0, Math.PI);
ctx.fill();
}
},

drawStormOverlay(ctx, intensity, time) {
if (intensity <= 0) return;
// Sand fog
ctx.fillStyle = rgba(180, 150, 100, ${intensity * 0.25}); ctx.fillRect(0, 0, CFG.W, CFG.H); // Streaks for (let i = 0; i &lt; 60; i++) { const sx = ((i * 89 + time * 400 * intensity) % (CFG.W + 200)) - 100; const sy = (i * 53) % CFG.H; const len = 20 + Math.random() * 40; ctx.strokeStyle =rgba(210, 180, 120, ${0.2 + Math.random() * 0.25});
ctx.lineWidth = 1 + Math.random();
ctx.beginPath();
ctx.moveTo(sx, sy);
ctx.lineTo(sx - len, sy + 4);
ctx.stroke();
}
// Vignette
const vg = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 100, CFG.W/2, CFG.H/2, 700);
vg.addColorStop(0, 'rgba(0,0,0,0)');
vg.addColorStop(1, rgba(0,0,0,${intensity * 0.5})`);
ctx.fillStyle = vg;
ctx.fillRect(0, 0, CFG.W, CFG.H);
},

drawDarkOverlay(ctx) {
const vg = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 80, CFG.W/2, CFG.H/2, 480);
vg.addColorStop(0, 'rgba(0,0,0,0)');
vg.addColorStop(1, 'rgba(0,0,20,0.85)');
ctx.fillStyle = vg;
ctx.fillRect(0, 0, CFG.W, CFG.H);
}
};

/* ============================================================
14. HUD & UI MANAGER
============================================================ */
const UI = {
els: {},
init() {
const ids = [
'hudOpName','hudTime','hudGrid','hudRank',
'healthFill','staminaFill',
'hudScore','missionText','compassNeedle','compassDir','objectiveProgress',
'radioText','radioChatter','loaderFill','loaderPct',
'statScore','statTime','statItems','statHealth','rankAward',
'overScore','overLevel','menuHighScore','menuSayed',
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
// Compass direction
const dirs = ['N','NE','E','SE','S','SW','W','NW'];
const idx = player.facingRight ? 2 : 6; // east/west
this.els.compassDir.textContent = dirs[idx];
this.els.compassNeedle.style.transform = rotate(${player.facingRight ? 90 : -90}deg); // Objective progress const done = level.collectibles.filter(c =&gt; c.collected && c.type === 'supplies').length; if (level.collectTarget &gt; 0) { this.els.objectiveProgress.textContent =SUPPLIES {level.collectTarget}; } else { const total = level.collectibles.length; const got = level.collectibles.filter(c =&gt; c.collected).length; this.els.objectiveProgress.textContent =INTEL {total}`;
}
},

showRadio(text, duration = 3000) {
if (!this.els.radioChatter) return;
this.els.radioText.textContent = text;
this.els.radioChatter.classList.remove('hidden');
Audio.sfx.radio();
clearTimeout(this._radioT);
this._radioT = setTimeout(() => {
this.els.radioChatter.classList.add('hidden');
}, duration);
},

showBriefing(levelData, index) {
this.els.briefingNum.textContent = MISSION ${String(index + 1).padStart(2, '0')}`;
this.els.briefingTitle.textContent = levelData.name;
this.els.briefingLoc.textContent = levelData.loc;
this.els.briefingTime.textContent = levelData.time + ' — ' + (index < 4 ? 'نهاراً' : 'متابعة');
this.els.briefingObjective.textContent = levelData.objective;
this.els.briefingHint.textContent = levelData.hint;
document.getElementById('briefing').classList.remove('hidden');
},

showComplete(stats) {
this.els.statScore.textContent = stats.score;
this.els.statTime.textContent = stats.time.toFixed(1) + 's';
this.els.statItems.textContent = stats.items;
this.els.statHealth.textContent = stats.health + '/' + stats.maxHealth;
// Rank award
const pct = (stats.score / 400) * 3;
const stars = Math.max(1, Math.min(3, Math.round(pct)));
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
grid.innerHTML = '';
LEVELS.forEach((lvl, i) => {
const card = document.createElement('div');
card.className = 'mission-card';
if (i >= unlocked) card.classList.add('locked');
if (i < unlocked - 1 || (i === current && i < unlocked)) card.classList.add('completed');
card.innerHTML = &lt;div class="num"&gt;${String(i+1).padStart(2,'0')}</div>
<div class="name">{i < unlocked ? (i < current ? '✓ مكتملة' : 'متاحة') : '🔒 مقفلة'}</div>
`;
if (i < unlocked) {
card.addEventListener('click', () => {
Audio.sfx.select();
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
15. GAME CONTROLLER
============================================================ */
const Game = {
state: STATES.LOADING,
score: 0,
currentLevel: 0,
unlockedLevels: 1,
highScore: 0,
lastFrame: 0,
player: null,
camera: null,
running: false,

init() {
UI.init();
Input.init();

// Load save
try {
const save = JSON.parse(localStorage.getItem('sayed_save_v2'));
if (save) {
this.unlockedLevels = save.unlockedLevels || 1;
this.highScore = save.highScore || 0;
}
} catch(e){}

// Show menu
this.state = STATES.MENU;
document.getElementById('mainMenu').classList.remove('hidden');
if (UI.els.menuHighScore) UI.els.menuHighScore.textContent = 'HIGH SCORE: ' + this.highScore;
// Menu Sayed image
const menuSayed = UI.els.menuSayed;
if (menuSayed && Assets.get('hero') && Assets.get('hero').loaded) {
menuSayed.style.backgroundImage = url(${SPRITE_REGISTRY.hero.url})`;
}

// Bind menu
document.getElementById('menuStart').onclick = () => { Audio.init(); Audio.resume(); Audio.sfx.select(); this.startLevel(0); };
document.getElementById('menuContinue').onclick = () => {
Audio.init(); Audio.resume(); Audio.sfx.select();
const lvl = Math.min(this.unlockedLevels - 1, LEVELS.length - 1);
this.startLevel(lvl);
};
document.getElementById('menuMissions').onclick = () => { Audio.sfx.select(); UI.showMissionGrid(this.unlockedLevels, this.currentLevel); };
document.getElementById('menuSettings').onclick = () => {
Audio.sfx.select();
document.getElementById('settingsPanel').classList.remove('hidden');
};
document.getElementById('menuManual').onclick = () => {
Audio.sfx.select();
document.getElementById('manualPanel').classList.remove('hidden');
};

// Bind panels
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
Audio.sfx.select();
document.getElementById('briefing').classList.add('hidden');
this.beginPlay();
};

// Bind pause & overlays
document.getElementById('btn-pause').onclick = () => this.togglePause();
document.getElementById('btnResume').onclick = () => this.togglePause();
document.getElementById('btnRestart').onclick = () => { Audio.sfx.select(); this.restartLevel(); };
document.getElementById('btnQuit').onclick = () => { Audio.sfx.select(); this.returnToMenu(); };
document.getElementById('btnNext').onclick = () => { Audio.sfx.select(); this.nextLevel(); };
document.getElementById('btnRetry').onclick = () => { Audio.sfx.select(); this.restartLevel(); };
document.getElementById('btnMenuFromOver').onclick = () => { Audio.sfx.select(); this.returnToMenu(); };

// Settings sliders
const bindSlider = (id, key, valId) => {
const el = document.getElementById(id);
const lbl = document.getElementById(valId);
el.addEventListener('input', () => {
const v = parseFloat(el.value);
Audio.setVolume(key, v);
lbl.textContent = Math.round(v * 100) + '%';
});
};
bindSlider('volMaster', 'master', 'volMasterVal');
bindSlider('volMusic', 'music', 'volMusicVal');
bindSlider('volSfx', 'sfx', 'volSfxVal');

// Start RAF loop
requestAnimationFrame(this.loop.bind(this));
},

startLevel(index) {
this.currentLevel = Math.max(0, Math.min(index, LEVELS.length - 1));
document.getElementById('mainMenu').classList.add('hidden');
UI.showBriefing(LEVELS[this.currentLevel], this.currentLevel);
this.state = STATES.BRIEFING;
},

beginPlay() {
// Create / reset player
this.player = new Player(Level.startX, Level.startY);
this.camera = new Camera();
window.CameraRef = this.camera;

Level.load(this.currentLevel);
this.player.x = Level.startX;
this.player.y = Level.startY;

this.score = 0;
this.state = STATES.PLAYING;
this.running = true;

// Show HUD
document.getElementById('hud').classList.remove('hidden');
document.getElementById('btn-pause').classList.remove('hidden');

// Show mobile controls if touch
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.getElementById('mobile-controls').classList.remove('hidden');

// Hide all overlays
['missionComplete','gameOver','pauseOverlay','briefing','missionsPanel','manualPanel','settingsPanel'].forEach(id => {
document.getElementById(id)?.classList.add('hidden');
});

// Music
if (Audio.ctx) Audio.startMusic();

// Intro radio
setTimeout(() => UI.showRadio('سيّد، ابدأ الدورية. تأكد من جمع المؤن.', 4000), 800);
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
this.running = false;
Audio.stopMusic();
document.getElementById('hud').classList.add('hidden');
document.getElementById('btn-pause').classList.add('hidden');
document.getElementById('mobile-controls').classList.add('hidden');
document.getElementById('pauseOverlay').classList.add('hidden');
document.getElementById('gameOver').classList.add('hidden');
document.getElementById('missionComplete').classList.add('hidden');
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
Audio.stopMusic();
if (this.score > this.highScore) this.highScore = this.score;
this.save();
UI.showGameOver(this.score, this.currentLevel);
document.getElementById('mobile-controls').classList.add('hidden');
},

completeLevel() {
this.state = STATES.COMPLETE;
Audio.stopMusic();
Audio.sfx.complete();
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
localStorage.setItem('sayed_save_v2', JSON.stringify({
unlockedLevels: this.unlockedLevels,
highScore: this.highScore,
currentLevel: this.currentLevel
}));
} catch(e){}
},

// ---- MAIN LOOP ----
loop(t) {
const dt = Math.min((t - this.lastFrame) / 1000, 0.05);
this.lastFrame = t;

const ctx = canvas.getContext('2d');

if (this.state === STATES.PLAYING) {
this.update(dt);
this.render(ctx, dt);
} else if (this.state === STATES.PAUSED) {
// Freeze
this.render(ctx, 0);
} else if (this.state === STATES.MENU || this.state === STATES.BRIEFING || this.state === STATES.COMPLETE || this.state === STATES.OVER) {
// Draw background only for visual continuity
ctx.fillStyle = '#0a0a15';
ctx.fillRect(0, 0, CFG.W, CFG.H);
}

Input.update();
requestAnimationFrame(this.loop.bind(this));
},

update(dt) {
const p = this.player;

p.update(dt, Level.platforms, Level.worldWidth, Level.obstacles);
Level.update(dt);
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
const values = { water: 10, food: 15, supplies: 25, star: 50 };
this.score += values[c.type] || 10;
Audio.sfx.pickup();
Particles.spawn(c.x + 11, c.y + 11, 8, '#ffdd88', 140, 0.6, 200, 3);
if (c.type === 'water') { p.stamina = Math.min(p.maxStamina, p.stamina + 35); UI.showRadio('💧 +طاقة'); }
if (c.type === 'food') { p.heal(1); UI.showRadio('🥫 +صحة'); }
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
Audio.sfx.checkpoint();
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

// NPC interaction
if (Input.justPressed.interact) {
for (const n of Level.npcs) {
const nb = n.getBounds();
const pb = p.bounds;
if (pb.x + pb.w > nb.x && pb.x < nb.x + nb.w &&
pb.y + pb.h > nb.y && pb.y < nb.y + nb.h) {
if (!n.talked) {
n.talked = true;
this.score += 100;
UI.showRadio(📻${n.name}: "latex
{n.dialogue}"`, 5000); Particles.spawn(n.x + 15, n.y, 15, '#ffdd44', 120, 0.8, 200, 3); } else { UI.showRadio(`📻 

{n.name}: "تحرك يا سيد، الوقت لا يرحم."`, 3000);
}
break;
}
}
}

// Sandstorm damage
if (Level.data.sandstorm && Level.stormIntensity > 0.4) {
p.stamina -= 8 * dt;
if (p.stamina <= 0 && Math.random() < 0.05) {
p.health -= 1;
Audio.sfx.hurt();
}
}

// Finish
if (p.x >= Level.data.finishX && !p.finishLock) {
p.finishLock = true;
this.completeLevel();
return;
}

// Update HUD
UI.updateHUD(p, Level);

// Sandstorm particles
if (Level.data.sandstorm && Level.stormIntensity > 0.2) {
if (Math.random() < 0.5) {
Particles.spawn(
this.camera.x + CFG.W + 40,
Math.random() * CFG.H,
1, '#d4a373',
0, 0.7, -30, 2
);
// Override velocity for wind
const last = Particles.list[Particles.list.length - 1];
if (last) {
last.vx = -(300 + Math.random() * 400) * Level.stormIntensity;
last.vy = (Math.random() - 0.5) * 60;
}
}
}
},

render(ctx, dt) {
// Background
Background.draw(ctx, this.camera, Level.data);

// World
Level.draw(ctx, this.camera);

// Particles
Particles.draw(ctx, this.camera);

// Player
this.player.draw(ctx, this.camera);

// Storm overlay
if (Level.data.sandstorm) Background.drawStormOverlay(ctx, Level.stormIntensity, Level.time);
if (Level.data.dark) Background.drawDarkOverlay(ctx);

// Extra glow filter
if (Level.data.dark) {
ctx.save();
ctx.globalCompositeOperation = 'lighter';
const glow = ctx.createRadialGradient(
this.player.x - this.camera.x,
this.player.y - this.camera.y,
0,
this.player.x - this.camera.x,
this.player.y - this.camera.y,
180
);
glow.addColorStop(0, 'rgba(255,220,150,0.18)');
glow.addColorStop(1, 'rgba(255,220,150,0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, CFG.W, CFG.H);
ctx.restore();
}
}
};

/* ============================================================
16. BOOTSTRAP
============================================================ */
(function bootstrap() {
const loaderFill = document.getElementById('loaderFill');
const loaderPct = document.getElementById('loaderPct');
const loadingScreen = document.getElementById('loading-screen');

Assets.loadAll((progress) => {
const pct = Math.round(progress * 100);
if (loaderFill) loaderFill.style.width = pct + '%';
if (loaderPct) loaderPct.textContent = pct + '%';
}).then(() => {
setTimeout(() => {
loadingScreen.classList.add('hide');
setTimeout(() => {
loadingScreen.style.display = 'none';
Game.init();
}, 500);
}, 300);
});

// Prevent context menu on mobile
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

// Handle visibility change
document.addEventListener('visibilitychange', () => {
if (document.hidden && Game.state === STATES.PLAYING) {
Game.togglePause();
}
});
})();