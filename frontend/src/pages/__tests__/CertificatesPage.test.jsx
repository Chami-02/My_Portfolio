// PF-143 — /certificates: the picture grid, the issuer filter, and the big
// view driven by the URL (shareable, Back/Esc closes, ← → step).
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionProvider } from '../../providers/MotionProvider';

const data = vi.hoisted(() => ({ query: null }));
vi.mock('../../hooks/useAbout', () => ({ useAbout: () => ({ data: undefined }) }));
vi.mock('../../hooks/useEntries', () => ({ useCertificates: () => data.query }));

const { CertificatesPage } = await import('../CertificatesPage');

const CERTS = [
  { _id: 'a', slug: 'cloud-oracle', title: 'Cloud Foundations', issuer: 'Oracle', issued: '2025-06',
    credentialId: 'ABC-123', verifyUrl: 'https://verify.example/a', image: { url: 'https://cdn.test/a.jpg' } },
  { _id: 'b', slug: 'python-datacamp', title: 'Python', issuer: 'DataCamp', issued: '2025-03',
    image: { url: 'https://cdn.test/b.jpg' } },
  { _id: 'c', slug: 'sql-datacamp', title: 'SQL', issuer: 'DataCamp', issued: '2024', image: { url: '' } },
];

const renderAt = (entries) => {
  const router = createMemoryRouter(
    [{ path: '/certificates/:slug?', element: <MotionProvider><CertificatesPage /></MotionProvider> }],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => {
  data.query = { data: CERTS, isLoading: false, isError: false };
  window.scrollTo = vi.fn();
});

describe('the grid', () => {
  it('shows every certificate as a picture card with VIEW CERTIFICATE, title and issuer', () => {
    renderAt(['/certificates']);
    expect(screen.getByRole('heading', { level: 1, name: 'Certificates' })).toBeInTheDocument();
    expect(screen.getByText('3 CERTIFICATES')).toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('VIEW CERTIFICATE')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Oracle · JUN 2025')).toBeInTheDocument();
    expect(cards[0].querySelector('img')).toHaveAttribute('src', 'https://cdn.test/a.jpg');
    // No picture → the issuer stands in, never a broken image.
    expect(cards[2].querySelector('img')).toBeNull();
  });

  it('filters by issuer through the URL', async () => {
    const router = renderAt(['/certificates']);
    await userEvent.click(screen.getByRole('button', { name: 'DataCamp' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(router.state.location.search).toBe('?issuer=DataCamp');
    expect(screen.getByRole('button', { name: 'DataCamp' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a failed load says so and offers TRY AGAIN — never "no certificates"', async () => {
    const refetch = vi.fn();
    data.query = { data: undefined, isLoading: false, isError: true, refetch };
    renderAt(['/certificates']);
    expect(screen.queryByText(/No certificates/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'TRY AGAIN' }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('the big view', () => {
  it('a shared link opens it straight away: picture, details, VERIFY, "1 / 3"', () => {
    renderAt(['/certificates/cloud-oracle']);
    const dialog = screen.getByRole('dialog', { name: 'Cloud Foundations' });
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://cdn.test/a.jpg');
    expect(within(dialog).getByText('Oracle · ISSUED JUN 2025')).toBeInTheDocument();
    expect(within(dialog).getByText('ABC-123')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /VERIFY Cloud Foundations/ }))
      .toHaveAttribute('href', 'https://verify.example/a');
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('opening from the grid, then Esc, goes BACK — no dead history entry', async () => {
    const router = renderAt(['/certificates']);
    await userEvent.click(screen.getByRole('link', { name: /Python/ }));
    expect(router.state.location.pathname).toBe('/certificates/python-datacamp');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(router.state.location.pathname).toBe('/certificates');
    expect(router.state.historyAction).toBe('POP');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a direct visit closes by REPLACING with the grid, so Back does not reopen it', async () => {
    const router = renderAt(['/elsewhere', '/certificates/cloud-oracle']);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(router.state.location.pathname).toBe('/certificates');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('← → step through (replacing, so Back still closes), and stop at the ends', () => {
    const router = renderAt(['/certificates/cloud-oracle']);
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(router.state.location.pathname).toBe('/certificates/cloud-oracle');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(router.state.location.pathname).toBe('/certificates/python-datacamp');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('a click on the backdrop closes; a click inside the panel does not', async () => {
    renderAt(['/certificates/cloud-oracle']);
    await userEvent.click(screen.getByText('ABC-123'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('an unknown slug keeps the URL and says not found', () => {
    renderAt(['/certificates/nope']);
    expect(screen.getByRole('dialog', { name: 'Certificate not found' })).toBeInTheDocument();
  });

  it('stops the page behind from scrolling while open, and gives it back on close', async () => {
    renderAt(['/certificates/cloud-oracle']);
    expect(document.documentElement.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.documentElement.style.overflow).toBe('');
  });
});
