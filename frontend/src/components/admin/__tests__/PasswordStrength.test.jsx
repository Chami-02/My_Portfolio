// frontend/src/components/admin/__tests__/PasswordStrength.test.jsx — PF-124 follow-up
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasswordStrength } from '../PasswordStrength';

const onSteps = (container) => container.querySelectorAll('[data-on]').length;

describe('PasswordStrength', () => {
  it('renders nothing while there is nothing to judge', () => {
    const { container } = render(<PasswordStrength result={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    [0, 'Weak', 1, 'weak'],
    [1, 'Weak', 1, 'weak'],
    [2, 'Fair', 2, 'fair'],
    [3, 'Good', 3, 'fair'],
    [4, 'Strong', 4, 'strong'],
  ])('score %i → "%s", %i of 4 steps, tone %s', (score, label, steps, tone) => {
    const { container } = render(<PasswordStrength result={{ score, problem: null }} />);
    expect(screen.getByText(`Strength: ${label}.`)).toBeInTheDocument();
    expect(onSteps(container)).toBe(steps);
    expect(container.firstChild).toHaveAttribute('data-tone', tone);
  });

  it('says the reason in words, in a polite live region (colour is never the only signal)', () => {
    render(<PasswordStrength result={{ score: 1, problem: 'Add another word.' }} id="s" />);
    const text = document.getElementById('s');
    expect(text).toHaveAttribute('aria-live', 'polite');
    expect(text).toHaveTextContent('Strength: Weak. Add another word.');
  });
});
