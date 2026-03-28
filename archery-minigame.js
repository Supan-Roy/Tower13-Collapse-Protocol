/**
 * Archery lock: bow lower-left. Pull from bow (direction + power), release — projectile with gravity.
 * Must score 9–10 (tight rings). On miss, player stays on archery until success.
 */
window.ArcheryMinigame = (function archeryIife() {
  const SOUND_SWISH = "assets/sounds/arrow-swish.mp3";
  const SOUND_HIT = "assets/sounds/arrow-hitting-target.mp3";

  const W = 360;
  const H = 400;
  /** Tuned so a full draw toward the target reaches the face with arc */
  const GRAVITY = 0.22;
  const POWER_K = 0.198;
  const MIN_PULL = 18;
  const MAX_PULL = 168;
  const MAX_FRAMES = 520;
  const BOW_GRAB_R = 56;

  let audioSwish = null;
  let audioHit = null;

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
    if (!audioHit) {
      audioHit = getAudio(SOUND_HIT);
    }
    if (audioHit) {
      audioHit.currentTime = 0;
      audioHit.play().catch(() => {});
    }
  }

  const BOW = { x: 44, y: H - 54 };
  /** Limb tips: bowstring anchors (real thread) */
  const BOW_TIP_TOP = { x: 78, y: H - 78 };
  const BOW_TIP_BOT = { x: 78, y: H - 32 };
  /** Arrow leaves from nock (grip area) */
  const LAUNCH = { x: 66, y: H - 66 };
  const TARGET = { cx: 262, cy: 128, maxR: 72 };

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let rafId = 0;
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

  /** Stricter rings: only inner ~14% of radius gives 9–10 */
  function scoreFromDistance(d) {
    if (d >= TARGET.maxR) {
      return 0;
    }
    const u = d / TARGET.maxR;
    if (u <= 0.065) {
      return 10;
    }
    if (u <= 0.135) {
      return 9;
    }
    if (u <= 0.22) {
      return 8;
    }
    if (u <= 0.32) {
      return 7;
    }
    if (u <= 0.42) {
      return 6;
    }
    if (u <= 0.52) {
      return 5;
    }
    if (u <= 0.62) {
      return 4;
    }
    if (u <= 0.72) {
      return 3;
    }
    if (u <= 0.84) {
      return 2;
    }
    return 1;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function drawBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, "#87a8d8");
    sky.addColorStop(0.35, "#5a6e9a");
    sky.addColorStop(0.65, "#3d4a66");
    sky.addColorStop(1, "#252d3d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H - 44);
    const sun = ctx.createRadialGradient(W * 0.78, H * 0.12, 0, W * 0.78, H * 0.12, H * 0.35);
    sun.addColorStop(0, "rgba(255, 248, 220, 0.45)");
    sun.addColorStop(0.45, "rgba(255, 220, 160, 0.08)");
    sun.addColorStop(1, "rgba(255, 220, 160, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H - 44);
    const hill = H - 44;
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
    const gy = H - 44;
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, "#2d4a32");
    g.addColorStop(0.45, "#243828");
    g.addColorStop(1, "#1a281c");
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, W, 44);
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

  function drawTargetStandAndBale() {
    const { cx, cy, maxR } = TARGET;
    const footY = H - 44;
    const faceBottom = cy + maxR;
    const postBot = Math.min(footY - 6, faceBottom + 62);

    ctx.save();
    ctx.fillStyle = "rgba(15, 18, 28, 0.22)";
    ctx.beginPath();
    ctx.ellipse(cx, footY - 2, maxR * 1.15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "#4a4540";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, faceBottom + 4);
    ctx.lineTo(cx, postBot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 18, faceBottom + 10);
    ctx.lineTo(cx - 32, postBot + 4);
    ctx.moveTo(cx + 18, faceBottom + 10);
    ctx.lineTo(cx + 32, postBot + 4);
    ctx.stroke();

    const bw = maxR * 2 + 28;
    const bh = maxR * 2 + 36;
    const bx = cx - bw / 2;
    const by = cy - maxR - 14;
    const br = 6;
    ctx.fillStyle = "#2a3830";
    ctx.beginPath();
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fill();
    const foam = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    foam.addColorStop(0, "#3d5248");
    foam.addColorStop(1, "#1e2a24");
    ctx.fillStyle = foam;
    ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
  }

  function drawTargetFace() {
    const { cx, cy, maxR } = TARGET;
    const colors = [
      "#f5f0e8",
      "#c4dcf0",
      "#7eb8e8",
      "#3d7a3d",
      "#f0c830",
      "#e8a820",
      "#d04020",
      "#a01818",
      "#1a1a1a",
      "#ffd700",
    ];
    ctx.fillStyle = "rgba(250, 248, 242, 0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy, maxR + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 40, 40, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let s = 10; s >= 1; s -= 1) {
      const r = (s / 10) * maxR;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = colors[(10 - s) % colors.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = s === 1 ? 1.2 : 0.85;
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(30, 28, 26, 0.92)";
    ctx.font = "bold 10px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("10", cx, cy + 3);
  }

  function drawTarget() {
    drawTargetStandAndBale();
    drawTargetFace();
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
      if (py > H - 40 || px > W + 30) {
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
    drawTarget();
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
    drawTarget();
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
    if (showImpact && phase === "idle") {
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

  function runFlight(vx0, vy0) {
    const token = ++animToken;
    let x = LAUNCH.x;
    let y = LAUNCH.y;
    let vx = vx0;
    let vy = vy0;
    let frames = 0;
    /** First frame inside the face is always near the rim; track closest approach to center instead */
    let insideTarget = false;
    let bestD = Infinity;
    let bestX = LAUNCH.x;
    let bestY = LAUNCH.y;
    phase = "flying";

    function finalizeHit() {
      phase = "idle";
      const score = scoreFromDistance(bestD);
      play("hit");
      showImpact = { x: bestX, y: bestY };
      fullRedrawIdle();
      if (callbacks && callbacks.onShot) {
        callbacks.onShot(score);
      }
    }

    function step() {
      if (token !== animToken) {
        return;
      }
      frames += 1;
      const SUB = 8;
      const inR = TARGET.maxR * 1.01;
      for (let sub = 0; sub < SUB; sub += 1) {
        x += vx / SUB;
        y += vy / SUB;
        vy += GRAVITY / SUB;
        vx *= Math.pow(0.9993, 1 / SUB);

        const dTarget = dist(x, y, TARGET.cx, TARGET.cy);
        const inZone = dTarget <= inR;

        if (inZone) {
          insideTarget = true;
          if (dTarget < bestD) {
            bestD = dTarget;
            bestX = x;
            bestY = y;
          }
        } else if (insideTarget) {
          finalizeHit();
          return;
        }
      }

      if (y > H - 38 || x > W + 25 || x < -30 || frames > MAX_FRAMES) {
        phase = "idle";
        if (insideTarget && bestD < Infinity) {
          finalizeHit();
        } else {
          showImpact = {
            x: Math.max(10, Math.min(W - 10, x)),
            y: Math.min(H - 36, y),
          };
          fullRedrawIdle();
          if (callbacks && callbacks.onShot) {
            callbacks.onShot(0);
          }
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
      dist(p.x, p.y, LAUNCH.x, LAUNCH.y) <= 52;
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
      };
      canvas.addEventListener("pointerleave", leaveHandler);

      fullRedrawIdle();
    },

    stop() {
      animToken += 1;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
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
