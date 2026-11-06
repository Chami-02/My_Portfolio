// frontend/src/components/ambient/SeasonalEffects.jsx
import { Component, lazy, Suspense } from 'react';
import { useAbout } from '../../hooks/useAbout';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useSplashReady } from '../../hooks/useSplashReady';
import { activeEffect } from '../../utils/seasonalEffect';

// Its own chunk: a visitor outside a season downloads none of the drawing code.
const SeasonalCanvas = lazy(() => import('./SeasonalCanvas'));

/**
 * Decoration must never cost a page: the shared ErrorBoundary would paint a
 * TRY AGAIN panel over the site if the chunk failed to download. This one
 * paints nothing, and the page simply has no snow.
 */
class SilentBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * PF-151 — decides whether the falling effect shows. Nothing while About loads,
 * so OFF never flashes snow; a FAILED load has `data` undefined and follows the
 * dates. Nothing under reduced motion (a still snowflake means nothing, unlike
 * the star field's resting paint) and nothing until the splash has lifted.
 *
 * The date is read on every render: a tab left open overnight picks the new day
 * up when About refetches on focus.
 */
export default function SeasonalEffects({ strip = false }) {
  const { data: about, isPending } = useAbout();
  const reduced = useReducedMotion();
  const splashReady = useSplashReady();

  if (isPending || reduced || !splashReady) return null;

  const effect = activeEffect(about?.seasonalEffect);
  if (!effect) return null;

  return (
    <SilentBoundary>
      <Suspense fallback={null}>
        <SeasonalCanvas effect={effect} strip={strip} />
      </Suspense>
    </SilentBoundary>
  );
}
