import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Migrated from `.eslintignore`, which ESLint 9's flat config no longer
  // supports — it was silently inert and printed an `ESLintIgnoreWarning`
  // on every run, including inside every sprint gate. That file is deleted;
  // these are its eight patterns. (`node_modules` is ignored by default;
  // kept explicit so the list still reads as the whole rule.)
  globalIgnores([
    'node_modules/',
    'dist/',
    // CLAUDE.md's live-verification recipe builds to `dist-verify/`
    // (`VITE_API_URL= npx vite build --outDir dist-verify`), so this
    // directory is expected to exist in a working tree mid-session.
    // Without the glob, `eslint .` lints a 410 kB minified bundle and
    // fails on `process is not defined` in someone else's code.
    'dist-*/',
    // Playwright's own output. `reporter: 'html'` writes
    // playwright-report/ on EVERY e2e run and test-results/ on any
    // failure or retry, and both contain minified vendor bundles — so
    // after `npm run test:e2e`, `eslint .` reported 642 errors in
    // someone else's code ('process' is not defined, 'Buffer' is not
    // defined, unnecessary escapes). git already ignores both
    // (frontend/.gitignore:37-38); ESLint did not, which made the
    // sprint gate's own five commands fail whenever the e2e step ran
    // before the lint step. Same shape as dist-*/ above.
    'playwright-report/',
    'test-results/',
    'build/',
    'coverage/',
    '**/*.min.js',
    '.env',
    '.env.local',
    '.env.*.local',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Build/tooling config files run in NODE, not the browser. Without this
  // they inherit globals.browser from the block above and every
  // `process.env` read is a `no-undef` error — which is exactly what
  // happened: vite.config.js:19 has carried one since PF-70 (29567ec) and
  // playwright.config.js gained two in PF-93.
  //
  // ⚠️ Nothing caught either, because `npm run lint` and CI both run
  // `eslint src` — these files sit at the frontend ROOT, outside that
  // path, so the project's own gate cannot reach them. The only thing
  // that surfaced it was the IDE extension linting an open file. Widening
  // the script's scope is the other half of this fix; see package.json.
  {
    files: ['*.config.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
