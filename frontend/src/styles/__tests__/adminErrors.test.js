// PF-149 (owner, 2026-11-06: "proper error handling messages") — the two rules
// every admin screen keeps, checked across all of them so a new panel inherits them.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(join(src, path), 'utf8');

const adminFiles = ['components/admin', 'components/admin/panels'].flatMap((dir) =>
  readdirSync(join(src, dir))
    .filter((name) => name.endsWith('.jsx'))
    .map((name) => `${dir}/${name}`));

describe('admin error messages', () => {
  it('finds the panels', () => {
    expect(adminFiles.length).toBeGreaterThan(20);
    expect(adminFiles).toContain('components/admin/panels/AdminAnalyticsPanel.jsx');
  });

  // Words reach a person only through utils/friendlyError.js, which keeps out
  // status codes and technical terms. Reading the error directly bypasses it.
  it.each(adminFiles)('%s shows no raw error text', (file) => {
    const code = read(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/\b(err|error|e)\??\.message\b/);
    expect(code).not.toMatch(/response\??\.data\??\.message/);
  });
});

describe('a crash stays small', () => {
  it('the router has its own error screen, loaded up front', () => {
    const app = read('App.jsx');
    expect(app).toMatch(/errorElement:\s*<RouteError \/>/);
    expect(app).toMatch(/^import \{ RouteError \}/m);
    expect(app).not.toMatch(/RouteError\s*=\s*lazy/);
  });

  it('each admin panel has its own boundary, cleared by changing tab', () => {
    expect(read('pages/AdminPage.jsx')).toMatch(/<ErrorBoundary key=\{activeTab\}>\{panel\}<\/ErrorBoundary>/);
  });
});
