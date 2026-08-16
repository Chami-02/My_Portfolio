import { useState } from 'react';
import { ErrorBoundary }   from '../components/common/ErrorBoundary';
import { HeroSection }     from '../components/sections/HeroSection';
import { AboutSection }    from '../components/sections/AboutSection';
import { SkillsSection }   from '../components/sections/SkillsSection';
import { ProjectsSection } from '../components/sections/ProjectsSection';
import { BlogSection }     from '../components/sections/BlogSection';
import { ContactSection }  from '../components/sections/ContactSection';
import { SplashProvider }  from '../providers/SplashProvider';
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
      <PageShell>
        {/* Ambient layer first — DOM order matters. A section that
            establishes its own stacking context sits at the same z-tier
            as a z-index:0 fixed canvas, and CSS breaks that tie by DOM
            order. Canvas first means the sections paint over it. */}
        <StarfieldCanvas />
        <CursorGlow />

        <HeroSection />
        <ErrorBoundary><AboutSection /></ErrorBoundary>
        <ErrorBoundary><SkillsSection /></ErrorBoundary>
        <ErrorBoundary><ProjectsSection /></ErrorBoundary>
        <ErrorBoundary><BlogSection /></ErrorBoundary>
        <ContactSection />

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
