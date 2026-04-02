/**
 * Archery lock: bow lower-left. Shoot a flying patrol drone (moving mark). Gravity on the arrow.
 * Only the main egg-shaped drone body clears the lock.
 */
window.ArcheryMinigame = (function archeryIife() {
  const SOUND_SWISH = "assets/sounds/arrow-swish.mp3";
  const SOUND_HIT = "assets/sounds/arrow-hitting-target.mp3";
  const SOUND_BLAST = "assets/sounds/explosion-fx.mp3";

  /** Logical resolution — wide field (CSS + canvas buffer must match) */
  const W = 1024;
  const H = 576;
  /** Tuned so a full draw can reach the far side with drone patrol */
  const GRAVITY = 0.178;
  const POWER_K = 0.56;
  const MIN_PULL = 28;
  const MAX_PULL = 318;
  const MAX_FRAMES = 1100;
  const BOW_GRAB_R = 82;

  let audioSwish = null;
  let audioHit = null;
  let audioBlast = null;

  function getAudio(src) {
    try {
      const a = new Audio(src);
      a.preload = "auto";
      return a;
    } catch {
      return null;
    }
  }

  function play(kind) {
    if (kind === "swish") {
      if (!audioSwish) {
        audioSwish = getAudio(SOUND_SWISH);
      }
      if (audioSwish) {
        audioSwish.currentTime = 0;
        audioSwish.play().catch(() => {});
      }
      return;
    }
    if (kind === "blast") {
      if (!audioBlast) {
        audioBlast = getAudio(SOUND_BLAST);
      }
      if (audioBlast) {
        audioBlast.volume = 0.72;
        audioBlast.currentTime = 0;
        audioBlast.play().catch(() => {});
      }
      return;
    }
    if (!audioHit) {
      audioHit = getAudio(SOUND_HIT);
    }
    if (audioHit) {
      audioHit.currentTime = 0;
      audioHit.play().catch(() => {});
    }
  }

  const GROUND_Y = H - 64;
  const BOW = { x: 96, y: H - 82 };
  /** Limb tips: bowstring anchors (real thread) */
  const BOW_TIP_TOP = { x: 176, y: H - 118 };
  const BOW_TIP_BOT = { x: 176, y: H - 50 };
  /** Arrow leaves from nock (grip area) */
  const LAUNCH = { x: 150, y: H - 100 };
  /** Hit radius for scoring (drone patrol uses full sky — see getDroneCenterWorld) */
  const DRONE = { hitR: 78 };
  /** >1 speeds up patrol / weave (harder to lead shots). */
  const DRONE_MOTION_SCALE = 1.7;
  /**
   * "Egg" body hit zone (success).
   * drawDrone() renders the main body as ellipse(0, 2, 24, 15) after translate(cx, cy),
   * so the core center is (cx, cy + 2).
   */
  const DRONE_CORE = { rx: 24, ry: 15, yOff: 2 };
  // Allow a little tolerance so "egg body" matches the drawn ellipse.
  const EGG_HIT_U = 1.15;

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let rafId = 0;
  let surfaceRafId = 0;
  let blastRafId = 0;
  /** @type {{ x: number, y: number, startMs: number, score: number } | null} */
  let blastAnim = null;
  let animToken = 0;
  let phase = "idle";
  let callbacks = null;
  let showImpact = null;

  let aimActive = false;
  let pullX = 0;
  let pullY = 0;
  let pointerId = null;

  let downHandler;
  let moveHandler;
  let upHandler;
  let cancelHandler;
  let leaveHandler;

  function canvasToLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  /** Legacy distance-based scoring helper (core hit now uses a rotated ellipse). */
  function scoreFromDistance(d) {
    if (d >= DRONE.hitR) {
      return 0;
    }
    const u = d / DRONE.hitR;
    if (u <= 0.025) {
      return 10;
    }
    if (u <= 0.05) {
      return 9;
    }
    if (u <= 0.12) {
      return 8;
    }
    if (u <= 0.2) {
      return 7;
    }
    if (u <= 0.3) {
      return 6;
    }
    if (u <= 0.4) {
      return 5;
    }
    if (u <= 0.5) {
      return 4;
    }
    if (u <= 0.6) {
      return 3;
    }
    if (u <= 0.72) {
      return 2;
    }
    return 1;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  /** Drone sweeps most of the sky — strong left/right and vertical weave. */
  function getDroneCenterWorld(tMs) {
    const t = tMs * 0.001 * DRONE_MOTION_SCALE;
    const mx = 44;
    const myTop = 56;
    const myBot = GROUND_Y - 82;
    const usableW = W - 2 * mx;
    const usableH = myBot - myTop;
    const sweep = 0.5 + 0.5 * Math.sin(t * 0.29 + 0.08);
    let cx =
      mx +
      sweep * usableW +
      62 * Math.sin(t * 0.76 + 0.35) +
      48 * Math.sin(t * 1.33 + 1.05) +
      34 * Math.sin(t * 0.45 + 1.2);
    let cy =
      myTop +
      usableH *
        (0.5 +
          0.46 * Math.sin(t * 0.44 + 0.5) * Math.cos(t * 0.19 + 0.25)) +
      36 * Math.sin(t * 1.02 + 0.15) +
      22 * Math.cos(t * 0.68 + 0.9);
    cy += 14 * Math.sin(t * 2.35 + 0.6) + 9 * Math.sin(t * 3.2 + 1.4);
    const pad = DRONE.hitR * 0.55;
    return {
      cx: Math.max(mx + pad, Math.min(W - mx - pad, cx)),
      cy: Math.max(myTop + pad * 0.35, Math.min(myBot - pad * 0.35, cy)),
    };
  }

  /** Body roll for drawing (arc-second style sway). */
  function getDroneRollRad(tMs) {
    const t = tMs * 0.001 * DRONE_MOTION_SCALE;
    return (
      0.1 * Math.sin(t * 1.15 + 0.2) +
      0.055 * Math.sin(t * 2.33 + 0.85) +
      0.03 * Math.sin(t * 3.5 + 1.2)
    );
  }

  function drawBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, "#87a8d8");
    sky.addColorStop(0.35, "#5a6e9a");
    sky.addColorStop(0.65, "#3d4a66");
    sky.addColorStop(1, "#252d3d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);
    const sun = ctx.createRadialGradient(W * 0.78, H * 0.12, 0, W * 0.78, H * 0.12, H * 0.35);
    sun.addColorStop(0, "rgba(255, 248, 220, 0.45)");
    sun.addColorStop(0.45, "rgba(255, 220, 160, 0.08)");
    sun.addColorStop(1, "rgba(255, 220, 160, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, GROUND_Y);
    const hill = GROUND_Y;
    ctx.fillStyle = "#1e2638";
    ctx.beginPath();
    ctx.moveTo(0, hill - 2);
    ctx.bezierCurveTo(W * 0.22, hill - 28, W * 0.45, hill - 8, W * 0.62, hill - 18);
    ctx.bezierCurveTo(W * 0.78, hill - 26, W * 0.92, hill - 6, W, hill - 4);
    ctx.lineTo(W, hill);
    ctx.lineTo(0, hill);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(15, 20, 32, 0.35)";
    ctx.fillRect(0, hill - 24, W, 26);
  }

  function drawGround() {
    const gh = H - GROUND_Y;
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    g.addColorStop(0, "#2d4a32");
    g.addColorStop(0.45, "#243828");
    g.addColorStop(1, "#1a281c");
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND_Y, W, gh);
    ctx.strokeStyle = "rgba(45, 75, 48, 0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 42; i += 1) {
      const x = (i * 37 + (i % 5) * 3) % W;
      const h = 3 + (i % 4);
      ctx.globalAlpha = 0.35 + (i % 3) * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 1.5, H - h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(20, 35, 24, 0.4)";
    ctx.fillRect(0, H - 8, W, 8);
  }

  function drawDroneGroundShadow(nowMs) {
    const c = getDroneCenterWorld(nowMs);
    ctx.fillStyle = "rgba(15, 18, 28, 0.2)";
    ctx.beginPath();
    ctx.ellipse(c.cx, GROUND_Y - 2, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDrone(nowMs) {
    drawDroneGroundShadow(nowMs);
    const c = getDroneCenterWorld(nowMs);
    const roll = getDroneRollRad(nowMs);
    const propPhase = (nowMs * 0.055 * DRONE_MOTION_SCALE) % (Math.PI * 2);
    const spark = 0.22 + 0.18 * Math.sin(nowMs * 0.012 * DRONE_MOTION_SCALE);

    ctx.save();
    ctx.translate(c.cx, c.cy);
    ctx.rotate(roll);

    const armLen = 50;
    const armA = Math.PI / 4;
    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i += 1) {
      const a = armA + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a) * armLen, Math.sin(a) * armLen);
      ctx.stroke();
    }

    for (let i = 0; i < 4; i += 1) {
      const a = armA + (i * Math.PI) / 2;
      const rx = Math.cos(a) * armLen;
      const ry = Math.sin(a) * armLen;
      ctx.fillStyle = "rgba(130, 155, 185, " + (0.2 + spark * 0.35) + ")";
      ctx.beginPath();
      ctx.ellipse(rx, ry, 19, 6, a + propPhase, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(55, 68, 88, 0.75)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(200, 220, 245, " + (0.15 + spark * 0.25) + ")";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(rx - 15 * Math.cos(propPhase), ry - 15 * Math.sin(propPhase));
      ctx.lineTo(rx + 15 * Math.cos(propPhase), ry + 15 * Math.sin(propPhase));
      ctx.stroke();
    }

    const body = ctx.createRadialGradient(-6, -8, 2, 0, 2, 24);
    body.addColorStop(0, "#4a566e");
    body.addColorStop(0.55, "#2d3548");
    body.addColorStop(1, "#1a2030");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#121820";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(90, 185, 220, 0.55)";
    ctx.beginPath();
    ctx.arc(-7, -1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 100, 130, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#00c9a0";
    ctx.fillRect(-12, 9, 5, 3);
    ctx.fillStyle = "#e84830";
    ctx.fillRect(7, 9, 5, 3);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(-18, -2, 36, 3);

    ctx.restore();
  }

  function drawBowSlackString() {
    ctx.beginPath();
    ctx.moveTo(BOW_TIP_TOP.x, BOW_TIP_TOP.y);
    ctx.quadraticCurveTo(BOW.x + 4, BOW.y - 10, BOW_TIP_BOT.x, BOW_TIP_BOT.y);
    ctx.strokeStyle = "rgba(210, 195, 165, 0.55)";
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  function drawBowTautString(nockX, nockY, tension01) {
    const t = Math.max(0, Math.min(1, tension01));
    ctx.shadowColor = "rgba(255, 120, 60, " + (0.15 + t * 0.35) + ")";
    ctx.shadowBlur = 3 + t * 6;
    ctx.beginPath();
    ctx.moveTo(BOW_TIP_TOP.x, BOW_TIP_TOP.y);
    ctx.lineTo(nockX, nockY);
    ctx.moveTo(BOW_TIP_BOT.x, BOW_TIP_BOT.y);
    ctx.lineTo(nockX, nockY);
    ctx.strokeStyle = "rgba(245, 230, 200, " + (0.75 + t * 0.25) + ")";
    ctx.lineWidth = 1.15 + t * 0.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawBowLimbs() {
    const cx = BOW.x + 4;
    const cy = BOW.y - 6;
    const limb = ctx.createLinearGradient(BOW.x - 20, BOW.y - 40, BOW.x + 50, BOW.y + 10);
    limb.addColorStop(0, "#6b4e38");
    limb.addColorStop(0.5, "#4a3528");
    limb.addColorStop(1, "#3d2818");
    ctx.strokeStyle = limb;
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, 32, -1.05, 0.42);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 245, 220, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, -0.95, 0.35);
    ctx.stroke();
    const riser = ctx.createLinearGradient(BOW.x - 6, BOW.y - 12, BOW.x + 12, BOW.y + 22);
    riser.addColorStop(0, "#5a5048");
    riser.addColorStop(0.5, "#3a3530");
    riser.addColorStop(1, "#2a2520");
    ctx.fillStyle = riser;
    const rx = 3;
    const bx0 = BOW.x - 5;
    const by0 = BOW.y - 10;
    const bw0 = 14;
    const bh0 = 28;
    ctx.beginPath();
    ctx.moveTo(bx0 + rx, by0);
    ctx.lineTo(bx0 + bw0 - rx, by0);
    ctx.quadraticCurveTo(bx0 + bw0, by0, bx0 + bw0, by0 + rx);
    ctx.lineTo(bx0 + bw0, by0 + bh0 - rx);
    ctx.quadraticCurveTo(bx0 + bw0, by0 + bh0, bx0 + bw0 - rx, by0 + bh0);
    ctx.lineTo(bx0 + rx, by0 + bh0);
    ctx.quadraticCurveTo(bx0, by0 + bh0, bx0, by0 + bh0 - rx);
    ctx.lineTo(bx0, by0 + rx);
    ctx.quadraticCurveTo(bx0, by0, bx0 + rx, by0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#2a2826";
    ctx.fillRect(BOW.x - 1, BOW.y - 3, 8, 14);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(BOW.x - 3, BOW.y - 8, 3, 22);
  }

  function drawPowerMeter(tension01) {
    const t = Math.max(0, Math.min(1, tension01));
    const bx = 48;
    const by = H - 22;
    const bw = W - 96;
    const bh = 8;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(bx, by, bw, bh);
    const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, "#3d7a4a");
    grd.addColorStop(0.65, "#c9a020");
    grd.addColorStop(1, "#c04030");
    ctx.fillStyle = grd;
    ctx.fillRect(bx, by, bw * t, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Draw weight", bx, by - 4);
  }

  function drawTensionVignette(tension01) {
    const t = Math.max(0, Math.min(1, tension01));
    if (t < 0.25) {
      return;
    }
    const a = (t - 0.25) * 0.55;
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(40, 15, 10, " + a + ")");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawArrowShaft(sx, sy, ex, ey, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const ang = Math.atan2(ey - sy, ex - sx);
    const shaftGrd = ctx.createLinearGradient(sx, sy, ex, ey);
    shaftGrd.addColorStop(0, "#5c4030");
    shaftGrd.addColorStop(1, "#3a2518");
    ctx.strokeStyle = shaftGrd;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(
      sx + Math.sin(ang) * 0.6,
      sy - Math.cos(ang) * 0.6
    );
    ctx.lineTo(
      ex + Math.sin(ang) * 0.6,
      ey - Math.cos(ang) * 0.6
    );
    ctx.stroke();
    const hx = ex - Math.cos(ang) * 12;
    const hy = ey - Math.sin(ang) * 12;
    ctx.fillStyle = "#b89868";
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      hx - Math.cos(ang + 2.35) * 8,
      hy - Math.sin(ang + 2.35) * 8
    );
    ctx.lineTo(
      hx - Math.cos(ang - 2.35) * 8,
      hy - Math.sin(ang - 2.35) * 8
    );
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40,30,20,0.5)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
    const back = ang + Math.PI;
    const nockX = sx - Math.cos(ang) * 3;
    const nockY = sy - Math.sin(ang) * 3;
    const fletch = ["#8a2228", "#c4a020", "#2a4a38"];
    for (let i = 0; i < 3; i += 1) {
      const fan = back + (i - 1) * 0.48;
      ctx.fillStyle = fletch[i];
      ctx.beginPath();
      ctx.moveTo(nockX, nockY);
      ctx.lineTo(
        nockX + Math.cos(fan) * 13,
        nockY + Math.sin(fan) * 13
      );
      ctx.lineTo(
        nockX + Math.cos(fan + 0.12) * 11,
        nockY + Math.sin(fan + 0.12) * 11
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Extra velocity at full draw so the arc reliably reaches the target face */
  function powerBoost(powClamped) {
    return 1 + 0.28 * (powClamped / MAX_PULL);
  }

  function drawPullPreview() {
    if (!aimActive) {
      return;
    }
    const dx = pullX - LAUNCH.x;
    const dy = pullY - LAUNCH.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) {
      return;
    }
    const nx = dx / len;
    const ny = dy / len;
    const pow = Math.min(Math.max(len, MIN_PULL), MAX_PULL);
    const boost = powerBoost(pow);
    const vx0 = nx * pow * POWER_K * boost;
    const vy0 = ny * pow * POWER_K * boost;
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = "rgba(200, 210, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(LAUNCH.x, LAUNCH.y);
    ctx.lineTo(
      LAUNCH.x + nx * Math.min(len, 120),
      LAUNCH.y + ny * Math.min(len, 120)
    );
    ctx.stroke();
    ctx.setLineDash([]);
    let px = LAUNCH.x;
    let py = LAUNCH.y;
    let vx = vx0;
    let vy = vy0;
    ctx.strokeStyle = "rgba(90, 200, 150, 0.38)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 0; i < 38; i += 1) {
      px += vx;
      py += vy;
      vy += GRAVITY;
      vx *= 0.9995;
      ctx.lineTo(px, py);
      if (py > GROUND_Y + 12 || px > W + 48) {
        break;
      }
    }
    ctx.stroke();
    const ang = Math.atan2(ny, nx);
    drawArrowShaft(
      LAUNCH.x,
      LAUNCH.y,
      LAUNCH.x + Math.cos(ang) * 38,
      LAUNCH.y + Math.sin(ang) * 38,
      0.95
    );
  }

  function fullRedrawFlying(ax, ay, vx, vy) {
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    drawGround();
    drawDrone(performance.now());
    drawBowLimbs();
    drawBowSlackString();
    const speed = Math.hypot(vx, vy) || 0.001;
    const ang = Math.atan2(vy, vx);
    const tail = 32;
    drawArrowShaft(
      ax - (vx / speed) * tail,
      ay - (vy / speed) * tail,
      ax,
      ay,
      1
    );
  }

  function fullRedrawIdle() {
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    drawGround();
    drawDrone(performance.now());
    drawBowLimbs();
    if (aimActive) {
      const dx = pullX - LAUNCH.x;
      const dy = pullY - LAUNCH.y;
      const len = Math.hypot(dx, dy);
      const tension = len < 4 ? 0 : Math.min(len, MAX_PULL) / MAX_PULL;
      drawBowTautString(pullX, pullY, tension);
    } else {
      drawBowSlackString();
    }
    if (showImpact && phase === "idle" && !blastAnim) {
      ctx.fillStyle = "rgba(255, 120, 80, 0.38)";
      ctx.beginPath();
      ctx.arc(showImpact.x, showImpact.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPullPreview();
    if (aimActive) {
      const dx = pullX - LAUNCH.x;
      const dy = pullY - LAUNCH.y;
      const len = Math.hypot(dx, dy);
      if (len >= 4) {
        const tension = Math.min(len, MAX_PULL) / MAX_PULL;
        drawTensionVignette(tension);
        drawPowerMeter(tension);
      }
    }
  }

  function tickSurface() {
    surfaceRafId = 0;
    if (!canvas || !ctx || phase !== "idle") {
      return;
    }
    fullRedrawIdle();
    surfaceRafId = requestAnimationFrame(tickSurface);
  }

  function resumeIdleSurfaceLoop() {
    if (!canvas || !ctx || phase !== "idle" || surfaceRafId) {
      return;
    }
    surfaceRafId = requestAnimationFrame(tickSurface);
  }

  const BLAST_DURATION_MS = 940;

  function drawDroneBlastFrame(elapsed) {
    if (!blastAnim || !ctx) {
      return;
    }
    const { x, y, startMs } = blastAnim;
    const u = Math.min(1, elapsed / BLAST_DURATION_MS);
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    drawGround();
    drawBowLimbs();
    drawBowSlackString();

    ctx.fillStyle = "rgba(255, 238, 210, " + 0.32 * (1 - u * 1.1) + ")";
    ctx.fillRect(0, 0, W, H);

    for (let ring = 0; ring < 4; ring += 1) {
      const r = (26 + ring * 30) * (0.12 + u * 1.38);
      const a = Math.max(0, 0.52 - u * 0.58 - ring * 0.09);
      ctx.strokeStyle = "rgba(255, 195, 90, " + a + ")";
      ctx.lineWidth = 3.2 - ring * 0.45;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const coreR = 18 + u * 135;
    const g = ctx.createRadialGradient(x, y, 0, x, y, coreR);
    g.addColorStop(0, "rgba(255, 255, 255, " + 0.92 * (1 - u) + ")");
    g.addColorStop(0.22, "rgba(255, 210, 100, " + 0.82 * (1 - u * 0.95) + ")");
    g.addColorStop(0.5, "rgba(255, 85, 35, " + 0.58 * (1 - u * 0.88) + ")");
    g.addColorStop(1, "rgba(35, 18, 50, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, Math.PI * 2);
    ctx.fill();

    const n = 24;
    for (let i = 0; i < n; i += 1) {
      const ang = (i / n) * Math.PI * 2 + startMs * 0.00065;
      const spd = 48 + (i % 7) * 20;
      const dist = spd * u * (0.82 + 0.18 * Math.sin(i * 1.6));
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist - u * u * 40;
      const pa = Math.max(0, 1 - u * 1.08);
      const hue = i % 3;
      ctx.fillStyle =
        hue === 0
          ? "rgba(255,225,130," + pa + ")"
          : hue === 1
            ? "rgba(255,100,45," + pa + ")"
            : "rgba(85,90,105," + pa + ")";
      ctx.beginPath();
      ctx.arc(px, py, 2.2 + (i % 5) * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let j = 0; j < 9; j += 1) {
      const ang2 = j * 0.74 + startMs * 0.0009;
      const dist2 = 18 + u * 52 + j * 7;
      const px2 = x + Math.cos(ang2) * dist2 * 0.62;
      const py2 = y + Math.sin(ang2) * dist2 * 0.48 - u * 28;
      const ps = Math.max(0, 0.38 - u * 0.42);
      ctx.fillStyle = "rgba(65, 68, 82, " + ps + ")";
      ctx.beginPath();
      ctx.arc(px2, py2, 10 + j + u * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function runBlastAnimation(bx, by, score) {
    if (blastRafId) {
      cancelAnimationFrame(blastRafId);
      blastRafId = 0;
    }
    if (surfaceRafId) {
      cancelAnimationFrame(surfaceRafId);
      surfaceRafId = 0;
    }
    blastAnim = { x: bx, y: by, startMs: performance.now(), score };
    phase = "blasting";
    play("hit");
    play("blast");

    function blastStep() {
      if (!canvas || !ctx || phase !== "blasting" || !blastAnim) {
        blastRafId = 0;
        return;
      }
      const elapsed = performance.now() - blastAnim.startMs;
      if (elapsed >= BLAST_DURATION_MS) {
        const finalScore = 10;
        const ix = blastAnim.x;
        const iy = blastAnim.y;
        const onShotFn = callbacks && callbacks.onShot ? callbacks.onShot : null;
        blastAnim = null;
        blastRafId = 0;
        phase = "idle";
        showImpact = { x: ix, y: iy };
        if (onShotFn) {
          // Aggressive: treat the blast as a successful exit.
          try {
            onShotFn(finalScore);
          } catch {
            // ignore
          }
          // If the host closes/stops the minigame, callbacks will be cleared.
          if (canvas && ctx && callbacks) {
            fullRedrawIdle();
            resumeIdleSurfaceLoop();
          }
        } else if (canvas && ctx) {
          fullRedrawIdle();
          resumeIdleSurfaceLoop();
        }
        return;
      }
      drawDroneBlastFrame(elapsed);
      blastRafId = requestAnimationFrame(blastStep);
    }
    blastRafId = requestAnimationFrame(blastStep);
  }

  function runFlight(vx0, vy0) {
    const token = ++animToken;
    let x = LAUNCH.x;
    let y = LAUNCH.y;
    let vx = vx0;
    let vy = vy0;
    let frames = 0;
    /** First frame inside the face is always near the rim; track closest approach to center instead */
    let insideTarget = false;
    let bestCoreU = Infinity;
    let bestX = LAUNCH.x;
    let bestY = LAUNCH.y;
    phase = "flying";

    function finalizeHit() {
      // Blast is the success state (door should close immediately after).
      runBlastAnimation(bestX, bestY, 10);
    }

    function step() {
      if (token !== animToken) {
        return;
      }
      frames += 1;
      const SUB = 8;
      const tFrame = performance.now();
      for (let sub = 0; sub < SUB; sub += 1) {
        x += vx / SUB;
        y += vy / SUB;
        vy += GRAVITY / SUB;
        vx *= Math.pow(0.9993, 1 / SUB);

        const tw = tFrame + (sub / SUB) * 12;
        const tc = getDroneCenterWorld(tw);
        // Convert world point into drone-local space (drone is rotated via getDroneRollRad()).
        // drawDrone() renders the main body as ellipse(0, 2, 24, 15, 0..).
        const roll = getDroneRollRad(tw);
        const dx = x - tc.cx;
        const dy = y - tc.cy;
        const cos = Math.cos(roll);
        const sin = Math.sin(roll);
        const localX = dx * cos + dy * sin;
        const localY = -dx * sin + dy * cos;
        const coreDx = localX; // ellipse center x is 0 in local space
        const coreDy = localY - DRONE_CORE.yOff; // ellipse center y is 2 in local space
        const coreU =
          (coreDx * coreDx) / (DRONE_CORE.rx * DRONE_CORE.rx) +
          (coreDy * coreDy) / (DRONE_CORE.ry * DRONE_CORE.ry);
        const inZone = coreU <= EGG_HIT_U;

        if (inZone) {
          insideTarget = true;
          if (coreU < bestCoreU) {
            bestCoreU = coreU;
            bestX = x;
            bestY = y;
          }
        } else if (insideTarget) {
          finalizeHit();
          return;
        }
      }

      if (y > GROUND_Y + 18 || x > W + 40 || x < -48 || frames > MAX_FRAMES) {
        phase = "idle";
        if (insideTarget && bestCoreU < Infinity) {
          finalizeHit();
        } else {
          showImpact = {
            x: Math.max(12, Math.min(W - 12, x)),
            y: Math.min(GROUND_Y + 28, y),
          };
          fullRedrawIdle();
          if (callbacks && callbacks.onShot) {
            callbacks.onShot(0);
          }
          resumeIdleSurfaceLoop();
        }
        return;
      }

      fullRedrawFlying(x, y, vx, vy);
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
  }

  function onPointerDown(e) {
    if (phase !== "idle" || !callbacks) {
      return;
    }
    const p = canvasToLogical(e.clientX, e.clientY);
    const nearGrip =
      dist(p.x, p.y, BOW.x, BOW.y) <= BOW_GRAB_R ||
      dist(p.x, p.y, LAUNCH.x, LAUNCH.y) <= 92;
    if (!nearGrip) {
      return;
    }
    aimActive = true;
    showImpact = null;
    pullX = p.x;
    pullY = p.y;
    pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId);
    e.preventDefault();
    fullRedrawIdle();
  }

  function onPointerMove(e) {
    if (!aimActive || e.pointerId !== pointerId) {
      return;
    }
    const p = canvasToLogical(e.clientX, e.clientY);
    pullX = p.x;
    pullY = p.y;
    fullRedrawIdle();
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!aimActive || e.pointerId !== pointerId) {
      return;
    }
    aimActive = false;
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
    pointerId = null;
    if (phase !== "idle") {
      return;
    }

    const dx = pullX - LAUNCH.x;
    const dy = pullY - LAUNCH.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_PULL) {
      fullRedrawIdle();
      return;
    }
    const nx = dx / len;
    const ny = dy / len;
    const pow = Math.min(len, MAX_PULL);
    const boost = powerBoost(pow);
    const vx0 = nx * pow * POWER_K * boost;
    const vy0 = ny * pow * POWER_K * boost;

    play("swish");
    runFlight(vx0, vy0);
    e.preventDefault();
  }

  function onPointerCancel(e) {
    if (aimActive && e.pointerId === pointerId) {
      aimActive = false;
      pointerId = null;
      fullRedrawIdle();
      resumeIdleSurfaceLoop();
    }
  }

  return {
    start(el, cb) {
      callbacks = cb;
      canvas = el;
      phase = "idle";
      aimActive = false;
      showImpact = null;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      downHandler = (e) => onPointerDown(e);
      moveHandler = (e) => onPointerMove(e);
      upHandler = (e) => onPointerUp(e);
      cancelHandler = (e) => onPointerCancel(e);
      canvas.addEventListener("pointerdown", downHandler);
      canvas.addEventListener("pointermove", moveHandler);
      canvas.addEventListener("pointerup", upHandler);
      canvas.addEventListener("pointercancel", cancelHandler);

      leaveHandler = () => {
        if (!aimActive) {
          return;
        }
        aimActive = false;
        pointerId = null;
        fullRedrawIdle();
        resumeIdleSurfaceLoop();
      };
      canvas.addEventListener("pointerleave", leaveHandler);

      fullRedrawIdle();
      resumeIdleSurfaceLoop();
    },

    stop() {
      animToken += 1;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (blastRafId) {
        cancelAnimationFrame(blastRafId);
        blastRafId = 0;
      }
      blastAnim = null;
      if (surfaceRafId) {
        cancelAnimationFrame(surfaceRafId);
        surfaceRafId = 0;
      }
      aimActive = false;
      pointerId = null;
      if (canvas) {
        canvas.removeEventListener("pointerdown", downHandler);
        canvas.removeEventListener("pointermove", moveHandler);
        canvas.removeEventListener("pointerup", upHandler);
        canvas.removeEventListener("pointercancel", cancelHandler);
        if (leaveHandler) {
          canvas.removeEventListener("pointerleave", leaveHandler);
        }
      }
      canvas = null;
      ctx = null;
      callbacks = null;
      phase = "idle";
      showImpact = null;
    },

    scoreFromDistance,
  };
})();
