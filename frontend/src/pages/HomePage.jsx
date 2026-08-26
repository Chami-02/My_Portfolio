import { useState } from 'react';
import { ErrorBoundary }   from '../components/common/ErrorBoundary';
import { HeroSection }     from '../components/sections/HeroSection';
import { AboutSection }    from '../components/sections/AboutSection';
import { SkillsSection }   from '../components/sections/SkillsSection';
import { ProjectsSection } from '../components/sections/ProjectsSection';
import { BlogSection }     from '../components/sections/BlogSection';
import { ContactSection }  from '../components/sections/ContactSection';
import { SplashProvider }  from '../providers/SplashProvider';
import { ScrollToHash }   from '../components/layout/ScrollToHash';
import { shouldShowSplash } from '../utils/splash';
import { Splash } from '../components/splash';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';

export function HomePage() {
  // Decided once per page load, in one place, and frozen. Two things
  // depend on this answer — whether Splash mounts, and what ready starts
  // at — and they must never disagree.
  //
  // useState's lazy initialiser rather than a bare call, because
  // shouldShowSplash() reads live matchMedia. Re-deriving it every render
  // would let an OS reduced-motion toggle mid-splash unmount Splash
  // in-flight; its cleanup would clear the pending setReady(true), and
  // since initialReady only seeds the state, ready would stay false
  // forever. Every Reveal and CountUp on the page would then simply never
  // reveal — no error, no console warning, just a page of invisible
  // sections. Freezing the value makes that unreachable.
  const [showSplash] = useState(shouldShowSplash);

  return (
    <SplashProvider initialReady={!showSplash}>
      {/* ⚠️ INSIDE SplashProvider, and mounted here rather than in
          App.jsx, deliberately. It reads useSplashReady() to hold the
          jump until the splash lifts, and SplashContext fails open —
          outside the provider the hook returns `true` unconditionally,
          so an App-level mount would compile, render and silently skip
          the gate it exists for.

          Every hash target on this site is a section of this page, so
          there is nothing for it to do on any other route anyway. */}
      <ScrollToHash />

      <PageShell>
        {/* Ambient layer first — DOM order matters. A section that
            establishes its own stacking context sits at the same z-tier
            as a z-index:0 fixed canvas, and CSS breaks that tie by DOM
            order. Canvas first means the sections paint over it. */}
        <StarfieldCanvas />
        <CursorGlow />

        {/* Wrapped as of PF-80. Hero used to be bare, and with no
            ErrorBoundary anywhere above it — not in App.jsx, not around
            <App /> in main.jsx — a throw here unmounted the entire root:
            no navbar, no footer, no sections, an empty #root. Verified,
            not assumed. PF-80 gives Hero a pointermove handler, a scroll
            handler and eight individually positioned chips, which is
            enough new surface to be worth degrading to a fallback
            instead. */}
        <ErrorBoundary><HeroSection /></ErrorBoundary>
        <ErrorBoundary><AboutSection /></ErrorBoundary>
        <ErrorBoundary><SkillsSection /></ErrorBoundary>
        <ErrorBoundary><ProjectsSection /></ErrorBoundary>
        <ErrorBoundary><BlogSection /></ErrorBoundary>
        {/* Wrapped as of PF-87. It was the LAST bare section — every
            other one has had a boundary since PF-80/82 — and the
            exposure is the whole root, not just this section: App.jsx
            uses React Router's legacy component API, which has no
            errorElement, and there is no boundary above it in main.jsx
            either. A throw here emptied #root entirely, verified by
            probe during PF-80. Contact now owns a form, a submit
            handler and an API read, which is enough new surface to be
            worth degrading to a fallback instead. */}
        <ErrorBoundary><ContactSection /></ErrorBoundary>

        {/* Last, matching the prototype. z-index 70 beats page content
            regardless of DOM order, so this is fidelity, not a
            functional requirement — but it costs nothing to match. */}
        <GrainOverlay />
      </PageShell>

      {/* Sibling of PageShell, not a child. position:fixed + z-index 100
          compares against the whole page regardless of nesting depth —
          same reasoning as the ambient layer in PF-75 — and keeping it
          out of the shell means the splash is not inside anything that
          might later establish a stacking context. 100 clears grain's
          70, so the splash covers the grain rather than sitting under
          it, matching the prototype. */}
      {showSplash && <Splash />}
    </SplashProvider>
  );
}
