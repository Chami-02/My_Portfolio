import { ErrorBoundary }   from '../components/common/ErrorBoundary';
import { HeroSection }     from '../components/sections/HeroSection';
import { AboutSection }    from '../components/sections/AboutSection';
import { SkillsSection }   from '../components/sections/SkillsSection';
import { ProjectsSection } from '../components/sections/ProjectsSection';
import { BlogSection }     from '../components/sections/BlogSection';
import { ContactSection }  from '../components/sections/ContactSection';

export function HomePage() {
  return (
    <>
      <HeroSection />
      <ErrorBoundary><AboutSection /></ErrorBoundary>
      <ErrorBoundary><SkillsSection /></ErrorBoundary>
      <ErrorBoundary><ProjectsSection /></ErrorBoundary>
      <ErrorBoundary><BlogSection /></ErrorBoundary>
      <ContactSection />
    </>
  );
}