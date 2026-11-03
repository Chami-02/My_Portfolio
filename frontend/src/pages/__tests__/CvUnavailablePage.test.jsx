// PF-144 — the site's own "CV not available" page (owner, 2026-11-03).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { MotionProvider } from '../../providers/MotionProvider';
import { CvUnavailablePage } from '../CvUnavailablePage';
import { CV_HREF } from '../../utils/resume';

const draw = (search) => render(
  <MemoryRouter initialEntries={[`/cv-unavailable${search}`]}>
    <ThemeProvider><MotionProvider><CvUnavailablePage /></MotionProvider></ThemeProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })));
});

describe('CvUnavailablePage', () => {
  it('no CV yet: says so plainly and points to the contact form — no retry', () => {
    draw('?reason=missing');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CV not available yet');
    expect(screen.getByText(/There’s no CV to download just yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GET IN TOUCH →' })).toHaveAttribute('href', '/?nosplash=1#contact');
    expect(screen.queryByRole('link', { name: /TRY AGAIN/ })).toBeNull();
  });

  it('could not be fetched this time: offers TRY AGAIN (the CV link) and the contact form', () => {
    draw('?reason=later');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The CV couldn’t be downloaded');
    expect(screen.getByRole('link', { name: 'TRY AGAIN ↓' })).toHaveAttribute('href', CV_HREF);
    expect(screen.getByRole('link', { name: 'GET IN TOUCH →' })).toBeInTheDocument();
  });
});
