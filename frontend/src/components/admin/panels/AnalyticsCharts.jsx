// frontend/src/components/admin/panels/AnalyticsCharts.jsx
import { useId, useState } from 'react';
import {
  barPercent, chartColour, chartPoints, countText, niceMax, pieSlices, shareOfTop, totalOf, withShares,
} from '../../../utils/audienceStats';
import styles from './AdminAnalyticsPanel.module.css';

/**
 * PF-149 — the Analytics panel's charts: hand-drawn SVG and CSS, no library (the
 * sprint plan). Every colour is a token, so both themes come free.
 *
 * Each chart also carries a table only a screen reader meets: a picture of
 * numbers says nothing without one.
 */

const OTHER_COLOUR = 'var(--muted2)';

function HiddenTable({ caption, headers, rows }) {
  return (
    // ⚠️ The DIV is the hidden box. A table ignores `height` and `overflow`, so a
    // table given this class stayed full height and ran the page on past the footer.
    <div className={styles.visuallyHidden}>
      <table>
        <caption>{caption}</caption>
        <thead><tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((cells) => (
            <tr key={cells[0]}>{cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Area chart ──────────────────────────────────────────────────────────────

const VIEW_W = 1000;
const VIEW_H = 300;

const pointsFor = (rows, field, top) => chartPoints(rows.map((row) => row[field]), top, VIEW_W, VIEW_H);

const lineOf = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
const areaOf = (points) =>
  `${lineOf(points)} L${points[points.length - 1].x} ${VIEW_H} L${points[0].x} ${VIEW_H} Z`;

/**
 * `series` share one axis because they share one unit (people and pages opened,
 * on the same scale). Labels are HTML over a stretched SVG, because text inside
 * `preserveAspectRatio="none"` would stretch with it.
 */
export function AreaChart({ rows, series, caption }) {
  const [active, setActive] = useState(null);
  const gradientId = useId();
  const top = niceMax(Math.max(...rows.flatMap((row) => series.map((s) => row[s.field]))));
  const lastIndex = rows.length - 1;
  const leftOf = (i) => (rows.length === 1 ? 50 : (i / lastIndex) * 100);

  const onPointerMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    setActive(Math.round(((event.clientX - box.left) / box.width) * lastIndex));
  };

  const shown = active === null ? null : rows[active];
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6));

  return (
    <figure className={styles.figure}>
      <div className={styles.areaFrame}>
        <div className={styles.axisY} aria-hidden="true">
          <span>{countText(top)}</span>
          <span>{top >= 2 ? countText(Math.round(top / 2)) : ''}</span>
          <span>0</span>
        </div>
        <div
          className={styles.areaPlot}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className={styles.areaSvg} aria-hidden="true">
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.field} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColour(s.slot)} stopOpacity=".38" />
                  <stop offset="100%" stopColor={chartColour(s.slot)} stopOpacity=".02" />
                </linearGradient>
              ))}
            </defs>
            {[0, .5, 1].map((f) => (
              <line key={f} x1="0" x2={VIEW_W} y1={f * VIEW_H} y2={f * VIEW_H} className={styles.gridLine} vectorEffect="non-scaling-stroke" />
            ))}
            {series.map((s, i) => {
              const points = pointsFor(rows, s.field, top);
              return (
                <g key={s.field}>
                  {rows.length > 1 && <path d={areaOf(points)} fill={`url(#${gradientId}-${i})`} />}
                  {rows.length > 1 && <path d={lineOf(points)} fill="none" stroke={chartColour(s.slot)} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
                </g>
              );
            })}
          </svg>
          {/* Dots in HTML: a circle in the stretched SVG would become an oval. */}
          {series.flatMap((s) => pointsFor(rows, s.field, top)
            .map((p, i) => ({ p, i }))
            .filter(({ i }) => rows.length === 1 || i === active || i === lastIndex)
            .map(({ p, i }) => (
              <span
                key={`${s.field}-${i}`}
                aria-hidden="true"
                className={rows[i].partial ? styles.dotSoFar : styles.dot}
                style={{ left: `${leftOf(i)}%`, top: `${(p.y / VIEW_H) * 100}%`, '--mark': chartColour(s.slot) }}
              />
            )))}
          {shown && (
            <>
              <span aria-hidden="true" className={styles.crosshair} style={{ left: `${leftOf(active)}%` }} />
              <div
                aria-hidden="true"
                className={leftOf(active) > 60 ? styles.tipFlip : styles.tip}
                style={{ left: `${leftOf(active)}%` }}
              >
                <strong>{shown.label}{shown.partial ? ' · SO FAR' : ''}</strong>
                {series.map((s) => (
                  <span key={s.field} className={styles.tipRow}>
                    <span className={styles.swatch} style={{ '--mark': chartColour(s.slot) }} />
                    {s.label} <b>{countText(shown[s.field])}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className={styles.axisX} aria-hidden="true">
        {rows.map((row, i) => (i % labelEvery === 0 || i === lastIndex) && (
          (i === lastIndex || lastIndex - i >= labelEvery / 2) && (
            <span key={row.key} style={{ left: `${leftOf(i)}%` }}>
              {row.label}{row.partial ? ' · SO FAR' : ''}
            </span>
          )
        ))}
      </div>
      <ul className={styles.legend} aria-hidden="true">
        {series.map((s) => (
          <li key={s.field}><span className={styles.swatch} style={{ '--mark': chartColour(s.slot) }} />{s.label}</li>
        ))}
      </ul>
      <HiddenTable
        caption={caption}
        headers={['Period', ...series.map((s) => s.label)]}
        rows={rows.map((row) => [`${row.label}${row.partial ? ' so far' : ''}`, ...series.map((s) => row[s.field])])}
      />
    </figure>
  );
}

// ── Pie chart ───────────────────────────────────────────────────────────────

const R = 40;
const SLICE_GAP = 0.7; // of 100, so neighbouring slices never touch

/**
 * `rows` come from topWithOther: at most 5 + Other, because six colours are all
 * the palette can keep apart. The hole carries the total. `pathLength` lets each
 * slice be written directly as its share of 100.
 */
export function PieChart({ rows, label, labelOf }) {
  const [active, setActive] = useState(null);
  const shares = withShares(rows);
  const total = totalOf(rows);
  const slices = pieSlices(rows);
  const colourOf = (row, i) => (row.key === '(other)' ? OTHER_COLOUR : chartColour(i + 1));

  const shown = active === null ? null : shares[active];

  return (
    <figure className={styles.pie}>
      <div className={styles.pieRing}>
        <svg viewBox="0 0 100 100" className={styles.pieSvg} aria-hidden="true">
          <g transform="rotate(-90 50 50)">
            {slices.map(({ row, i, size, start: from }) => (
              <circle
                key={row.key}
                cx="50" cy="50" r={R}
                pathLength="100"
                fill="none"
                stroke={colourOf(row, i)}
                className={active === i ? styles.sliceActive : styles.slice}
                strokeDasharray={`${rows.length > 1 ? Math.max(size - SLICE_GAP, .2) : 100} 100`}
                strokeDashoffset={-from}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
              />
            ))}
          </g>
        </svg>
        <p className={styles.pieHole} aria-hidden="true">
          <strong>{countText(shown ? shown.count : total)}</strong>
          <span>{shown ? `${shown.percent}%` : 'TOTAL'}</span>
        </p>
      </div>
      <ul className={styles.pieKey} aria-hidden="true">
        {shares.map((row, i) => (
          <li
            key={row.key}
            className={active === i ? styles.pieKeyActive : undefined}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          >
            <span className={styles.swatch} style={{ '--mark': colourOf(row, i) }} />
            <span className={styles.pieKeyName}>{labelOf(row.key)}</span>
            <span className={styles.pieKeyValue}>{countText(row.count)} · {row.percent}%</span>
          </li>
        ))}
      </ul>
      <HiddenTable
        caption={label}
        headers={['Name', 'Count', 'Share']}
        rows={shares.map((row) => [labelOf(row.key), row.count, `${row.percent}%`])}
      />
    </figure>
  );
}

// ── Ranked bars ─────────────────────────────────────────────────────────────

/**
 * A scroll box for anything that can grow (owner: lists scroll on laptop AND
 * phone). `tabIndex`: a keyboard has to be able to scroll it too.
 */
export function ScrollList({ label, children }) {
  return (
    <div className={styles.scrollList} tabIndex={0} role="group" aria-label={label}>{children}</div>
  );
}

/** Real list markup, so the numbers need no second table. Colours by `slot`. */
export function BarList({ rows, labelOf, slot = 1 }) {
  const top = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ol className={styles.barList}>
      {rows.map((row) => (
        <li key={row.key} className={styles.barRow}>
          <span className={styles.barName} title={labelOf(row)}>{labelOf(row)}</span>
          <span className={styles.barValue}>{countText(row.count)}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              className={styles.barFill}
              style={{ width: `${barPercent(row.count, top)}%`, '--mark': chartColour(slot) }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Columns: time of day, and the day-by-day counts ─────────────────────────

export function Columns({ rows, labelOf, slot = 1, caption, labelEvery = 1 }) {
  const [active, setActive] = useState(null);
  const busiest = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  const top = Math.max(1, busiest.count);
  const shown = active === null ? busiest : rows[active];

  return (
    <figure className={styles.figure}>
      <div className={styles.columnsTip} aria-hidden="true">
        {active === null ? 'HIGHEST: ' : ''}{labelOf(shown.key)} · {countText(shown.count)}
      </div>
      <div className={styles.columns} onPointerLeave={() => setActive(null)} aria-hidden="true">
        {rows.map((row, i) => (
          <span key={row.key} className={styles.column} onPointerEnter={() => setActive(i)}>
            <span
              className={active === i ? styles.columnFillActive : styles.columnFill}
              style={{ height: `${shareOfTop(row.count, top)}%`, '--mark': chartColour(slot) }}
            />
          </span>
        ))}
      </div>
      <div className={styles.columnLabels} aria-hidden="true">
        {rows.map((row, i) => (
          <span key={row.key}>{i % labelEvery === 0 ? labelOf(row.key) : ''}</span>
        ))}
      </div>
      <HiddenTable
        caption={caption}
        headers={['When', 'Count']}
        rows={rows.map((row) => [labelOf(row.key), row.count])}
      />
    </figure>
  );
}
