import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import StarfieldCanvas from '../StarfieldCanvas';
import CursorGlow from '../CursorGlow';
import GrainOverlay from '../GrainOverlay';

// One file, not three — three near-identical ref-forwarding wrappers
// don't each need their own file.
//
// These assertions are what catch a bad ref-as-prop migration: React 19
// passes `ref` through as an ordinary prop, so a component that forgets
// to destructure it still renders perfectly and silently hands back a
// null ref — which PF-76/77 would only discover when getContext() throws.
describe('ambient layer slots (PF-75)', () => {

  it('StarfieldCanvas forwards its ref to a real <canvas>', () => {
    const ref = createRef();
    render(<StarfieldCanvas ref={ref} />);
    expect(ref.current?.tagName).toBe('CANVAS');
  });

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

  it('all three carry aria-hidden — none convey information', () => {
    const refs = [createRef(), createRef(), createRef()];
    render(
      <>
        <StarfieldCanvas ref={refs[0]} />
        <CursorGlow ref={refs[1]} />
        <GrainOverlay ref={refs[2]} />
      </>,
    );
    refs.forEach((ref) => expect(ref.current).toHaveAttribute('aria-hidden', 'true'));
  });

});
