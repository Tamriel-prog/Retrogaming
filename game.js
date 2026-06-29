(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const muteButton = document.querySelector("#mute");
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const keys = new Set();
  const touch = Object.create(null);
  let last = performance.now();
  let audio;

  const game = {
    state: "title",
    time: 0,
    shake: 0,
    distance: 0,
    score: 0,
    waveTimer: 0,
    bossIntro: false,
    muted: false,
    player: makePlayer(),
    stars: makeStars(),
    enemies: [],
    shots: [],
    enemyShots: [],
    particles: [],
    powerups: [],
    floatText: []
  };

  function makePlayer() {
    return {
      x: 96,
      y: H * 0.5,
      vx: 0,
      vy: 0,
      r: 17,
      hp: 5,
      maxHp: 5,
      lives: 3,
      fireTimer: 0,
      invuln: 0,
      charge: 0,
      level: 1,
      speed: 260,
      shield: 0,
      droneAngle: 0,
      droneActive: true
    };
  }

  function makeStars() {
    return Array.from({ length: 140 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      z: rand(0.35, 1.8),
      c: Math.random() > 0.82 ? "#3ff7ff" : "#edf8ff"
    }));
  }

  function reset() {
    game.state = "running";
    game.time = 0;
    game.shake = 0;
    game.distance = 0;
    game.score = 0;
    game.waveTimer = 0;
    game.bossIntro = false;
    game.player = makePlayer();
    game.enemies.length = 0;
    game.shots.length = 0;
    game.enemyShots.length = 0;
    game.particles.length = 0;
    game.powerups.length = 0;
    game.floatText.length = 0;
    toast("LAUNCH", 110, game.player.y - 42, "#3ff7ff");
    beep(220, 0.08, "sawtooth", 0.05);
  }

  function addEnemy(type, x = W + 40, y = rand(70, H - 80)) {
    const base = {
      type,
      x,
      y,
      ox: x,
      oy: y,
      vx: -90,
      vy: 0,
      r: 18,
      hp: 2,
      maxHp: 2,
      t: 0,
      fire: rand(0.4, 1.6),
      score: 120
    };

    if (type === "drifter") Object.assign(base, { vx: -135, hp: 2, maxHp: 2, r: 16 });
    if (type === "sine") Object.assign(base, { vx: -105, hp: 3, maxHp: 3, r: 18, score: 180 });
    if (type === "seeker") Object.assign(base, { vx: -84, hp: 4, maxHp: 4, r: 20, score: 260 });
    if (type === "turret") Object.assign(base, { vx: -58, hp: 6, maxHp: 6, r: 23, score: 380 });
    if (type === "mine") Object.assign(base, { vx: -112, hp: 1, maxHp: 1, r: 14, score: 90 });
    if (type === "boss") {
      Object.assign(base, {
        x: W + 170,
        y: H * 0.5,
        vx: -38,
        hp: 120,
        maxHp: 120,
        r: 74,
        fire: 1,
        score: 6500,
        phase: 0
      });
    }

    game.enemies.push(base);
    return base;
  }

  function spawnWave() {
    const d = game.distance;
    if (d > 3800 && !game.bossIntro) {
      game.bossIntro = true;
      game.enemies.length = Math.min(game.enemies.length, 2);
      addEnemy("boss");
      toast("WARNING", W - 250, 82, "#ff4d7d");
      beep(90, 0.25, "square", 0.05);
      return;
    }

    const roll = Math.random();
    if (roll < 0.25) {
      for (let i = 0; i < 4; i++) addEnemy("drifter", W + i * 58, 95 + i * 76);
    } else if (roll < 0.48) {
      const y = rand(115, H - 120);
      for (let i = 0; i < 5; i++) addEnemy("sine", W + i * 64, y);
    } else if (roll < 0.68) {
      addEnemy("turret", W + 40, rand(85, H - 100));
      addEnemy("mine", W + 180, rand(70, H - 80));
    } else if (roll < 0.86) {
      addEnemy("seeker", W + 55, rand(90, H - 90));
      addEnemy("drifter", W + 150, rand(70, H - 80));
    } else {
      for (let i = 0; i < 8; i++) addEnemy("mine", W + i * 44, rand(60, H - 60));
    }
  }

  function fireShot(power = 1, charged = false) {
    const p = game.player;
    const spread = p.level >= 2 ? 9 : 0;
    const count = p.level >= 3 ? 3 : p.level >= 2 ? 2 : 1;
    const baseDamage = charged ? 6 + power * 5 : 1.45;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      game.shots.push({
        x: p.x + 25,
        y: p.y + offset,
        vx: charged ? 520 : 440,
        vy: offset * 3,
        r: charged ? 9 + power * 6 : 5,
        damage: baseDamage,
        charged,
        life: charged ? 1.25 : 1.05
      });
    }

    if (p.droneActive) {
      const d = dronePosition();
      game.shots.push({ x: d.x + 12, y: d.y, vx: 460, vy: 0, r: 4, damage: 0.9, charged: false, life: 0.9 });
    }

    beep(charged ? 150 : 520, charged ? 0.16 : 0.035, charged ? "sawtooth" : "square", charged ? 0.05 : 0.025);
  }

  function enemyFire(e, aimed = false) {
    const p = game.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const angle = aimed ? Math.atan2(dy, dx) : Math.PI;
    const speed = e.type === "boss" ? 190 : 150;
    game.enemyShots.push({
      x: e.x - e.r * 0.55,
      y: e.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: e.type === "boss" ? 7 : 5,
      life: 4,
      hot: e.type === "boss"
    });
  }

  function dronePosition() {
    const p = game.player;
    return {
      x: p.x + Math.cos(p.droneAngle) * 28 + 8,
      y: p.y + Math.sin(p.droneAngle) * 28
    };
  }

  function update(dt) {
    if (game.state !== "running") {
      updateBackground(dt);
      updateParticles(dt);
      return;
    }

    const p = game.player;
    game.time += dt;
    game.distance += dt * 52;
    game.waveTimer -= dt;
    game.shake = Math.max(0, game.shake - dt * 20);
    p.invuln = Math.max(0, p.invuln - dt);
    p.fireTimer = Math.max(0, p.fireTimer - dt);
    p.droneAngle += dt * 2.6;

    updateBackground(dt);
    updatePlayer(dt);
    updateShots(dt);
    updateEnemies(dt);
    updatePowerups(dt);
    updateParticles(dt);
    collide();

    if (!game.bossIntro && game.waveTimer <= 0) {
      spawnWave();
      game.waveTimer = rand(1.2, 2.25);
    }

    if (game.bossIntro && !game.enemies.some((e) => e.type === "boss") && game.state === "running") {
      game.state = "victory";
      toast("SECTOR CLEARED", W * 0.5 - 130, H * 0.5, "#3ff7ff");
      beep(440, 0.18, "sawtooth", 0.05);
      setTimeout(() => beep(660, 0.18, "sawtooth", 0.05), 140);
    }
  }

  function updateBackground(dt) {
    const speed = game.state === "running" ? 1 : 0.42;
    for (const s of game.stars) {
      s.x -= dt * (40 + s.z * 92) * speed;
      if (s.x < -4) {
        s.x = W + rand(0, 40);
        s.y = rand(0, H);
        s.z = rand(0.35, 1.8);
      }
    }
  }

  function updatePlayer(dt) {
    const p = game.player;
    const left = keys.has("arrowleft") || keys.has("a") || touch.left;
    const right = keys.has("arrowright") || keys.has("d") || touch.right;
    const up = keys.has("arrowup") || keys.has("w") || touch.up;
    const down = keys.has("arrowdown") || keys.has("s") || touch.down;
    const charging = keys.has("x") || touch.charge;
    const firing = keys.has(" ") || touch.fire;
    const mx = (right ? 1 : 0) - (left ? 1 : 0);
    const my = (down ? 1 : 0) - (up ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    const speed = p.speed * (keys.has("shift") ? 0.66 : 1);

    p.vx = (mx / len) * speed;
    p.vy = (my / len) * speed;
    p.x = clamp(p.x + p.vx * dt, 32, W * 0.58);
    p.y = clamp(p.y + p.vy * dt, 42, H - 42);

    if (charging) {
      p.charge = clamp(p.charge + dt, 0, 1.65);
      if (p.charge > 0.18 && Math.random() < dt * 18) {
        spark(p.x + 22, p.y + rand(-16, 16), "#ffcf5a", 1);
      }
    }

    if (!charging && p.charge > 0.22) {
      fireShot(clamp(p.charge / 1.65, 0.2, 1), true);
      p.charge = 0;
      p.fireTimer = 0.18;
    } else if (!charging) {
      p.charge = 0;
    }

    if (firing && p.fireTimer <= 0 && !charging) {
      fireShot();
      p.fireTimer = Math.max(0.085, 0.17 - p.level * 0.018);
    }
  }

  function updateShots(dt) {
    for (const shot of game.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.charged) spark(shot.x - shot.r, shot.y + rand(-shot.r, shot.r), "#ffcf5a", 0.6);
    }

    for (const shot of game.enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
    }

    game.shots = game.shots.filter((s) => s.life > 0 && s.x < W + 80 && s.y > -60 && s.y < H + 60);
    game.enemyShots = game.enemyShots.filter((s) => s.life > 0 && s.x > -80 && s.y > -80 && s.y < H + 80);
  }

  function updateEnemies(dt) {
    for (const e of game.enemies) {
      e.t += dt;
      e.x += e.vx * dt;

      if (e.type === "sine") {
        e.y = e.oy + Math.sin(e.t * 3.2) * 58;
      } else if (e.type === "seeker") {
        e.y += clamp(game.player.y - e.y, -95, 95) * dt;
        e.fire -= dt;
        if (e.fire <= 0 && e.x < W - 80) {
          enemyFire(e, true);
          e.fire = rand(1.35, 2.05);
        }
      } else if (e.type === "turret") {
        e.y += Math.sin(e.t * 2.1) * 26 * dt;
        e.fire -= dt;
        if (e.fire <= 0 && e.x < W - 80) {
          enemyFire(e, true);
          e.fire = rand(1.0, 1.45);
        }
      } else if (e.type === "mine") {
        e.y += Math.sin(e.t * 5 + e.oy) * 42 * dt;
        if (Math.hypot(e.x - game.player.x, e.y - game.player.y) < 95) e.vx = -210;
      } else if (e.type === "boss") {
        e.x = Math.max(W - 155, e.x);
        e.y = H * 0.5 + Math.sin(e.t * 1.35) * 118;
        e.phase = Math.floor(e.t / 4) % 3;
        e.fire -= dt;
        if (e.fire <= 0) {
          if (e.phase === 0) {
            for (let i = -1; i <= 1; i++) {
              game.enemyShots.push({ x: e.x - 72, y: e.y + i * 28, vx: -210, vy: i * 48, r: 6, life: 4, hot: true });
            }
            e.fire = 0.62;
          } else if (e.phase === 1) {
            for (let i = 0; i < 8; i++) {
              const a = Math.PI + (i - 3.5) * 0.13;
              game.enemyShots.push({ x: e.x - 76, y: e.y, vx: Math.cos(a) * 178, vy: Math.sin(a) * 178, r: 5, life: 4, hot: true });
            }
            e.fire = 1.05;
          } else {
            enemyFire(e, true);
            e.fire = 0.34;
          }
        }
      }
    }

    game.enemies = game.enemies.filter((e) => e.hp > 0 && e.x > -170);
  }

  function updatePowerups(dt) {
    for (const item of game.powerups) {
      item.x -= dt * 92;
      item.y += Math.sin(game.time * 4 + item.x * 0.02) * dt * 34;
      item.spin += dt * 4;
    }
    game.powerups = game.powerups.filter((p) => p.x > -40);
  }

  function updateParticles(dt) {
    for (const group of [game.particles, game.floatText]) {
      for (const p of group) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.size) p.size *= 0.985;
      }
    }
    game.particles = game.particles.filter((p) => p.life > 0);
    game.floatText = game.floatText.filter((p) => p.life > 0);
  }

  function collide() {
    const p = game.player;
    for (const shot of game.shots) {
      for (const e of game.enemies) {
        if (dist(shot, e) < shot.r + e.r * 0.76) {
          e.hp -= shot.damage;
          shot.life = shot.charged ? shot.life * 0.72 : -1;
          spark(shot.x, shot.y, shot.charged ? "#ffcf5a" : "#3ff7ff", shot.charged ? 7 : 3);
          game.shake = Math.max(game.shake, shot.charged ? 5 : 1.8);
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
    }

    for (const e of game.enemies) {
      if (p.invuln <= 0 && dist(p, e) < p.r + e.r * 0.68) {
        hurt(1 + (e.type === "boss" ? 1 : 0));
        e.hp -= e.type === "boss" ? 2 : 99;
        if (e.hp <= 0) killEnemy(e);
      }
    }

    for (const shot of game.enemyShots) {
      if (p.invuln <= 0 && dist(p, shot) < p.r + shot.r) {
        shot.life = -1;
        hurt(1);
      }
    }

    for (const item of game.powerups) {
      if (dist(p, item) < p.r + item.r) {
        applyPowerup(item.kind);
        item.x = -99;
      }
    }
  }

  function killEnemy(e) {
    e.hp = -1;
    game.score += e.score;
    explode(e.x, e.y, e.type === "boss" ? 42 : 16, e.type === "boss" ? "#ffcf5a" : "#ff4d7d");
    toast(`+${e.score}`, e.x - 16, e.y - 12, "#ffcf5a");
    game.shake = Math.max(game.shake, e.type === "boss" ? 16 : 5);
    beep(e.type === "boss" ? 70 : 120, e.type === "boss" ? 0.26 : 0.08, "sawtooth", 0.04);

    if (e.type !== "boss" && Math.random() < 0.22) {
      const kinds = ["repair", "power", "shield", "speed"];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      game.powerups.push({ x: e.x, y: e.y, r: 13, kind, spin: 0 });
    }
  }

  function applyPowerup(kind) {
    const p = game.player;
    if (kind === "repair") p.hp = Math.min(p.maxHp, p.hp + 1);
    if (kind === "power") p.level = Math.min(4, p.level + 1);
    if (kind === "shield") p.shield = Math.min(3, p.shield + 1);
    if (kind === "speed") p.speed = Math.min(340, p.speed + 28);
    toast(kind.toUpperCase(), p.x + 20, p.y - 34, "#3ff7ff");
    beep(760, 0.08, "triangle", 0.04);
  }

  function hurt(amount) {
    const p = game.player;
    if (p.shield > 0) {
      p.shield -= 1;
      amount = 0;
      toast("SHIELD", p.x - 18, p.y - 38, "#3ff7ff");
    }
    p.hp -= amount;
    p.invuln = 1.4;
    game.shake = 12;
    explode(p.x, p.y, 18, "#ff4d7d");
    beep(66, 0.18, "square", 0.055);

    if (p.hp <= 0) {
      p.lives -= 1;
      if (p.lives < 0) {
        game.state = "gameover";
        toast("GAME OVER", W * 0.5 - 112, H * 0.5, "#ff4d7d");
        return;
      }
      p.hp = p.maxHp;
      p.x = 96;
      p.y = H * 0.5;
      p.level = Math.max(1, p.level - 1);
      p.invuln = 2.2;
      toast("RESERVE SHIP", 86, p.y - 44, "#ffcf5a");
    }
  }

  function spark(x, y, color, amount = 1) {
    for (let i = 0; i < amount; i++) {
      game.particles.push({
        x,
        y,
        vx: rand(-70, 45),
        vy: rand(-55, 55),
        size: rand(1.5, 4.5),
        color,
        life: rand(0.18, 0.48)
      });
    }
  }

  function explode(x, y, amount, color) {
    for (let i = 0; i < amount; i++) {
      const a = rand(0, TAU);
      const s = rand(45, 255);
      game.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: rand(2, 8),
        color: Math.random() > 0.45 ? color : "#edf8ff",
        life: rand(0.32, 0.9)
      });
    }
  }

  function toast(text, x, y, color) {
    game.floatText.push({ text, x, y, vx: 0, vy: -26, life: 1.25, color });
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function draw() {
    ctx.save();
    const ox = game.shake ? rand(-game.shake, game.shake) : 0;
    const oy = game.shake ? rand(-game.shake, game.shake) : 0;
    ctx.translate(ox, oy);
    drawBackground();
    drawHazards();
    drawPowerups();
    drawShots();
    drawEnemies();
    drawPlayer();
    drawParticles();
    ctx.restore();
    drawHud();
    if (game.state !== "running") drawOverlay();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#071018");
    g.addColorStop(0.46, "#0b1822");
    g.addColorStop(1, "#140c17");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of game.stars) {
      ctx.globalAlpha = 0.35 + s.z * 0.3;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x | 0, s.y | 0, Math.max(1, s.z * 2) | 0, 1);
    }
    ctx.globalAlpha = 1;

    drawTerrain(64, "#132833", "#21414c", 0.22);
    drawTerrain(H - 72, "#201521", "#5d2639", -0.2);
  }

  function drawTerrain(base, fill, edge, sign) {
    ctx.beginPath();
    ctx.moveTo(0, sign > 0 ? 0 : H);
    for (let x = 0; x <= W + 24; x += 24) {
      const y = base + Math.sin((x + game.distance * 3) * 0.018) * 18 + Math.sin((x + game.distance) * 0.041) * 9;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, sign > 0 ? 0 : H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawHazards() {
    const gap = 190;
    const phase = (game.distance * 1.4) % gap;
    ctx.strokeStyle = "rgba(63,247,255,0.12)";
    ctx.lineWidth = 2;
    for (let x = W - phase; x > -gap; x -= gap) {
      ctx.beginPath();
      ctx.moveTo(x, 58);
      ctx.lineTo(x - 54, H - 58);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (p.invuln > 0 && Math.floor(game.time * 18) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    const flame = 14 + Math.sin(game.time * 45) * 5 + Math.max(0, -p.vx) * 0.02;
    pixelPoly([[-25, -7], [-42, 0], [-25, 7], [-18, 0]], "#ffcf5a");
    pixelPoly([[-20 - flame, -4], [-36 - flame, 0], [-20 - flame, 4]], "#ff4d7d");
    pixelPoly([[-18, -16], [21, -6], [30, 0], [21, 6], [-18, 16], [-8, 0]], "#d9f5ff");
    pixelPoly([[-8, -19], [10, -7], [-6, -2]], "#3ff7ff");
    pixelPoly([[-8, 19], [10, 7], [-6, 2]], "#3ff7ff");
    pixelPoly([[3, -5], [23, 0], [3, 5]], "#ffcf5a");
    ctx.fillStyle = "#101820";
    ctx.fillRect(-4, -5, 13, 10);
    ctx.fillStyle = "#3ff7ff";
    ctx.fillRect(2, -3, 6, 6);

    if (p.charge > 0.12) {
      ctx.strokeStyle = p.charge > 1.2 ? "#ffcf5a" : "#3ff7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(31, 0, 8 + p.charge * 11, 0, TAU);
      ctx.stroke();
    }

    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(63,247,255,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 29 + Math.sin(game.time * 8) * 2, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    if (p.droneActive) {
      const d = dronePosition();
      ctx.save();
      ctx.translate(d.x, d.y);
      pixelPoly([[-10, -8], [10, -5], [14, 0], [10, 5], [-10, 8], [-4, 0]], "#ffcf5a");
      ctx.fillStyle = "#101820";
      ctx.fillRect(-3, -3, 7, 6);
      ctx.restore();
    }
  }

  function drawShots() {
    for (const s of game.shots) {
      ctx.fillStyle = s.charged ? "#ffcf5a" : "#3ff7ff";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = s.charged ? 18 : 10;
      ctx.fillRect(s.x - s.r, s.y - s.r * 0.45, s.r * 2.8, s.r * 0.9);
      ctx.shadowBlur = 0;
    }

    for (const s of game.enemyShots) {
      ctx.fillStyle = s.hot ? "#ff4d7d" : "#ffcf5a";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#edf8ff";
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.type === "boss") drawBoss(e);
      else if (e.type === "mine") {
        pixelPoly([[0, -15], [15, 0], [0, 15], [-15, 0]], "#ff4d7d");
        ctx.fillStyle = "#ffcf5a";
        ctx.fillRect(-4, -4, 8, 8);
      } else if (e.type === "turret") {
        pixelPoly([[-22, -18], [18, -16], [25, 0], [18, 16], [-22, 18], [-14, 0]], "#8ca4ad");
        ctx.fillStyle = "#ff4d7d";
        ctx.fillRect(-34, -5, 22, 10);
        ctx.fillStyle = "#101820";
        ctx.fillRect(-2, -8, 12, 16);
      } else if (e.type === "seeker") {
        pixelPoly([[22, 0], [5, -18], [-22, -11], [-12, 0], [-22, 11], [5, 18]], "#ffcf5a");
        ctx.fillStyle = "#ff4d7d";
        ctx.fillRect(-3, -5, 12, 10);
      } else {
        pixelPoly([[18, 0], [0, -15], [-22, -8], [-10, 0], [-22, 8], [0, 15]], e.type === "sine" ? "#3ff7ff" : "#ff4d7d");
        ctx.fillStyle = "#101820";
        ctx.fillRect(-3, -4, 9, 8);
      }
      drawHealthBar(e);
      ctx.restore();
    }
  }

  function drawBoss(e) {
    const pulse = Math.sin(e.t * 5) * 3;
    pixelPoly([[-72, -58], [24, -74], [84, -34], [72, 36], [16, 76], [-78, 52], [-98, 0]], "#794258");
    pixelPoly([[-64, -35], [26, -48], [60, -16], [52, 22], [12, 44], [-62, 34], [-78, 0]], "#b6596c");
    ctx.fillStyle = "#101820";
    ctx.fillRect(-18, -26, 34, 52);
    ctx.fillStyle = e.phase === 2 ? "#ff4d7d" : "#ffcf5a";
    ctx.fillRect(-8, -15 - pulse, 17, 30 + pulse * 2);
    ctx.fillStyle = "#3ff7ff";
    ctx.fillRect(-78, -8, 34, 16);
    ctx.fillStyle = "#ff4d7d";
    ctx.fillRect(-108, -7, 34, 14);
  }

  function drawHealthBar(e) {
    if (e.maxHp <= 3) return;
    const w = e.type === "boss" ? 130 : 36;
    const y = e.type === "boss" ? -92 : -30;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-w / 2, y, w, 5);
    ctx.fillStyle = e.type === "boss" ? "#ff4d7d" : "#ffcf5a";
    ctx.fillRect(-w / 2, y, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }

  function drawPowerups() {
    const colors = { repair: "#76ff8f", power: "#ffcf5a", shield: "#3ff7ff", speed: "#ff4d7d" };
    const labels = { repair: "+", power: "P", shield: "S", speed: ">" };
    for (const p of game.powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = colors[p.kind];
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = "#edf8ff";
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.rotate(-p.spin);
      ctx.fillStyle = "#101820";
      ctx.font = "bold 15px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[p.kind], 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    for (const t of game.floatText) {
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    const p = game.player;
    ctx.fillStyle = "rgba(4, 10, 13, 0.72)";
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = "#edf8ff";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${String(game.score).padStart(7, "0")}`, 14, 22);
    ctx.fillText(`LIVES ${Math.max(0, p.lives)}`, 208, 22);
    ctx.fillText(`POWER ${p.level}`, 310, 22);
    ctx.fillText(`SHIELD ${p.shield}`, 410, 22);

    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? "#ff4d7d" : "#263945";
      ctx.fillRect(W - 152 + i * 24, 11, 16, 12);
    }

    const progress = clamp(game.distance / 3800, 0, 1);
    ctx.fillStyle = "#263945";
    ctx.fillRect(W * 0.5 + 72, 14, 132, 7);
    ctx.fillStyle = game.bossIntro ? "#ff4d7d" : "#3ff7ff";
    ctx.fillRect(W * 0.5 + 72, 14, 132 * progress, 7);
  }

  function drawOverlay() {
    ctx.fillStyle = "rgba(2, 5, 7, 0.62)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#edf8ff";
    ctx.font = "900 58px Impact, sans-serif";
    const title = game.state === "title" ? "VOID CORSAIR" : game.state === "paused" ? "PAUSED" : game.state === "victory" ? "VICTORY" : "GAME OVER";
    ctx.fillText(title, W / 2, H / 2 - 42);
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = game.state === "gameover" ? "#ff4d7d" : "#3ff7ff";
    const line = game.state === "title"
      ? "Premi Enter o Space per iniziare"
      : game.state === "victory"
        ? `Settore liberato - Score ${game.score}`
        : "Premi Enter per ripartire";
    ctx.fillText(line, W / 2, H / 2 + 6);
    ctx.fillStyle = "#ffcf5a";
    ctx.font = "bold 14px monospace";
    ctx.fillText("Space spara  |  X carica  |  Shift precisione  |  P pausa", W / 2, H / 2 + 42);
  }

  function pixelPoly(points, fill) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#071014";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function beep(freq, duration, type, gainValue) {
    if (game.muted) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(gainValue, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch {
      game.muted = true;
    }
  }

  function togglePause() {
    if (game.state === "running") game.state = "paused";
    else if (game.state === "paused") game.state = "running";
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
    keys.add(key);
    if ((key === "enter" || key === " ") && ["title", "gameover", "victory"].includes(game.state)) reset();
    if (key === "p") togglePause();
  });

  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

  document.querySelectorAll("[data-touch]").forEach((button) => {
    const name = button.dataset.touch;
    const set = (value) => {
      touch[name] = value;
      if (game.state === "title" && (name === "fire" || name === "charge")) reset();
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      set(true);
    });
    button.addEventListener("pointerup", () => set(false));
    button.addEventListener("pointercancel", () => set(false));
    button.addEventListener("pointerleave", () => set(false));
  });

  muteButton.addEventListener("click", () => {
    game.muted = !game.muted;
    muteButton.textContent = game.muted ? "Audio Off" : "Audio On";
    muteButton.setAttribute("aria-pressed", String(game.muted));
  });

  requestAnimationFrame(frame);
})();
