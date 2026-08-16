import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import CursorGlow from '../CursorGlow';
import GrainOverlay from '../GrainOverlay';

// One file, not two — near-identical ref-forwarding wrappers don't each
// need their own file.
//
// These assertions are what catch a bad ref-as-prop migration: React 19
// passes `ref` through as an ordinary prop, so a component that forgets
// to destructure it still renders perfectly and silently hands back a
// null ref — which PF-77 would only discover when it tried to move the
// glow element and nothing happened.
//
// StarfieldCanvas moved out to its own file in PF-76: it now calls
// useTheme() and useReducedMotion(), both of which throw outside their
// providers, so it can no longer be rendered bare the way these two can.
describe('ambient layer slots (PF-75)', () => {

  it('CursorGlow forwards its ref to a real <div>', () => {
    const ref = createRef();
    render(<CursorGlow ref={ref} />);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('GrainOverlay forwards its ref to a real <div>', () => {
    const ref = createRef();
    render(<GrainOverlay ref={ref} />);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('both carry aria-hidden — neither conveys information', () => {
    const refs = [createRef(), createRef()];
    render(
      <>
        <CursorGlow ref={refs[0]} />
        <GrainOverlay ref={refs[1]} />
      </>,
    );
    refs.forEach((ref) => expect(ref.current).toHaveAttribute('aria-hidden', 'true'));
  });

});
