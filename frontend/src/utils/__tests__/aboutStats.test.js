// frontend/src/utils/__tests__/aboutStats.test.js
//
// The About section's stat cards, now driven by `About.stats`.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATS, statDelay, parseStatValue, statCards,
} from '../aboutStats';

describe('parseStatValue', () => {
  it('splits a counting value into its number and its suffix', () => {
    expect(parseStatValue('5+')).toEqual({
      numeric: true, count: 5, decimals: 0, suffix: '+',
    });
  });

  it('handles a bare number with no suffix', () => {
    expect(parseStatValue('12')).toEqual({
      numeric: true, count: 12, decimals: 0, suffix: '',
    });
  });

  it('derives decimals from the digits the owner typed', () => {
    // ⚠️ The case that makes `decimals` worth computing at all. CountUp renders
    // `to.toFixed(decimals)`, so a fixed 0 would count '4.5+' up to a visible
    // '5+' — a plausible-looking number that is not the one that was entered.
    expect(parseStatValue('4.5+')).toEqual({
      numeric: true, count: 4.5, decimals: 1, suffix: '+',
    });
  });

  it('treats a word as static text, not as a count', () => {
    expect(parseStatValue('Continuous')).toEqual({ numeric: false, text: 'Continuous' });
  });

  it('does not count a value that merely CONTAINS a number', () => {
    // '24/7' would count to 24 and print '/7' if the regex were unanchored.
    // It is anchored, so a leading digit is required — and '24/7' has one, so
    // this asserts the more interesting half: the suffix survives intact.
    expect(parseStatValue('24/7')).toEqual({
      numeric: true, count: 24, decimals: 0, suffix: '/7',
    });
    // A value that does NOT start with a digit never counts.
    expect(parseStatValue('v2')).toEqual({ numeric: false, text: 'v2' });
  });

  it('survives a missing or non-string value', () => {
    expect(parseStatValue(undefined)).toEqual({ numeric: false, text: '' });
    expect(parseStatValue(null)).toEqual({ numeric: false, text: '' });
    expect(parseStatValue(7)).toEqual({ numeric: true, count: 7, decimals: 0, suffix: '' });
  });
});

describe('statDelay', () => {
  it('reproduces the prototype\'s four delays exactly', () => {
    // ⚠️ `Portfolio Revolution.dc.html:215,219,223,227` — data-delay 200 / 250 /
    // 300 / 350. The code this replaced said 50 / 50 / 50 / 350, so the first
    // three cards all landed together: `50` is the STEP between the export's
    // values, not any one of them. This assertion is the correction.
    expect([0, 1, 2, 3].map(statDelay)).toEqual([200, 250, 300, 350]);
  });

  it('continues the same step past the fourth card', () => {
    expect(statDelay(4)).toBe(400);
  });
});

describe('statCards', () => {
  const about = (stats) => ({ stats });

  it('renders the stored rows, in their stored order', () => {
    const cards = statCards(about([
      { label: 'Commits', value: '900+' },
      { label: 'Coffee',  value: 'Endless' },
    ]));

    expect(cards.map((c) => c.label)).toEqual(['Commits', 'Coffee']);
    expect(cards[0]).toMatchObject({ numeric: true, count: 900, suffix: '+', delay: 200 });
    expect(cards[1]).toMatchObject({ numeric: false, text: 'Endless', delay: 250 });
  });

  it('trims the label it renders', () => {
    expect(statCards(about([{ label: '  Commits  ', value: '9' }]))[0].label).toBe('Commits');
  });

  it('drops a row missing either half', () => {
    // The schema marks both required, so these cannot be SAVED — but a document
    // written before those rules can hold one, and a card with an empty numeral
    // is worse than no card.
    const cards = statCards(about([
      { label: 'Good',    value: '1' },
      { label: 'No value', value: '' },
      { label: '',        value: '2' },
      null,
    ]));
    expect(cards.map((c) => c.label)).toEqual(['Good']);
  });

  it('falls back to the four built-in cards while the query is in flight', () => {
    expect(statCards(undefined).map((c) => c.label))
      .toEqual(DEFAULT_STATS.map((s) => s.label));
    expect(statCards({}).map((c) => c.label))
      .toEqual(DEFAULT_STATS.map((s) => s.label));
  });

  it('renders NOTHING when the owner has deliberately emptied the list', () => {
    // ⚠️ THE DISTINCTION THIS WHOLE MODULE TURNS ON, and the one a `.length`
    // check would collapse. `undefined` means "not loaded" and takes the
    // defaults; `[]` means "the owner deleted them all" and must stay empty.
    // Falling back here would put four cards the owner just deleted straight
    // back on the page — which reads as the panel refusing to save.
    expect(statCards({ stats: [] })).toEqual([]);
  });

  it('keys on the label rather than the index', () => {
    // ⚠️ CountUp holds its animated value in component state, so a key of
    // `index` lets React reuse a card's DOM across a reorder — the previous
    // card's NUMBER under the new card's label. Asserted as "the key moves with
    // the row", which is the property that matters.
    const rows = [
      { label: 'Alpha', value: '1' },
      { label: 'Beta',  value: '2' },
    ];
    const forward  = statCards(about(rows));
    const reversed = statCards(about([...rows].reverse()));

    expect(forward[0].key).not.toBe(reversed[0].key);
    expect(forward[0].key).toContain('Alpha');
    expect(reversed[0].key).toContain('Beta');
  });

  it('gives the built-in fallback the prototype\'s own four cards', () => {
    const cards = statCards(undefined);
    expect(cards).toHaveLength(4);
    expect(cards.slice(0, 3).every((c) => c.numeric)).toBe(true);
    expect(cards[3]).toMatchObject({ numeric: false, text: 'Continuous', label: 'LEARNING' });
  });
});
