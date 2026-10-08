// frontend/src/components/admin/panels/__tests__/AdminMessagesPanel.test.jsx
//
// 2026-09-16 — the unread marker's contract (green, top-right, global glowdot
// carrier with longhand timing, header row padded clear of it).
// PF-115 — the Phase 2 card, DELETE behind a confirm, the owner's STAR, SEARCH
// and ALL · UNREAD · STARRED filters (2026-10-07).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const markRead  = vi.hoisted(() => ({ mutate: vi.fn() }));
const star      = vi.hoisted(() => ({ mutate: vi.fn() }));
const deleteMsg = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const useMessages = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useMessages', () => ({
  useMessages,
  useMarkMessageRead: () => markRead,
  useStarMessage:     () => star,
  useDeleteMessage:   () => deleteMsg,
}));

const { AdminMessagesPanel } = await import('../AdminMessagesPanel');

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(here, '../AdminMessagesPanel.module.css'), 'utf8');

const MESSAGES = Object.freeze([
  Object.freeze({ _id: 'm1', name: 'Unread Sender', email: 'u@example.com', message: 'Hello there, about the Docker internship.', read: false, starred: false, createdAt: '2026-09-16T10:00:00Z' }),
  Object.freeze({ _id: 'm2', name: 'Read Sender',   email: 'r@example.com', message: 'Already seen. Docker question.',             read: true,  starred: true,  createdAt: '2026-09-15T10:00:00Z' }),
  Object.freeze({ _id: 'm3', name: 'Third Person',  email: 't@corp.com',    message: 'An internship enquiry.',                    read: true,  starred: false, createdAt: '2026-09-14T10:00:00Z' }),
]);

beforeEach(() => {
  vi.clearAllMocks();
  deleteMsg.mutateAsync.mockResolvedValue({});
  useMessages.mockReturnValue({ data: MESSAGES, isLoading: false });
});

const cardOf  = (name) => screen.getByText(name).closest('[data-message-card]');
const names   = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('[class*="name"]').textContent);
const search  = (user, text) => user.type(screen.getByRole('textbox', { name: 'Search messages' }), text);
const filter  = (label) => screen.getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
const dialog  = () => within(screen.getByRole('dialog'));

describe('unread marker (2026-09-16, carried over)', () => {
  it('renders the dot on an unread message and not on a read one', () => {
    render(<AdminMessagesPanel />);
    expect(cardOf('Unread Sender').querySelector('[data-unread-dot]')).not.toBeNull();
    expect(cardOf('Read Sender').querySelector('[data-unread-dot]')).toBeNull();
  });

  it('is green, top-right, on the global glowdot carrier with longhand timing', () => {
    render(<AdminMessagesPanel />);
    const dot = cardOf('Unread Sender').querySelector('[data-unread-dot]');
    expect(dot.style.background).toBe('var(--ok)');
    expect(dot.style.top).toBe('17px');
    expect(dot.style.right).toBe('17px');
    expect(dot.classList.contains('kf-glowdot')).toBe(true);
    // Longhands. The `animation` shorthand would reset animation-name and
    // silently undo the carrier class.
    expect(dot.style.animationDuration).toBe('2.4s');
    expect(dot.style.animationIterationCount).toBe('infinite');
    expect(dot.style.animationName).toBe('');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
  });

  // Moved from an inline-style read to the stylesheet in PF-115. Parsed, not
  // regex-matched — the comment above the rule names the same value.
  it('pads the header row so the date clears the dot', () => {
    const decls = {};
    postcss.parse(CSS).walkRules('.head', (r) => r.walkDecls((d) => { decls[d.prop] = d.value; }));
    expect(decls['padding-right']).toBe('20px');
  });

  it('keeps the unread border GREEN, winning over the starred tint', () => {
    const order = [];
    postcss.parse(CSS).walkRules((r) => {
      if (r.selector === '.cardStarred' || r.selector === '.cardUnread') order.push(r.selector);
      if (r.selector === '.cardUnread') {
        r.walkDecls('border-color', (d) => expect(d.value).toBe('rgba(52, 211, 153, .35)'));
      }
    });
    // Equal specificity, so emission order decides: unread must come LAST.
    expect(order).toEqual(['.cardStarred', '.cardUnread']);
  });

  it('uses no Phase 1 indigo or --accent on the card', () => {
    render(<AdminMessagesPanel />);
    const card = cardOf('Unread Sender');
    expect(card.outerHTML).not.toMatch(/129,\s*140,\s*248|--accent\b/);
  });
});

describe('the card (Admin.dc.html:538-568)', () => {
  it('shows MARK READ only on an unread message, and REPLY as a mailto', () => {
    render(<AdminMessagesPanel />);
    expect(within(cardOf('Unread Sender')).getByRole('button', { name: '✓ MARK READ' })).toBeInTheDocument();
    expect(within(cardOf('Read Sender')).queryByRole('button', { name: '✓ MARK READ' })).toBeNull();
    expect(within(cardOf('Read Sender')).getByRole('link', { name: '✉ REPLY' }))
      .toHaveAttribute('href', 'mailto:r@example.com?subject=Re: Your Portfolio Message');
  });

  it('shows the prototype empty state when there are no messages', () => {
    useMessages.mockReturnValue({ data: [], isLoading: false });
    render(<AdminMessagesPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'No messages yet. Once recruiters fill out the contact form, they will appear here.');
  });

  it('surfaces a failed MARK READ instead of failing silently', async () => {
    markRead.mutate.mockImplementation((_id, { onError }) =>
      onError({ response: { data: { message: 'Message not found' } } }));
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: '✓ MARK READ' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Message not found');
  });

  it('says plainly when no server answered', async () => {
    markRead.mutate.mockImplementation((_id, { onError }) => onError(new Error('Network Error')));
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: '✓ MARK READ' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot reach the server/);
  });
});

describe('DELETE asks first (PF-115)', () => {
  it('opens the confirm and deletes NOTHING until YES', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: 'Delete message from Read Sender' }));
    expect(deleteMsg.mutateAsync).not.toHaveBeenCalled();
    expect(dialog().getByText('This will permanently delete the message from Read Sender.')).toBeInTheDocument();
    // Focus starts on CANCEL — an Enter pressed by reflex deletes nothing.
    expect(dialog().getByRole('button', { name: 'CANCEL' })).toHaveFocus();

    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));
    expect(deleteMsg.mutateAsync).toHaveBeenCalledWith('m2');
  });

  it('CANCEL deletes nothing', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: 'Delete message from Read Sender' }));
    await user.click(dialog().getByRole('button', { name: 'CANCEL' }));

    expect(deleteMsg.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('surfaces a failed delete', async () => {
    deleteMsg.mutateAsync.mockRejectedValue({ response: { data: { message: 'Message not found' } } });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: 'Delete message from Read Sender' }));
    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Message not found');
  });
});

describe('the STAR (owner, 2026-10-07)', () => {
  it('reflects the stored state through aria-pressed and the glyph', () => {
    render(<AdminMessagesPanel />);
    const on  = screen.getByRole('button', { name: 'Star message from Read Sender' });
    const off = screen.getByRole('button', { name: 'Star message from Unread Sender' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    expect(on).toHaveTextContent('★');
    expect(off).toHaveAttribute('aria-pressed', 'false');
    expect(off).toHaveTextContent('☆');
  });

  it('sends the OPPOSITE of the stored state, as an explicit value', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: 'Star message from Unread Sender' }));
    expect(star.mutate).toHaveBeenLastCalledWith({ id: 'm1', starred: true }, expect.any(Object));

    await user.click(screen.getByRole('button', { name: 'Star message from Read Sender' }));
    expect(star.mutate).toHaveBeenLastCalledWith({ id: 'm2', starred: false }, expect.any(Object));
  });

  it('surfaces a failed star', async () => {
    star.mutate.mockImplementation((_vars, { onError }) =>
      onError({ response: { data: { message: 'Message not found' } } }));
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: 'Star message from Unread Sender' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Message not found');
  });
});

describe('ALL · UNREAD · STARRED', () => {
  it('counts each filter and starts on ALL', () => {
    render(<AdminMessagesPanel />);
    expect(filter('ALL')).toHaveAttribute('aria-pressed', 'true');
    expect(filter('ALL')).toHaveTextContent('ALL 3');
    expect(filter('UNREAD')).toHaveTextContent('UNREAD 1');
    expect(filter('STARRED')).toHaveTextContent('STARRED 1');
  });

  it('STARRED shows only starred messages — which ALSO stay in ALL', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(filter('STARRED'));
    expect(names()).toEqual(['Read Sender']);

    await user.click(filter('ALL'));
    expect(names()).toEqual(['Unread Sender', 'Read Sender', 'Third Person']);
  });

  it('UNREAD shows only unread messages', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(filter('UNREAD'));
    expect(names()).toEqual(['Unread Sender']);
  });

  it('says how to star when STARRED is empty', async () => {
    useMessages.mockReturnValue({ data: MESSAGES.map((m) => ({ ...m, starred: false })), isLoading: false });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(filter('STARRED'));
    expect(screen.getByRole('status')).toHaveTextContent('No starred messages. Press ☆ on a message to keep it here.');
  });
});

describe('SEARCH (owner, 2026-10-07)', () => {
  it('filters as you type, ANDing the words', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await search(user, 'internship');
    expect(names()).toEqual(['Unread Sender', 'Third Person']);

    // Read Sender has "Docker" but not "internship"; Third Person the reverse.
    await search(user, ' docker');
    expect(names()).toEqual(['Unread Sender']);
  });

  it('highlights the hits inside the message text, as text', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await search(user, 'dock');
    const hits = [...cardOf('Read Sender').querySelectorAll('mark')].map((m) => m.textContent);
    expect(hits).toEqual(['Dock']);
  });

  it('searches the email too', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await search(user, 'corp.com');
    expect(names()).toEqual(['Third Person']);
  });

  it('combines with the filter — a starred message that does not match is hidden', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(filter('STARRED'));
    await search(user, 'internship');

    expect(names()).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('No messages match “internship” in STARRED.');
    // The counts are the filter totals, unmoved by the search.
    expect(filter('STARRED')).toHaveTextContent('STARRED 1');
  });

  // The ZERO case — every positive assertion passes under a match-everything.
  it('names the term when nothing matches', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await search(user, 'kubernetes');
    expect(names()).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('No messages match “kubernetes”.');
  });

  it('× clears the search and brings everything back', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await search(user, 'kubernetes');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByRole('textbox', { name: 'Search messages' })).toHaveValue('');
    expect(names()).toHaveLength(3);
  });

  it('renders a message carrying markup as plain text', async () => {
    useMessages.mockReturnValue({
      data: [{ ...MESSAGES[0], message: 'Hi <b>bold</b> <img src=x onerror=alert(1)>' }],
      isLoading: false,
    });
    const user = userEvent.setup();
    const { container } = render(<AdminMessagesPanel />);
    await search(user, 'bold');

    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(cardOf('Unread Sender').textContent).toContain('<b>bold</b>');
  });
});
