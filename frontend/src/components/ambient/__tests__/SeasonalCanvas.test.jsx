// frontend/src/components/ambient/__tests__/SeasonalCanvas.test.jsx
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import SeasonalCanvas from '../SeasonalCanvas';

const theme = vi.hoisted(() => ({ isLight: false }));
vi.mock('../../../hooks/useTheme', () => ({ useTheme: () => ({ isLight: theme.isLight }) }));

function mockCtx() {
  // One stub for the page's canvas and every sprite: draws no-op, a few record.
  const ctx = new Proxy({ copies: 0, fills: 0, strokes: [] }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'drawImage') return () => { target.copies += 1; };
      if (key === 'fill') return () => { target.fills += 1; };
      if (key === 'stroke') return () => { target.strokes.push(target.strokeStyle); };
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  return ctx;
}

function mockRaf() {
  let nextId = 1;
  const frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => frames.delete(id));
  return {
    frames,
    run(now) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(now));
    },
  };
}

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};
const setWidth = (px) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px });
};

let raf;
let ctx;

beforeEach(() => {
  theme.isLight = false;
  ctx = mockCtx();
  raf = mockRaf();
  setWidth(1440);
});
afterEach(() => {
  setHidden(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SeasonalCanvas', () => {
  it('is hidden from screen readers', () => {
    const { container } = render(<SeasonalCanvas effect="snow" />);
    expect(container.querySelector('canvas').getAttribute('aria-hidden')).toBe('true');
  });

  it('draws 50 flakes on a computer and 20 on a phone', () => {
    const first = render(<SeasonalCanvas effect="snow" />);
    raf.run(16);
    expect(ctx.copies).toBe(50);
    first.unmount();

    ctx.copies = 0;
    setWidth(390);
    render(<SeasonalCanvas effect="snow" />);
    raf.run(16);
    expect(ctx.copies).toBe(20);
  });

  it('draws each crystal once, then only copies it', () => {
    render(<SeasonalCanvas effect="snow" />);
    raf.run(16);
    const strokes = ctx.strokes.length;
    expect(strokes).toBeGreaterThan(0);
    raf.run(32);
    raf.run(48);
    expect(ctx.strokes.length).toBe(strokes);
  });

  it('colours snow for the theme, without restarting the fall', () => {
    const { rerender } = render(<SeasonalCanvas effect="snow" />);
    raf.run(16);
    expect(ctx.strokes.at(-1)).toBe('#E4F4F7');
    const copies = ctx.copies;

    theme.isLight = true;
    rerender(<SeasonalCanvas effect="snow" />);
    raf.run(32);
    expect(ctx.strokes.at(-1)).toBe('#7E9CC4');
    // The loop went on: one more frame's copies, not a rebuilt field.
    expect(ctx.copies).toBe(copies + 50);
    expect(raf.frames.size).toBe(1);
  });

  // Walks frames at the 50 ms cap, reporting the most bats on screen at once.
  // A bat is the only thing filled per frame; each leaf is a copy.
  const mostBats = (seconds) => {
    let now = 0;
    let most = 0;
    for (let i = 0; i < seconds * 20; i += 1) {
      now += 50;
      ctx.fills = 0;
      raf.run(now);
      most = Math.max(most, ctx.fills);
    }
    return most;
  };

  it('Halloween draws 40 leaves and no flakes', () => {
    render(<SeasonalCanvas effect="halloween" />);
    raf.run(0);
    expect(ctx.copies).toBe(40);
  });

  it('flies several bats at once, up to 4 on a computer', () => {
    render(<SeasonalCanvas effect="halloween" />);
    const most = mostBats(60);
    expect(most).toBeGreaterThanOrEqual(2);
    expect(most).toBeLessThanOrEqual(4);
  });

  it('no more than 2 on a phone, with 14 leaves', () => {
    setWidth(390);
    render(<SeasonalCanvas effect="halloween" />);
    raf.run(0);
    expect(ctx.copies).toBe(14);
    const most = mostBats(60);
    expect(most).toBeGreaterThanOrEqual(1);
    expect(most).toBeLessThanOrEqual(2);
  });

  it('a bat that has crossed the screen leaves', () => {
    // Every random roll in the middle: 4 s between bats, 7.5 s to cross.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    render(<SeasonalCanvas effect="halloween" />);
    expect(mostBats(120)).toBe(2);
  });

  describe('pumpkins', () => {
    const LEAF_SPRITES = 15;  // 5 colours × 3 sizes, built before the pumpkins

    // The sprites in the order they were made, and the ones actually copied.
    const watchSprites = () => {
      const made = [];
      const real = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = real(tag);
        if (tag === 'canvas') made.push(el);
        return el;
      });
      const copied = new Set();
      ctx.drawImage = (sprite) => { ctx.copies += 1; copied.add(sprite); };
      return { pumpkins: () => [...copied].filter((s) => made.indexOf(s) >= LEAF_SPRITES).length };
    };

    it('a low roll falls as a pumpkin', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const sprites = watchSprites();
      render(<SeasonalCanvas effect="halloween" />);
      raf.run(0);
      expect(sprites.pumpkins()).toBe(1);
    });

    it('an ordinary roll falls as a leaf', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const sprites = watchSprites();
      render(<SeasonalCanvas effect="halloween" />);
      raf.run(0);
      expect(sprites.pumpkins()).toBe(0);
    });

    it('each piece rolls again when it re-enters, so they come at random', () => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const sprites = watchSprites();
      render(<SeasonalCanvas effect="halloween" />);
      raf.run(0);
      expect(sprites.pumpkins()).toBe(0);

      random.mockReturnValue(0.05);
      let now = 0;
      for (let i = 0; i < 800; i += 1) { now += 50; raf.run(now); }
      expect(sprites.pumpkins()).toBe(1);
    });

    it('snow never has them', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      render(<SeasonalCanvas effect="snow" />);
      raf.run(0);
      expect(ctx.copies).toBe(50);
    });
  });

  describe('the admin panel\'s strip', () => {
    it('falls fewer pieces, and only in its own width', () => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(140);
      const { container } = render(<SeasonalCanvas effect="snow" strip />);
      raf.run(0);
      expect(ctx.copies).toBe(22);
      expect(container.querySelector('canvas').width).toBeLessThanOrEqual(140 * 2);
    });

    it('follows its own width, so a flake is never stretched', () => {
      const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);
      const { container } = render(<SeasonalCanvas effect="snow" strip />);
      const canvas = container.querySelector('canvas');
      raf.run(0);
      const scale = canvas.width / 100;

      width.mockReturnValue(140);
      raf.run(16);
      expect(canvas.width).toBe(140 * scale);
    });

    it('never flies a bat', () => {
      render(<SeasonalCanvas effect="halloween" strip />);
      expect(mostBats(30)).toBe(0);
    });

    it('the full fall ignores the strip\'s numbers', () => {
      const { container } = render(<SeasonalCanvas effect="snow" />);
      raf.run(0);
      expect(ctx.copies).toBe(50);
      expect(container.querySelector('canvas').width).toBeGreaterThan(140 * 2);
    });
  });

  describe('on a phone', () => {
    const setDpr = (value) => {
      vi.stubGlobal('devicePixelRatio', value);
    };

    it('a 3× screen draws at 1.5×', () => {
      setDpr(3);
      setWidth(390);
      const { container } = render(<SeasonalCanvas effect="snow" />);
      expect(container.querySelector('canvas').width).toBe(390 * 1.5);
    });

    it('a computer stays at up to 2×', () => {
      setDpr(3);
      const { container } = render(<SeasonalCanvas effect="snow" />);
      expect(container.querySelector('canvas').width).toBe(1440 * 2);
    });

    it('the address bar moving does not wipe the surface', () => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(844);
      setWidth(390);
      const { container } = render(<SeasonalCanvas effect="snow" />);
      const canvas = container.querySelector('canvas');
      const assigned = vi.fn();
      Object.defineProperty(canvas, 'height', { configurable: true, get: () => 1, set: assigned });

      // The window shrinks and grows; the canvas box (100lvh) does not move.
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
      window.dispatchEvent(new Event('resize'));
      expect(assigned).not.toHaveBeenCalled();
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    });

    it('a real size change, like turning the phone, does resize', () => {
      setWidth(390);
      const { container } = render(<SeasonalCanvas effect="snow" />);
      const canvas = container.querySelector('canvas');
      setWidth(844);
      window.dispatchEvent(new Event('resize'));
      expect(canvas.width).toBe(844);
    });

    it('the strip is lighter on a phone', () => {
      setWidth(390);
      render(<SeasonalCanvas effect="snow" strip />);
      raf.run(0);
      expect(ctx.copies).toBe(11);
    });
  });

  describe('a device that cannot keep up', () => {
    // How many pieces the last frame drew, after `count` frames `step` ms apart.
    const piecesAfter = (count, step) => {
      let now = 0;
      for (let i = 0; i < count; i += 1) {
        now += step;
        ctx.copies = 0;
        raf.run(now);
      }
      return ctx.copies;
    };

    it('sheds pieces when frames stay slow', () => {
      render(<SeasonalCanvas effect="snow" />);
      expect(piecesAfter(70, 60)).toBe(38);
    });

    it('never below 40%', () => {
      render(<SeasonalCanvas effect="snow" />);
      expect(piecesAfter(2000, 60)).toBe(20);
    });

    it('a healthy 60 Hz keeps them all', () => {
      render(<SeasonalCanvas effect="snow" />);
      expect(piecesAfter(500, 16.7)).toBe(50);
    });

    it('the first frame after a long wait does not count as slow', () => {
      render(<SeasonalCanvas effect="snow" />);
      raf.run(600000);
      let now = 600000;
      for (let i = 0; i < 70; i += 1) {
        now += 16.7;
        ctx.copies = 0;
        raf.run(now);
      }
      expect(ctx.copies).toBe(50);
    });

    it('a steady 30 Hz low-power phone is not punished', () => {
      render(<SeasonalCanvas effect="snow" />);
      expect(piecesAfter(500, 33.4)).toBe(50);
    });
  });

  it('snow has no bats', () => {
    render(<SeasonalCanvas effect="snow" />);
    expect(mostBats(30)).toBe(0);
  });

  it('fades in rather than popping on', () => {
    const { container } = render(<SeasonalCanvas effect="snow" />);
    const canvas = container.querySelector('canvas');
    expect(canvas.style.opacity).toBe('0');
    let now = 0;
    for (let i = 0; i < 40; i += 1) { now += 50; raf.run(now); }
    expect(Number(canvas.style.opacity)).toBe(1);
  });

  it('stops while the tab is hidden, and resumes without a jump', () => {
    render(<SeasonalCanvas effect="snow" />);
    raf.run(16);
    expect(raf.frames.size).toBe(1);

    act(() => setHidden(true));
    expect(raf.frames.size).toBe(0);

    act(() => setHidden(false));
    expect(raf.frames.size).toBe(1);
  });

  it('leaves nothing running after it unmounts', () => {
    const { unmount } = render(<SeasonalCanvas effect="snow" />);
    raf.run(16);
    unmount();
    expect(raf.frames.size).toBe(0);
  });

  it('survives a browser with no canvas', () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    render(<SeasonalCanvas effect="snow" />);
    expect(raf.frames.size).toBe(0);
  });
});

describe('SeasonalCanvas.module.css', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = postcss.parse(readFileSync(join(here, '../SeasonalCanvas.module.css'), 'utf8'));
  const declsOf = (selector) => {
    const found = {};
    root.nodes.find((n) => n.selector === selector).walkDecls((d) => { found[d.prop] = d.value; });
    return found;
  };
  const decls = declsOf('.canvas');

  it('never takes a click', () => {
    expect(decls['pointer-events']).toBe('none');
  });

  it('sits over the header and under the grain, phone menu, dialogs and splash', () => {
    const z = Number(decls['z-index']);
    expect(z).toBeGreaterThan(60);
    expect(z).toBeLessThan(70);
    expect(decls.position).toBe('fixed');
  });

  it('the strip stays on the right edge, narrow', () => {
    const strip = declsOf('.strip');
    expect(strip.left).toBe('auto');
    expect(strip.width).toBe('140px');
    expect(decls.inset).toBe('0');
    expect(decls.height).toBe('100lvh');
  });
});
