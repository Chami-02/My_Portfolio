import { ErrorBoundary }   from '../components/common/ErrorBoundary';
import { HeroSection }     from '../components/sections/HeroSection';
import { AboutSection }    from '../components/sections/AboutSection';
import { SkillsSection }   from '../components/sections/SkillsSection';
import { ProjectsSection } from '../components/sections/ProjectsSection';
import { BlogSection }     from '../components/sections/BlogSection';
import { ContactSection }  from '../components/sections/ContactSection';
import { SplashProvider }  from '../providers/SplashProvider';
import {
  PageShell,
  StarfieldCanvas,
  CursorGlow,
  GrainOverlay,
} from '../components/ambient';

export function HomePage() {
  return (
    <SplashProvider>
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
    </SplashProvider>
  );
}
