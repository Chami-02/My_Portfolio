// PF-145 — the page's words are promises; these are the ones code depends on.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { PrivacyPage } from '../PrivacyPage';
import { MotionProvider } from '../../providers/MotionProvider';
import { ThemeProvider } from '../../providers/ThemeProvider';

const renderPage = () => render(
  <ThemeProvider>
    <MotionProvider>
      <MemoryRouter initialEntries={['/privacy']}>
        <PrivacyPage />
      </MemoryRouter>
    </MotionProvider>
  </ThemeProvider>,
);

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe('PrivacyPage', () => {
  it('has one page heading and every section', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Visitor counts',
      'Telling visitors apart',
      'Cookies',
      'If you message me',
      'Security',
      'Services this site uses',
    ]);
  });

  it('states the promises the counter is built to keep', () => {
    renderPage();
    expect(screen.getByText(/deleted within 2 days/)).toBeInTheDocument();
    expect(screen.getByText(/no cookies for visitors/)).toBeInTheDocument();
    expect(screen.getByText(/Global Privacy Control/)).toBeInTheDocument();
    expect(screen.getByText(/held for up to an hour/)).toBeInTheDocument();
  });

  it('gives the site address only', () => {
    renderPage();
    const mail = screen.getAllByRole('link').filter((l) => l.getAttribute('href').startsWith('mailto:'));
    expect(mail).toHaveLength(2);
    mail.forEach((link) => expect(link).toHaveAttribute('href', 'mailto:pcgallege@gmail.com'));
  });

  it('offers the contact form right after the address on the Questions line', () => {
    renderPage();
    const contact = screen.getByRole('link', { name: 'send a message' });
    expect(contact).toHaveAttribute('href', '/?nosplash=1#contact');
    expect(contact.closest('p')).toHaveTextContent(/^Questions\? Send an email to: pcgallege@gmail\.com · Or send a message/);
    // Its own line (owner, 2026-11-05): `.updated` is display: block.
    expect(screen.getByText('Last updated: November 2026').tagName).toBe('SPAN');
  });

  it('opens at the top when arriving by a link, but keeps the place on Back', () => {
    const app = (
      <ThemeProvider>
        <MotionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Link to="/privacy">go</Link>
            <Routes>
              <Route path="/" element={null} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Routes>
          </MemoryRouter>
        </MotionProvider>
      </ThemeProvider>
    );
    render(app);
    fireEvent.click(screen.getByText('go'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('does not jump when the page is reached by Back or a direct load', () => {
    renderPage();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
