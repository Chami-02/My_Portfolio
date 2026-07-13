import { describe, it, expect } from 'vitest';
import { render, screen }       from '@testing-library/react';
import { Footer }               from '../Footer';

describe('Footer', () => {
  it('renders the current year', () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    // The footer displays "© 2025 Parindra Chameekara" — year must be present
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it('renders a GitHub external link', () => {
    render(<Footer />);
    const githubLink = screen.getByRole('link', { name: /github/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', expect.stringContaining('github'));
  });

  it('renders the developer credit line', () => {
    render(<Footer />);
    expect(screen.getByText(/Parindra Chameekara/i)).toBeInTheDocument();
  });

  it('has a "Built with" tech stack mention', () => {
    render(<Footer />);
    expect(screen.getByText(/React/i)).toBeInTheDocument();
  });
});