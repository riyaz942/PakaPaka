import { readFileSync } from 'fs';
import { join } from 'path';

// The landing page keeps its scroll story math in a `// <story-math>` block of
// pure functions. Load that block from the HTML and test it here.
const html = readFileSync(join(__dirname, '..', 'public', 'landing', 'index.html'), 'utf8');
const block = /\/\/ <story-math>([\s\S]*?)\/\/ <\/story-math>/.exec(html)?.[1] ?? '';
const S = new Function(
  `${block}; return { span, pinProgress, flowProgress, fits, pinOffset, tokenLook, chainState, relay, grammarState, mergeState, countValue };`,
)();

/** Every number in a state object (booleans as 0/1), in a fixed order. */
function numbers(state: Record<string, unknown>): number[] {
  return Object.keys(state)
    .sort()
    .flatMap(k => {
      const v = state[k];
      return Array.isArray(v) ? v.map(Number) : [Number(v)];
    });
}

describe('landing scroll story math', () => {
  it('span clamps to [0, 1]', () => {
    expect(S.span(0.5, 0, 1)).toBeCloseTo(0.5);
    expect(S.span(-1, 0, 1)).toBe(0);
    expect(S.span(2, 0, 1)).toBe(1);
  });

  it('pinProgress is the scrolled share of the wrapper', () => {
    expect(S.pinProgress(-300, 100, 800)).toBeCloseTo(0.5);
    expect(S.pinProgress(200, 100, 800)).toBe(0);
    expect(S.pinProgress(-900, 100, 800)).toBe(1);
  });

  it('flowProgress follows the scene through the window', () => {
    expect(S.flowProgress(800, 600, 1000)).toBe(0);
    expect(S.flowProgress(400, 600, 1000)).toBeCloseTo(0.5);
    expect(S.flowProgress(0, 600, 1000)).toBe(1);
  });

  it('fits needs scene + nav + 32 px', () => {
    expect(S.fits(578, 65, 675)).toBe(true);
    expect(S.fits(578, 65, 674)).toBe(false);
  });

  it('pinOffset centres below the nav, at least 16 px', () => {
    expect(S.pinOffset(578, 65, 900)).toBeCloseTo(193.5);
    expect(S.pinOffset(578, 65, 660)).toBeCloseTo(81);
  });

  it('tokenLook follows the fly curve', () => {
    expect(S.tokenLook(0).visible).toBe(false);
    expect(S.tokenLook(1).visible).toBe(false);
    const a = S.tokenLook(0.09);
    expect(a.visible).toBe(true);
    expect(a.opacity).toBeCloseTo(0.5);
    expect(a.scale).toBeCloseTo(0.9);
    const b = S.tokenLook(0.94);
    expect(b.opacity).toBeCloseTo(0.5);
    expect(b.scale).toBeCloseTo(0.55);
  });

  it('chainState at the start is all 0 and not lit', () => {
    const s = S.chainState(0);
    expect([...s.rows, s.col2, s.col3, ...s.radTokens, s.kanjiToken]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(s.kLit).toBe(false);
    expect(s.vLit).toBe(false);
  });

  it('chainState mid values', () => {
    const a = S.chainState(0.27);
    expect(a.radTokens[0]).toBeCloseTo(0.4375);
    expect(a.radTokens[1]).toBe(0);
    expect(a.col2).toBeCloseTo(0.875);

    const b = S.chainState(0.5);
    expect(b.radTokens).toEqual([1, 1, 1]);
    expect(b.kLit).toBe(true);
    expect(b.col3).toBe(0);

    const c = S.chainState(0.71);
    expect(c.kanjiToken).toBeCloseTo(0.5);
    expect(c.col3).toBe(1);
    expect(c.vLit).toBe(false);
  });

  it('chainState at the end is all 1 and lit', () => {
    const s = S.chainState(1);
    expect([...s.rows, s.col2, s.col3, ...s.radTokens, s.kanjiToken]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(s.kLit).toBe(true);
    expect(s.vLit).toBe(true);
  });

  it('relay holds the token at the middle line', () => {
    expect(S.relay(500, 700, 400)).toEqual({ state: 'before', t: 0 });
    const c = S.relay(300, 500, 400);
    expect(c.state).toBe('carry');
    expect(c.t).toBeCloseTo(0.5);
    expect(S.relay(100, 350, 400)).toEqual({ state: 'arrived', t: 1 });
  });

  it('grammarState types both answers, then the hint', () => {
    // 16 = "have done before"; 15 = code points in 夜は一人で歩くない暗いもんです
    expect(S.grammarState(0, 16, 15)).toEqual({
      cards: 0, readChars: 0, readDone: false, buildChars: 0, buildDone: false, hint: false,
    });
    expect(S.grammarState(0.25, 16, 15).readChars).toBe(8);
    const r = S.grammarState(0.42, 16, 15);
    expect(r.readChars).toBe(16);
    expect(r.readDone).toBe(true);
    expect(S.grammarState(0.65, 16, 15).buildChars).toBe(8);
    const b = S.grammarState(0.82, 16, 15);
    expect(b.buildChars).toBe(15);
    expect(b.buildDone).toBe(true);
    expect(b.hint).toBe(false);
    expect(S.grammarState(0.87, 16, 15).hint).toBe(true);
  });

  it('mergeState gathers the apps, then shows the one', () => {
    const m = S.mergeState(0.35);
    expect(m.gather).toBeCloseTo(0.5);
    expect(m.arrow).toBe(1);
    expect(m.one).toBe(0);
    expect(m.oneLit).toBe(false);
    const e = S.mergeState(1);
    expect([...e.apps, e.arrow, e.gather, e.one, e.count]).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(e.oneLit).toBe(true);
  });

  it('countValue eases out to the end value', () => {
    expect(S.countValue(9749, 0)).toBe(0);
    expect(S.countValue(9749, 1)).toBe(9749);
    expect(S.countValue(2000, 0.5)).toBe(1750);
  });

  it('lays out the scenes once before it waits for late fonts', () => {
    // document.fonts.ready read before the first layout can be a promise that is already
    // resolved (no font load started yet): then no layout runs after the real fonts arrive.
    const start = html.slice(html.indexOf('// ---- start the scroll story'));
    const first = start.indexOf('layoutScenes();');
    const fonts = start.indexOf('document.fonts.ready.then(layoutScenes)');
    expect(first).toBeGreaterThan(-1);
    expect(fonts).toBeGreaterThan(first);
  });

  it('every scene state is non-decreasing in p', () => {
    const scenes: ((p: number) => Record<string, unknown>)[] = [
      p => S.chainState(p),
      p => S.grammarState(p, 16, 15),
      p => S.mergeState(p),
    ];
    for (const scene of scenes) {
      let prev = numbers(scene(0));
      for (let i = 1; i <= 100; i++) {
        const next = numbers(scene(i / 100));
        next.forEach((v, j) => expect(v).toBeGreaterThanOrEqual(prev[j]));
        prev = next;
      }
    }
  });
});
