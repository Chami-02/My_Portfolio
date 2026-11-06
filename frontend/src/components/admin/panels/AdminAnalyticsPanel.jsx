// frontend/src/components/admin/panels/AdminAnalyticsPanel.jsx
import { useEffect, useMemo, useState } from 'react';
import { useAnalytics, useExportAnalytics, useGrowth, useLiveAnalytics } from '../../../hooks/useAnalytics';
import {
  GROWTH_WINDOW, agoText, changeFrom, chartColour, countText, countryLabel, dayLabel, fullDayLabel,
  fullDayOfHours, groupGrowth, growthChange, hourLabel, localCities, plainLabel,
  sortRows, titleLabel, topWithOther, totalOf,
} from '../../../utils/audienceStats';
import { saveBlob } from '../../../utils/backupFile';
import { friendlyError } from '../../../utils/friendlyError';
import { LoadError } from '../LoadError';
import { AreaChart, BarList, Columns, PieChart, ScrollList } from './AnalyticsCharts';
import styles from './AdminAnalyticsPanel.module.css';
import a from '../../../styles/admin.module.css';

/**
 * AdminAnalyticsPanel — PF-149. No prototype exists for this panel (owner's
 * brief, 2026-11-06: full page, graphs and pie charts, growth by day to year,
 * live monitoring, most reached sections, country charts).
 *
 * ⚠️ Three separate requests with three separate failures. The live row failing
 * must not hide a report that loaded, and a failed load never paints a zero.
 *
 * ⚠️ Private numbers: PF-150's public box must not reuse these answers.
 */

const RANGES = [
  { id: '7',    label: '7 DAYS' },
  { id: '30',   label: '30 DAYS' },
  { id: '90',   label: '90 DAYS' },
  { id: 'year', label: 'THIS YEAR' },
];

const UNITS = [
  { id: 'day',   label: 'DAY' },
  { id: 'week',  label: 'WEEK' },
  { id: 'month', label: 'MONTH' },
  { id: 'year',  label: 'YEAR' },
];

const GROWTH_SERIES = [
  { field: 'visitors', label: 'Visitors',   slot: 1 },
  { field: 'views',    label: 'Page views', slot: 2 },
];

const SECTION_LABELS = {
  hero: 'Hero', about: 'About', skills: 'Skills', projects: 'Projects', blog: 'Blog', contact: 'Contact',
};

const PATH_NAMES = {
  '/': 'Home page', '/blog': 'Blog', '/projects': 'Projects', '/certificates': 'Certificates',
  '/privacy': 'Privacy', '/cv-unavailable': 'CV unavailable', '(other)': 'Other pages',
};

// All three always show: a door nobody used is an answer too.
const SIGN_IN_METHODS = [
  { key: 'password', label: 'Password' },
  { key: 'google',   label: 'Google' },
  { key: 'passkey',  label: 'Passkey' },
];

const LIVE_TICK_MS = 1000;

/** The little arrow and number beside a total. */
function Change({ change }) {
  if (change.kind === 'none') return <span className={styles.changeMuted}>—</span>;
  if (change.kind === 'new')  return <span className={styles.changeNew}>NEW</span>;
  if (change.kind === 'same') return <span className={styles.changeMuted}>NO CHANGE</span>;
  const up = change.kind === 'up';
  return (
    <span className={up ? styles.changeUp : styles.changeDown}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className={styles.visuallyHidden}>{up ? 'Up' : 'Down'} </span>
      {change.percent}%
    </span>
  );
}

function Card({ title, note, wide, children }) {
  return (
    <section className={wide ? styles.cardWide : styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {note && <p className={styles.cardNote}>{note}</p>}
      {children}
    </section>
  );
}

const Nothing = ({ children }) => <p className={a.emptyState}>{children}</p>;

function Toggle({ options, value, onChange, label }) {
  return (
    <div className={styles.toggle} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.toggleButton}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ── Live row ────────────────────────────────────────────────────────────────

function LiveRow() {
  const query = useLiveAnalytics();
  const { data: live, isError, error, dataUpdatedAt } = query;
  const [now, setNow] = useState(() => Date.now());

  // A callback the effect registers, so the "seconds ago" keeps moving.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const age = agoText(Math.max(0, now - dataUpdatedAt));
  // An answer at all means the site and its database both replied.
  const healthy = !isError && Boolean(live);

  const cells = live ? [
    { label: 'ON THE SITE NOW', value: live.onSiteNow, slot: 1 },
    { label: 'VISITORS TODAY',  value: live.visitorsToday, slot: 2 },
    { label: 'VIEWS TODAY',     value: live.viewsToday, slot: 3 },
    { label: 'VIEWS THIS HOUR', value: live.viewsThisHour, slot: 4 },
  ] : [];

  return (
    <section className={styles.live} aria-labelledby="analytics-live-title">
      <h3 id="analytics-live-title" className={isError ? styles.livePaused : styles.liveTitle}>
        <span aria-hidden="true" className={isError ? styles.liveDotPaused : styles.liveDot} />
        {isError
          ? (live ? `PAUSED · LAST UPDATED ${age.toUpperCase()}` : 'PAUSED · COULD NOT CHECK YET')
          : `LIVE${live ? ` · UPDATED ${age.toUpperCase()}` : ''}`}
      </h3>
      {isError && <p className={styles.liveReason} role="alert">{friendlyError(error)}</p>}
      <div className={styles.liveGrid}>
        {cells.map((cell) => (
          <div key={cell.label} className={isError ? styles.liveCellStale : styles.liveCell} style={{ '--mark': chartColour(cell.slot) }}>
            <p className={styles.liveValue}>{countText(cell.value)}</p>
            <p className={styles.liveLabel}>{cell.label}</p>
          </div>
        ))}
        {!live && !isError && Array.from({ length: 4 }, (_, i) => <div key={i} className={a.skelRow} />)}
        <div className={styles.liveCell} style={{ '--mark': healthy ? 'var(--ok)' : 'var(--danger)' }}>
          <p className={healthy ? styles.healthOk : styles.healthBad}>
            <span aria-hidden="true">{healthy ? '●' : '!'}</span> {healthy ? 'OK' : 'NOT ANSWERING'}
          </p>
          <p className={styles.liveLabel}>
            SITE AND DATABASE{healthy && live ? ` · ${countText(live.ms)} MS` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Growth ──────────────────────────────────────────────────────────────────

function GrowthCard() {
  const query = useGrowth();
  const [unit, setUnit] = useState('day');
  const buckets = useMemo(
    () => (query.data?.days.length ? groupGrowth(query.data.days, unit) : []),
    [query.data, unit],
  );
  const change = growthChange(buckets);
  const window_ = buckets.slice(-GROWTH_WINDOW[unit]);
  const anyone = buckets.some((b) => b.views > 0 || b.visitors > 0);

  return (
    <section className={styles.cardWide}>
      <div className={styles.growthHead}>
        <h3 className={styles.cardTitle}>AUDIENCE GROWTH</h3>
        <Toggle options={UNITS} value={unit} onChange={setUnit} label="Group growth by" />
      </div>
      {query.isError && <LoadError what="AUDIENCE GROWTH" query={query} />}
      {query.isPending && <div className={styles.skelChart} />}
      {query.data && !anyone && <Nothing>No visitors counted yet.</Nothing>}
      {query.data && anyone && (
        <>
          <p className={styles.cardNote}>
            {change ? (
              <>
                {change.label} against {change.against}: visitors <Change change={change.visitors} /> · views <Change change={change.views} />
              </>
            ) : `Up and down arrows appear once there are two full ${unit}s to compare.`}
          </p>
          <AreaChart rows={window_} series={GROWTH_SERIES} caption={`Visitors and page views by ${unit}`} />
        </>
      )}
    </section>
  );
}

// ── The report for one date range ───────────────────────────────────────────

function Report({ report }) {
  const [place, setPlace] = useState('world');
  const { totals, previous, comparable, breakdowns: b } = report;

  const countries = sortRows(b.country);
  const cities = place === 'world' ? sortRows(b.city) : sortRows(localCities(b.city));
  const visitorsTotal = totalOf(b.country);
  const sriLanka = b.country.find((row) => row.key === 'LK')?.count ?? 0;
  const noVisitors = totals.visitors === 0 && totals.views === 0;

  const TOTALS = [
    { label: 'VISITORS',     key: 'visitors',  slot: 1, fair: comparable },
    { label: 'PAGE VIEWS',   key: 'views',     slot: 2, fair: comparable },
    // Messages have their own dates from long before the counter began.
    { label: 'MESSAGES',     key: 'messages',  slot: 3, fair: true },
    { label: 'EMAIL CLICKS', key: 'email',     slot: 4, fair: comparable },
    { label: 'CV CLICKS',    key: 'cv',        slot: 5, fair: comparable },
    { label: 'GITHUB CLICKS', key: 'github',   slot: 6, fair: comparable },
  ];

  return (
    <>
      <div className={styles.totals}>
        {TOTALS.map((t) => (
          <div key={t.key} className={styles.total} style={{ '--mark': chartColour(t.slot) }}>
            <p className={styles.totalValue}>{countText(totals[t.key])}</p>
            <p className={styles.totalLabel}>{t.label}</p>
            <Change change={changeFrom(totals[t.key], previous[t.key], t.fair)} />
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <Card title="MOST REACHED SECTIONS" note="How many times each part of the home page was seen. Counts start from the day this was switched on.">
          {b.section.length === 0 ? <Nothing>No sections counted in this period.</Nothing> : (
            <ScrollList label="Most reached sections">
              <BarList rows={sortRows(b.section)} labelOf={(r) => SECTION_LABELS[r.key] ?? r.key} slot={3} />
            </ScrollList>
          )}
        </Card>

        <Card title="MOST VIEWED PROJECTS AND POSTS" note="Page openings in this period.">
          {report.mostViewed.projects.length === 0 && report.mostViewed.posts.length === 0
            ? <Nothing>No project or post was opened in this period.</Nothing>
            : (
              <ScrollList label="Most viewed projects and posts">
                {report.mostViewed.projects.length > 0 && (
                  <>
                    <h4 className={styles.subTitle}>PROJECTS</h4>
                    <BarList rows={report.mostViewed.projects} labelOf={(r) => r.title} slot={4} />
                  </>
                )}
                {report.mostViewed.posts.length > 0 && (
                  <>
                    <h4 className={styles.subTitle}>POSTS</h4>
                    <BarList rows={report.mostViewed.posts} labelOf={(r) => r.title} slot={5} />
                  </>
                )}
              </ScrollList>
            )}
        </Card>

        {noVisitors ? (
          <Card title="WHERE THEY ARE FROM" wide><Nothing>No visitors in this period yet.</Nothing></Card>
        ) : (
          <>
            <Card title="COUNTRIES" note={`Sri Lanka ${countText(sriLanka)} · rest of the world ${countText(visitorsTotal - sriLanka)}`}>
              <PieChart rows={topWithOther(countries, 5)} label="Visitors by country" labelOf={countryLabel} />
            </Card>
            <Card title="COUNTRIES, RANKED" note="Every country in this period.">
              <ScrollList label="Every country">
                <BarList rows={countries} labelOf={(r) => countryLabel(r.key)} slot={1} />
              </ScrollList>
            </Card>

            <Card title="CITIES">
              <Toggle
                options={[{ id: 'world', label: 'WORLDWIDE' }, { id: 'local', label: 'SRI LANKA' }]}
                value={place}
                onChange={setPlace}
                label="Which cities"
              />
              {cities.length === 0
                ? <Nothing>No cities to show.</Nothing>
                : <ScrollList label="Cities"><BarList rows={cities} labelOf={(r) => plainLabel(r.key)} slot={2} /></ScrollList>}
            </Card>
            <Card title="WHERE VISITORS CAME FROM">
              <PieChart rows={topWithOther(b.referrer, 5)} label="Visitors by source" labelOf={plainLabel} />
            </Card>

            <Card title="DEVICES">
              <PieChart rows={topWithOther(b.device, 5)} label="Visitors by device" labelOf={titleLabel} />
            </Card>
            <Card title="BROWSERS">
              <PieChart rows={topWithOther(b.browser, 5)} label="Visitors by browser" labelOf={plainLabel} />
            </Card>

            <Card title="TIME OF DAY" note="Page views by hour, Sri Lanka time.">
              <Columns rows={fullDayOfHours(b.hour)} labelOf={hourLabel} slot={4} caption="Page views by hour" labelEvery={6} />
            </Card>
            <Card title="PAGES">
              <ScrollList label="Pages">
                <BarList rows={sortRows(report.pages)} labelOf={(r) => r.title ?? PATH_NAMES[r.key] ?? r.key} slot={5} />
              </ScrollList>
            </Card>
          </>
        )}

        <Card title="MESSAGES, DAY BY DAY">
          {totals.messages === 0 ? <Nothing>No messages in this period.</Nothing> : (
            <Columns rows={report.daily.map((d) => ({ key: d.day, count: d.messages }))} labelOf={dayLabel} slot={3} caption="Messages by day" labelEvery={Math.max(1, Math.ceil(report.daily.length / 5))} />
          )}
        </Card>
        <Card title="LINK CLICKS, DAY BY DAY" note={`Email ${countText(totals.email)} · CV ${countText(totals.cv)} · GitHub ${countText(totals.github)} · Live site ${countText(totals.live)}`}>
          {report.daily.every((d) => d.clicks === 0) ? <Nothing>No link clicks in this period.</Nothing> : (
            <Columns rows={report.daily.map((d) => ({ key: d.day, count: d.clicks }))} labelOf={dayLabel} slot={6} caption="Link clicks by day" labelEvery={Math.max(1, Math.ceil(report.daily.length / 5))} />
          )}
        </Card>

        <Card title="MESSAGES BY COUNTRY">
          {report.messagesByCountry.length === 0 ? <Nothing>No messages in this period.</Nothing> : (
            <ScrollList label="Messages by country">
              <BarList rows={sortRows(report.messagesByCountry)} labelOf={(r) => plainLabel(r.key)} slot={3} />
            </ScrollList>
          )}
        </Card>
        <Card title="SIGN-INS" note="Your admin account. Goes back 90 days at most, because older records are deleted automatically.">
          <div className={styles.signIns}>
            <p><strong className={styles.signInOk}>{countText(report.signIns.ok)}</strong> SUCCESSFUL</p>
            <p><strong className={styles.signInFailed}>{countText(report.signIns.failed)}</strong> FAILED</p>
          </div>
          <BarList
            rows={SIGN_IN_METHODS.map(({ key, label }) => ({ key, label, count: report.signIns.byMethod[key] ?? 0 }))}
            labelOf={(r) => r.label}
            slot={5}
          />
        </Card>
      </div>
    </>
  );
}

// ── The panel ───────────────────────────────────────────────────────────────

export function AdminAnalyticsPanel() {
  const [range, setRange] = useState('30');
  const query = useAnalytics(range);
  const exporter = useExportAnalytics();
  const report = query.data;

  const download = () => exporter.mutate(undefined, {
    onSuccess: (blob) => saveBlob(blob, `site-numbers-${report?.to ?? 'all'}.csv`),
  });

  return (
    <div className={styles.stack}>
      <div className={styles.head}>
        <p className={styles.since}>
          {report?.countingSince ? `Counting since ${fullDayLabel(report.countingSince)}` : 'Nothing counted yet'} · Sri Lanka time
        </p>
        <button type="button" className={a.btnOutline} onClick={download} disabled={exporter.isPending}>
          {exporter.isPending ? 'PREPARING…' : 'DOWNLOAD CSV'}
        </button>
      </div>
      {exporter.isError && (
        <p className={a.bannerError} role="alert">
          <span aria-hidden="true" className={a.bannerDot} />
          {friendlyError(exporter.error, { fallback: 'The download didn’t work. Please try again.' })}
        </p>
      )}

      <LiveRow />
      <GrowthCard />

      {/* Here, not at the top of the page: Live and Growth have their own
          controls, and these buttons change only what is below them. */}
      <div className={styles.rangeBar}>
        <h3 className={styles.cardTitle}>TOTALS AND BREAKDOWNS</h3>
        <Toggle options={RANGES} value={range} onChange={setRange} label="Date range" />
      </div>

      {query.isError && !report && <LoadError what="YOUR ANALYTICS" query={query} />}
      {query.isPending && (
        <div className={styles.grid}>
          {Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.skelChart} />)}
        </div>
      )}
      {report && <Report key={range} report={report} />}

      <details className={styles.honest}>
        <summary>HOW ACCURATE ARE THESE NUMBERS?</summary>
        <ul>
          <li>Every number here is exactly what the counter stored.</li>
          <li>Week, month and year visitors are added up from the daily counts.</li>
          <li>A visit counts only after someone stays 10 seconds, opens a second page or clicks a counted link (the rule Google Analytics uses). Anyone gone sooner is not counted. This filters out most automated visits, but not all of them.</li>
          <li>Sections are sent as a visitor leaves or switches away, so a browser that crashes first sends none.</li>
          <li>Visitors are counted once per day, so someone who comes on 3 days counts as 3, and one person on a phone and a laptop counts as 2.</li>
          <li>People sharing one network and the same browser type can count as 1.</li>
          <li>People whose browser asks not to be followed, automated browsers, bots and you are left out on purpose.</li>
          <li>Country and city are approximate. A VPN shows the VPN’s location.</li>
          <li>A message you delete no longer counts in Messages.</li>
        </ul>
      </details>
    </div>
  );
}
