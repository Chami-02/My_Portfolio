// PF-143 — /certificates: the picture grid, the tag pills, and the big
// view driven by the URL (shareable, Back/Esc closes, ← → step).
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MotionProvider } from '../../providers/MotionProvider';
import { ThemeProvider } from '../../providers/ThemeProvider';

const data = vi.hoisted(() => ({ query: null }));
vi.mock('../../hooks/useEntries', () => ({ useCertificates: () => data.query }));

const { CertificatesPage } = await import('../CertificatesPage');

const CERTS = [
  { _id: 'a', slug: 'cloud-oracle', title: 'Cloud Foundations', issuer: 'Oracle', issued: '2025-06',
    credentialId: 'ABC-123', verifyUrl: 'https://verify.example/a', image: { url: 'https://cdn.test/a.jpg' },
    description: 'Core OCI services.\nTaken in one sitting.', tags: ['Cloud'] },
  { _id: 'b', slug: 'python-datacamp', title: 'Python', issuer: 'DataCamp', issued: '2025-03',
    image: { url: 'https://cdn.test/b.jpg' }, tags: ['Python'] },
  { _id: 'c', slug: 'sql-datacamp', title: 'SQL', issuer: 'DataCamp', issued: '2024', image: { url: '' }, tags: ['Data'] },
];

const renderAt = (entries) => {
  const router = createMemoryRouter(
    [{ path: '/certificates/:slug?', element: <ThemeProvider><MotionProvider><CertificatesPage /></MotionProvider></ThemeProvider> }],
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
  it('sits on the site\'s starfield, like /blog (owner, 2026-11-02)', () => {
    renderAt(['/certificates']);
    expect(document.querySelector('canvas[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows every certificate as a picture card with VIEW, title and issuer', () => {
    renderAt(['/certificates']);
    expect(screen.getByRole('heading', { level: 1, name: 'Certificates' })).toBeInTheDocument();
    expect(screen.getByText('3 CERTIFICATES')).toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('VIEW')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Oracle · JUN 2025')).toBeInTheDocument();
    expect(cards[0].querySelector('img')).toHaveAttribute('src', 'https://cdn.test/a.jpg');
    // No picture → the issuer stands in, never a broken image.
    expect(cards[2].querySelector('img')).toBeNull();
  });

  // PF-154: while the list loads, three card-shaped placeholders hold the
  // grid's space (Lighthouse layout shift 0.93 → 0.07, measured), hidden from
  // screen readers, and never the "no certificates" message.
  it('holds the grid with three hidden placeholder cards while loading', () => {
    data.query = { data: undefined, isLoading: true, isError: false };
    renderAt(['/certificates']);
    const grid = document.querySelector('ul[aria-hidden="true"]');
    expect(grid).not.toBeNull();
    expect(grid.querySelectorAll('li')).toHaveLength(3);
    expect(grid.querySelector('li [class*="frame"]')).not.toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText('No certificates to show yet.')).toBeNull();
  });

  // Owner, 2026-11-02: a pill row by TAG (no search), replacing the issuer
  // filter. ONE pill at a time — a certificate has exactly one tag.
  it('a pill shows only its certificates; another pill switches; the picked one again shows all', async () => {
    const router = renderAt(['/certificates']);
    const row = screen.getByRole('group', { name: 'Filter by tag' });
    expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(['ALL', 'Cloud', 'Data', 'Python']);
    expect(within(row).getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(row).getByRole('button', { name: 'Data' }));
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('a').textContent)).toEqual([expect.stringContaining('SQL')]);
    expect(router.state.location.search).toBe('?tag=Data');
    expect(screen.getByText('1 OF 3 CERTIFICATES')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Data' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(row).getByRole('button', { name: 'Python' }));   // switches — never both
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('a').textContent)).toEqual([expect.stringContaining('Python')]);
    expect(router.state.location.search).toBe('?tag=Python');
    expect(within(row).getByRole('button', { name: 'Data' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(within(row).getByRole('button', { name: 'Python' }));   // the picked one again
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(router.state.location.search).toBe('');
  });

  it('a tap on the page BACKGROUND shows them all — a tap on a pill or card never does', async () => {
    const router = renderAt(['/certificates?tag=Cloud']);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    await userEvent.click(screen.getByText(/Courses and exams I have passed/));   // plain text = background
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(router.state.location.search).toBe('');

    await userEvent.click(within(screen.getByRole('group', { name: 'Filter by tag' })).getByRole('button', { name: 'Cloud' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);   // the pill itself is not "background"
  });

  // Owner, 2026-11-02: a small pin, top-right, on pinned cards only; the
  // order is the server's (pinned, then newest) and filtering keeps it.
  it('a pinned card shows a small pin; the grid keeps the server\'s order', async () => {
    data.query = { data: [{ ...CERTS[1], pinned: true }, CERTS[0], CERTS[2]], isLoading: false, isError: false };
    renderAt(['/certificates']);
    const cards = screen.getAllByRole('listitem');
    expect(within(cards[0]).getByRole('img', { name: 'Pinned' })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('img', { name: 'Pinned' })).not.toBeInTheDocument();
    expect(cards.map((li) => li.querySelector('a').textContent)).toEqual(
      [expect.stringContaining('Python'), expect.stringContaining('Cloud Foundations'), expect.stringContaining('SQL')],
    );
    await userEvent.click(within(screen.getByRole('group', { name: 'Filter by tag' })).getByRole('button', { name: 'Python' }));
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('a').textContent)).toEqual(
      [expect.stringContaining('Python')],
    );
  });

  it('a hand-typed ?tag= matches whatever its case; tags are never printed on a card', () => {
    renderAt(['/certificates?tag=cloud']);
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).queryByText('Cloud')).not.toBeInTheDocument();   // owner, 2026-11-02
    expect(screen.queryByRole('button', { name: 'Oracle' })).not.toBeInTheDocument();   // no issuer filter
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

  it('shows the owner\'s description under the details — and nothing when there is none (owner, 2026-11-02)', async () => {
    renderAt(['/certificates/cloud-oracle']);
    const dialog = screen.getByRole('dialog', { name: 'Cloud Foundations' });
    const text = within(dialog).getByText(/Core OCI services/);
    expect(text.textContent).toBe('Core OCI services.\nTaken in one sitting.');
    // Under the details: after the issuer line in the document.
    const meta = within(dialog).getByText('Oracle · ISSUED JUN 2025');
    expect(meta.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(dialog).queryByText('Cloud')).not.toBeInTheDocument();   // tags stay behind the scenes
    await userEvent.keyboard('{ArrowRight}');
    expect(within(screen.getByRole('dialog', { name: 'Python' })).queryByText(/Core OCI/)).not.toBeInTheDocument();
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
