import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageShell from '../PageShell';

describe('PageShell (PF-75)', () => {

  it('renders its children', () => {
    render(<PageShell><p>content</p></PageShell>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

});
