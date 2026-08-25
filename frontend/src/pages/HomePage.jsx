import { Fragment, useState } from 'react';
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

/**
 * @param {number} replayCount  bumped by the footer's REPLAY INTRO
 *   button (App.jsx owns the state, because <Footer /> is a sibling of
 *   this page, not a child). Starts at 0 and only ever increases.
 */
export function HomePage({ replayCount = 0 }) {
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
  //
  // ⚠️ PF-88 recovers the ability to show a splash later WITHOUT
  // reopening that bug. `replayCount` is the only thing that can turn
  // the splash back on, and it is raised by a click — never re-derived
  // from live matchMedia during render. The lazy initialiser stays
  // exactly as it was.
  const [initialShowSplash] = useState(shouldShowSplash);

  // Pure derivation, no second state. Once the footer has asked for a
  // replay there is always a Splash element in the tree; it is `key`ed
  // below, so each replay mounts a fresh one that runs its sequence and
  // then returns null on its own.
  const showSplash = initialShowSplash || replayCount > 0;

  return (
    /* `resetKey` closes the readiness gate again on every replay — see
       SplashProvider for why that cannot be an effect, and why keying
       this provider instead would regenerate the star field. */
    <SplashProvider initialReady={!showSplash} resetKey={replayCount}>
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

        {/* ⚠️ EVERYTHING REVEAL-BEARING IS INSIDE THIS KEY, AND NOTHING
            ELSE IS.

            Our Reveal sets `revealed` true once and never unsets it, so
            closing the readiness gate on its own leaves an
            already-revealed page revealed: the splash would play over a
            fully-revealed page and lift on a static one. Nothing errors
            and nothing goes red — it just does not do what the button
            says. Remounting is how the prototype's hideReveals() +
            runSplash() pair is reproduced, and it keeps the reset out of
            Reveal itself, which six sections depend on.

            StarfieldCanvas, CursorGlow and GrainOverlay are deliberately
            OUTSIDE it — regenerating every star's position mid-replay is
            a visible flicker behind the splash. So is ScrollToHash:
            remounting it would re-run its jump for the current hash and
            fight the scroll-to-top the button just performed. */}
        <Fragment key={replayCount}>
          {/* Wrapped as of PF-80. Hero used to be bare, and with no
              ErrorBoundary anywhere above it — not in App.jsx, not
              around <App /> in main.jsx — a throw here unmounted the
              entire root: no navbar, no footer, no sections, an empty
              #root. Verified, not assumed. PF-80 gives Hero a
              pointermove handler, a scroll handler and eight
              individually positioned chips, which is enough new surface
              to be worth degrading to a fallback instead. */}
          <ErrorBoundary><HeroSection /></ErrorBoundary>
          <ErrorBoundary><AboutSection /></ErrorBoundary>
          <ErrorBoundary><SkillsSection /></ErrorBoundary>
          <ErrorBoundary><ProjectsSection /></ErrorBoundary>
          <ErrorBoundary><BlogSection /></ErrorBoundary>
          {/* Wrapped as of PF-87. It was the LAST bare section — every
              other one has had a boundary since PF-80/82 — and the
              exposure is the whole root, not just this section: App.jsx
              uses React Router's legacy component API, which has no
              errorElement, and there is no boundary above it in
              main.jsx either. A throw here emptied #root entirely,
              verified by probe during PF-80. Contact now owns a form, a
              submit handler and an API read, which is enough new
              surface to be worth degrading to a fallback instead. */}
          <ErrorBoundary><ContactSection /></ErrorBoundary>
        </Fragment>

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
      {/* Keyed with the sections: Splash self-unmounts through its own
          `mounted` state, so replaying needs a NEW instance, not a
          re-render of the spent one. */}
      {showSplash && <Splash key={replayCount} />}
    </SplashProvider>
  );
}
