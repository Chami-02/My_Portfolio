// frontend/src/components/ambient/SeasonalCanvas.jsx
import { useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import styles from './SeasonalCanvas.module.css';

// Tuned by eye with the owner. Phone counts keep about the desktop's DENSITY: a
// phone is a quarter of the area, so half the pieces read twice as crowded.
// `strip` is the admin panel's narrow band: enough to show an effect is on, and
// no bats, because a bat crossing it would only hang there.
const PHONE_MAX_PX = 560;
const SNOW_COUNT = { desktop: 50, phone: 20, strip: 22, stripPhone: 11 };
const LEAF_COUNT = { desktop: 40, phone: 14, strip: 16, stripPhone: 8 };
const BATS_AT_ONCE = { desktop: 4, phone: 2, strip: 0, stripPhone: 0 };
// Sharper than this costs real battery on a 3× phone, and no one can see it.
const MAX_DPR = { desktop: 2, phone: 1.5 };
// A device that cannot keep up sheds pieces rather than stutter. Above 33 ms, on
// purpose: a phone in low-power mode runs at a steady 30 Hz and is not struggling.
const SLOW_FRAME_MS = 40;
const SLOW_CHECK_FRAMES = 60;
const SLOW_SHED = 0.75;
const SLOW_FLOOR = 0.4;
const STRIP_SWAY = 0.25;
// Each falling piece rolls again every time it re-enters: a few, at random.
const PUMPKIN_CHANCE = 0.12;
const BAT_GAP_S = { min: 2, spread: 4 };
const FADE_IN_S = 1.5;

// Half-widths in CSS px, with how often each appears: mostly small, a few large.
const FLAKE_SIZES = [
  { r: 4, share: 0.5 },
  { r: 5, share: 0.35 },
  { r: 8, share: 0.15 },
];
const LEAF_SIZES = [
  { r: 6,  share: 0.45 },
  { r: 9,  share: 0.4 },
  { r: 13, share: 0.15 },
];
const PUMPKIN_SIZES = [
  { r: 7,  share: 0.6 },
  { r: 10, share: 0.4 },
];

// Icy white in dark; blue-grey in light, where white would vanish on the paper.
const SNOW_COLOUR = { dark: '#E4F4F7', light: '#7E9CC4' };
const BAT_COLOUR = { dark: '#A9A3C4', light: '#2B2540' };

// Each leaf shades from its base to its tips: the owner's autumn photo, 2026-11-06.
const LEAF_COLOURS = [
  { base: '#F6C445', tip: '#E0891B', vein: '#9A5A12' },  // gold
  { base: '#EFA02C', tip: '#D4581A', vein: '#8A3F10' },  // orange
  { base: '#D9411F', tip: '#A81E1A', vein: '#6E120F' },  // red
  { base: '#F2D06B', tip: '#E2A62C', vein: '#A87A1E' },  // yellow
  { base: '#D79B5E', tip: '#A9622D', vein: '#6B3C18' },  // tan
];

// The right half of a maple leaf, tip first, on a -1…1 square. Mirrored to close.
const MAPLE_HALF = [
  [0, -1], [0.1, -0.7], [0.24, -0.76], [0.16, -0.42], [0.36, -0.5], [0.5, -0.66],
  [0.54, -0.46], [0.9, -0.52], [0.74, -0.24], [0.84, -0.14], [0.5, 0.04],
  [0.58, 0.22], [0.3, 0.2], [0.28, 0.34], [0.04, 0.3],
];
const LEAF_BASE = [0, 0.3];
const MAPLE_VEINS = [[0, -0.94], [0.84, -0.5], [-0.84, -0.5], [0.54, 0.2], [-0.54, 0.2]];

const between = (min, max) => min + Math.random() * (max - min);

/** A size index, weighted by `share`. */
function pickSize(sizes) {
  let roll = Math.random();
  for (let i = 0; i < sizes.length; i += 1) {
    roll -= sizes[i].share;
    if (roll <= 0) return i;
  }
  return sizes.length - 1;
}

/** A transparent square canvas, with the origin at its middle, for drawing on once. */
function makeSprite(r, dpr, draw) {
  const sprite = document.createElement('canvas');
  const side = Math.ceil((r + 2) * 2 * dpr);
  sprite.width = side;
  sprite.height = side;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    ctx.translate(side / 2, side / 2);
    ctx.scale(dpr, dpr);
    draw(ctx);
  }
  return sprite;
}

/**
 * A stellar crystal: six identical feathered arms around a small hexagon. An
 * original drawing in the style of the owner's snowflake photo. More side
 * branches on a larger flake, because a 4 px one could not show them.
 */
function drawFlakeShape(ctx, r, colour) {
  const branches = r >= 8 ? 5 : r >= 5 ? 3 : 2;
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';

  for (let arm = 0; arm < 6; arm += 1) {
    ctx.save();
    ctx.rotate((arm * Math.PI) / 3);

    ctx.lineWidth = Math.max(0.7, r * 0.075);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.stroke();

    // Both sides of the arm, longest near the middle, at the crystal's 60°.
    ctx.lineWidth = Math.max(0.55, r * 0.05);
    for (let b = 0; b < branches; b += 1) {
      const at = 0.3 + (b / branches) * 0.6;
      const length = r * 0.36 * (1 - b / (branches + 1));
      for (const side of [-1, 1]) {
        const dx = side * length * Math.sin(Math.PI / 3);
        const dy = -length * Math.cos(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, -r * at);
        ctx.lineTo(dx, -r * at + dy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // The little plate in the middle, drawn only where it can be seen.
  if (r >= 5) {
    ctx.lineWidth = Math.max(0.5, r * 0.04);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i * Math.PI) / 3;
      const x = Math.sin(angle) * r * 0.26;
      const y = -Math.cos(angle) * r * 0.26;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/** A five-lobed maple leaf: shaded, with its veins and a short stem. */
function drawLeafShape(ctx, r, colour) {
  ctx.scale(r, r);
  const shade = ctx.createLinearGradient(0, 0.4, 0, -1);
  shade.addColorStop(0, colour.base);
  shade.addColorStop(1, colour.tip);
  ctx.fillStyle = shade;

  ctx.beginPath();
  MAPLE_HALF.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  [...MAPLE_HALF].reverse().forEach(([x, y]) => ctx.lineTo(-x, y));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = colour.vein;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.035;
  for (const [x, y] of MAPLE_VEINS) {
    ctx.beginPath();
    ctx.moveTo(...LEAF_BASE);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(...LEAF_BASE);
  ctx.lineTo(0.05, 0.92);
  ctx.stroke();
}

/** A carved pumpkin: ribbed lobes, a stem, and a face. An original drawing. */
function drawPumpkinShape(ctx, r) {
  ctx.scale(r, r);
  const shade = ctx.createLinearGradient(0, -0.6, 0, 0.85);
  shade.addColorStop(0, '#F59A23');
  shade.addColorStop(1, '#C8560F');

  // Outside in, so each inner lobe overlaps the next and the ribs show.
  ctx.fillStyle = shade;
  ctx.strokeStyle = '#8A3A0A';
  ctx.lineWidth = 0.05;
  for (const [x, rx] of [[-0.62, 0.36], [0.62, 0.36], [-0.34, 0.42], [0.34, 0.42], [0, 0.46]]) {
    ctx.beginPath();
    ctx.ellipse(x, 0.12, rx, 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#4F7A2A';
  ctx.beginPath();
  ctx.moveTo(-0.13, -0.55);
  ctx.lineTo(-0.07, -0.95);
  ctx.lineTo(0.14, -0.9);
  ctx.lineTo(0.13, -0.55);
  ctx.closePath();
  ctx.fill();

  const carve = (points) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#2A1203';
  carve([[-0.52, -0.02], [-0.16, -0.02], [-0.32, -0.3]]);  // eyes
  carve([[0.52, -0.02], [0.16, -0.02], [0.32, -0.3]]);
  carve([
    [-0.56, 0.2], [-0.36, 0.3], [-0.22, 0.2], [-0.08, 0.3], [0.08, 0.2], [0.22, 0.3],
    [0.36, 0.2], [0.56, 0.2], [0.3, 0.6], [0.14, 0.48], [0, 0.62], [-0.14, 0.48], [-0.3, 0.6],
  ]);  // a jagged grin
}

const makeFlake = (w, h) => {
  const size = pickSize(FLAKE_SIZES);
  const r = FLAKE_SIZES[size].r;
  return {
    size,
    r,
    x: Math.random() * w,
    y: Math.random() * h,
    alpha: between(0.55, 0.95),
    fall: between(16, 28) + r * 2,  // px per second; large ones look nearer, so faster
    sway: between(6, 22),           // px
    swaySpeed: between(0.4, 1.1),
    phase: Math.random() * Math.PI * 2,
    spin: between(-0.6, 0.6),       // radians per second
    angle: Math.random() * Math.PI,
  };
};

const makeLeaf = (w, h) => {
  const pumpkin = Math.random() < PUMPKIN_CHANCE;
  const sizes = pumpkin ? PUMPKIN_SIZES : LEAF_SIZES;
  const size = pickSize(sizes);
  return {
    pumpkin,
    size,
    r: sizes[size].r,
    colour: Math.floor(Math.random() * LEAF_COLOURS.length),
    x: Math.random() * w,
    y: Math.random() * h,
    alpha: between(0.75, 1),
    fall: between(28, 60),
    sway: between(18, 45),
    swaySpeed: between(0.4, 0.9),
    phase: Math.random() * Math.PI * 2,
    spin: between(-1.4, 1.4),
    angle: Math.random() * Math.PI * 2,
    flip: between(1, 2.4),          // the tumble, read through cos()
  };
};

const makeBat = (w, h) => {
  const fromLeft = Math.random() < 0.5;
  return {
    x: fromLeft ? -40 : w + 40,
    baseY: between(h * 0.06, h * 0.6),
    dir: fromLeft ? 1 : -1,
    speed: w / between(6, 9),  // crosses in 6–9 s on any screen
    size: between(9, 14),
    age: Math.random() * 10,   // so two bats never flap in step
  };
};

function drawPiece(ctx, sprite, p, t, turn) {
  ctx.save();
  ctx.translate(p.x + Math.sin(t * p.swaySpeed + p.phase) * p.sway, p.y);
  turn(ctx, p, t);
  ctx.globalAlpha = p.alpha;
  ctx.drawImage(sprite, -(p.r + 2), -(p.r + 2), (p.r + 2) * 2, (p.r + 2) * 2);
  ctx.restore();
}

const spinFlake = (ctx, p, t) => ctx.rotate(p.angle + t * p.spin);

// Width through cos(): a leaf turns over as it falls. The floor keeps it from
// thinning to an invisible line edge-on.
const tumbleLeaf = (ctx, p, t) => {
  ctx.rotate(p.angle + t * p.spin);
  ctx.scale(Math.max(0.25, Math.abs(Math.cos(t * p.flip + p.phase))), 1);
};

// Only rocks: a pumpkin spinning or turning edge-on would lose its face.
const rockPumpkin = (ctx, p, t) => ctx.rotate(Math.sin(t * p.swaySpeed + p.phase) * 0.35);

function drawBat(ctx, b, colour) {
  const flap = Math.sin(b.age * 14);
  const s = b.size;
  ctx.save();
  ctx.translate(b.x, b.baseY + Math.sin(b.age * 2.2) * 26);
  ctx.scale(b.dir, 1);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = colour;
  ctx.beginPath();
  // Ears, then one wing out and back along its scalloped edge, then the other.
  ctx.moveTo(-s * 0.1, -s * 0.28);
  ctx.lineTo(-s * 0.2, -s * 0.55);
  ctx.lineTo(0, -s * 0.36);
  ctx.lineTo(s * 0.2, -s * 0.55);
  ctx.lineTo(s * 0.1, -s * 0.28);
  ctx.quadraticCurveTo(s * 0.7, -s * (0.25 + flap * 0.5), s * 1.5, -s * flap * 0.6);
  ctx.quadraticCurveTo(s * 1.05, s * 0.05, s * 0.8, s * 0.3);
  ctx.quadraticCurveTo(s * 0.5, s * 0.05, s * 0.18, s * 0.42);
  ctx.lineTo(0, s * 0.55);
  ctx.lineTo(-s * 0.18, s * 0.42);
  ctx.quadraticCurveTo(-s * 0.5, s * 0.05, -s * 0.8, s * 0.3);
  ctx.quadraticCurveTo(-s * 1.05, s * 0.05, -s * 1.5, -s * flap * 0.6);
  ctx.quadraticCurveTo(-s * 0.7, -s * (0.25 + flap * 0.5), -s * 0.1, -s * 0.28);
  ctx.fill();
  ctx.restore();
}

/**
 * PF-151 — the falling pieces: snow, or autumn leaves with a few bats. Original
 * shapes drawn here, with no image files and no animation library (locked).
 *
 * Mounted only while an effect shows, under full motion, after the splash — see
 * SeasonalEffects.jsx. Speeds are per SECOND, unlike StarfieldCanvas's per-frame
 * stars, so a 120 Hz screen does not fall twice as fast.
 *
 * Each flake and leaf is drawn ONCE to a small canvas, then copied every frame:
 * a detailed crystal is dozens of strokes, and 50 of them per frame would be
 * real cost on a phone. A copy is one call.
 */
export default function SeasonalCanvas({ effect, strip = false }) {
  const canvasRef = useRef(null);
  const { isLight } = useTheme();

  // Read through a ref like StarfieldCanvas: a theme toggle must recolour the
  // pieces, not restart the whole fall from fresh positions.
  const themeRef = useRef(isLight ? 'light' : 'dark');
  useEffect(() => {
    themeRef.current = isLight ? 'light' : 'dark';
  }, [isLight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;

    let w = 0;
    let h = 0;
    let rafId = null;
    let last = null;
    let t = 0;
    let fade = 0;
    canvas.style.opacity = '0';

    const phone = window.innerWidth <= PHONE_MAX_PX;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR[phone ? 'phone' : 'desktop']);
    const size = () => {
      // The canvas's own box, not the window's: the stylesheet decides its size.
      const nextW = canvas.clientWidth || window.innerWidth;
      const nextH = canvas.clientHeight || window.innerHeight;
      // ⚠️ A phone's address bar fires `resize` as it hides and shows on scroll,
      // and setting canvas.width wipes and reallocates the surface. The height
      // is 100lvh, which ignores that bar, so such a resize changes nothing here.
      if (nextW === w && nextH === h) return;
      w = nextW;
      h = nextH;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const device = strip ? (phone ? 'stripPhone' : 'strip') : (phone ? 'phone' : 'desktop');
    const isSnow = effect === 'snow';

    // Per theme, on first need: most visits never toggle.
    const flakeSprites = {};
    const flakesFor = (theme) => {
      flakeSprites[theme] ??= FLAKE_SIZES.map(({ r }) =>
        makeSprite(r, dpr, (c) => drawFlakeShape(c, r, SNOW_COLOUR[theme])));
      return flakeSprites[theme];
    };
    const leafSprites = isSnow ? [] : LEAF_COLOURS.map((colour) =>
      LEAF_SIZES.map(({ r }) => makeSprite(r, dpr, (c) => drawLeafShape(c, r, colour))));
    const pumpkinSprites = isSnow ? [] : PUMPKIN_SIZES.map(({ r }) =>
      makeSprite(r, dpr, (c) => drawPumpkinShape(c, r)));

    const makePiece = () => {
      const piece = (isSnow ? makeFlake : makeLeaf)(w, h);
      if (strip) piece.sway *= STRIP_SWAY;
      return piece;
    };
    const pieces = Array.from({ length: (isSnow ? SNOW_COUNT : LEAF_COUNT)[device] }, makePiece);

    let active = pieces.length;
    let slowMs = 0;
    let slowFrames = 0;
    const shedIfSlow = (ms) => {
      slowMs += ms;
      slowFrames += 1;
      if (slowFrames < SLOW_CHECK_FRAMES) return;
      if (slowMs / slowFrames > SLOW_FRAME_MS) {
        active = Math.max(Math.ceil(pieces.length * SLOW_FLOOR), Math.ceil(active * SLOW_SHED));
      }
      slowMs = 0;
      slowFrames = 0;
    };

    const bats = [];
    let batWait = between(1, 3);  // the first one comes soon, so it gets seen

    const frame = (now) => {
      rafId = requestAnimationFrame(frame);
      // The strip's width can change with no window resize. A drawing surface
      // left at the old width is stretched to fit, and every flake goes wide.
      if (strip) size();
      // Capped: the first frame after a hidden tab must not jump every piece.
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
      if (last !== null) shedIfSlow(now - last);
      last = now;
      t += dt;
      fade = Math.min(1, fade + dt / FADE_IN_S);

      ctx.clearRect(0, 0, w, h);
      const flakes = isSnow ? flakesFor(themeRef.current) : null;

      for (let i = 0; i < active; i += 1) {
        const p = pieces[i];
        p.y += p.fall * dt;
        if (p.y > h + p.r + 20) {
          Object.assign(p, makePiece());
          p.y = -p.r - 20;
        }
        if (isSnow) drawPiece(ctx, flakes[p.size], p, t, spinFlake);
        else if (p.pumpkin) drawPiece(ctx, pumpkinSprites[p.size], p, t, rockPumpkin);
        else drawPiece(ctx, leafSprites[p.colour][p.size], p, t, tumbleLeaf);
      }

      if (!isSnow) {
        for (let i = bats.length - 1; i >= 0; i -= 1) {
          const bat = bats[i];
          bat.age += dt;
          bat.x += bat.dir * bat.speed * dt;
          drawBat(ctx, bat, BAT_COLOUR[themeRef.current]);
          if (bat.x < -60 || bat.x > w + 60) bats.splice(i, 1);
        }
        batWait -= dt;
        if (batWait <= 0 && bats.length < BATS_AT_ONCE[device]) {
          bats.push(makeBat(w, h));
          batWait = BAT_GAP_S.min + Math.random() * BAT_GAP_S.spread;
        }
      }
      ctx.globalAlpha = 1;
      // On the element, not each piece's alpha: the whole fall arrives together.
      canvas.style.opacity = String(fade);
    };

    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      last = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else if (!rafId) rafId = requestAnimationFrame(frame);
    };

    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', onVisibilityChange);
    rafId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [effect, strip]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`${styles.canvas} ${strip ? styles.strip : ''}`}
    />
  );
}
