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
import { render as rtlRender, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const markRead  = vi.hoisted(() => ({ mutate: vi.fn() }));
const star      = vi.hoisted(() => ({ mutate: vi.fn() }));
const deleteMsg = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const bulk      = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const replyMsg  = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const useMessages = vi.hoisted(() => vi.fn());
// PF-154: SENT's hooks, quiet here — SentRepliesPanel.test.jsx covers SENT.
const useSentReplies = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useMessages', () => ({
  useMessages,
  useSentReplies,
  useDeleteSentReply:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSentReplies: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkMessageRead: () => markRead,
  useStarMessage:     () => star,
  useDeleteMessage:   () => deleteMsg,
  useBulkMessages:    () => bulk,
  useReplyToMessage:  () => replyMsg,
}));

// PF-123: the card's time zone is the About panel's.
const useAbout = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useAbout', () => ({ useAbout }));

const { AdminMessagesPanel } = await import('../AdminMessagesPanel');

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(here, '../AdminMessagesPanel.module.css'), 'utf8');

/** The address beside the panel: the big view lives in it. */
function Where() {
  const { search } = useLocation();
  return <span data-testid="where">{search}</span>;
}

const render = (ui, { at = '/admin' } = {}) => rtlRender(
  <MemoryRouter initialEntries={[at]}>{ui}<Where /></MemoryRouter>,
);

const MESSAGES = Object.freeze([
  Object.freeze({ _id: 'm1', name: 'Unread Sender', email: 'u@example.com', message: 'Hello there, about the Docker internship.', read: false, starred: false, createdAt: '2026-09-16T10:00:00Z' }),
  Object.freeze({ _id: 'm2', name: 'Read Sender',   email: 'r@example.com', message: 'Already seen. Docker question.',             read: true,  starred: true,  createdAt: '2026-09-15T10:00:00Z' }),
  Object.freeze({ _id: 'm3', name: 'Third Person',  email: 't@corp.com',    message: 'An internship enquiry.',                    read: true,  starred: false, createdAt: '2026-09-14T10:00:00Z' }),
]);

beforeEach(() => {
  vi.clearAllMocks();
  deleteMsg.mutateAsync.mockResolvedValue({});
  bulk.mutateAsync.mockResolvedValue(undefined);
  useMessages.mockReturnValue({ data: MESSAGES, isLoading: false });
  useSentReplies.mockReturnValue({ data: [], isLoading: false });
  useAbout.mockReturnValue({ data: undefined });
});

const cardOf  = (name) => screen.getByText(name).closest('[data-message-card]');
const names   = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('[class*="name"]').textContent);
const search  = (user, text) => user.type(screen.getByRole('textbox', { name: 'Search messages' }), text);
const filter  = (label) => screen.getByRole('button', { name: new RegExp(`^${label} \\d+$`) });
// The LAST dialog: the delete confirm sits on top of the big view.
const dialog  = () => within(screen.getAllByRole('dialog').at(-1));
const openView = (user, name) => user.click(screen.getByRole('button', { name: `Open message from ${name}` }));
const view = () => within(screen.getByRole('dialog'));
const where = () => screen.getByTestId('where').textContent;
const tick = (name) => screen.getByRole('checkbox', { name: `Select message from ${name}` });
const selectAll = () => screen.getByRole('checkbox', { name: 'SELECT ALL' });

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

describe('PF-154 — the dot and SENT in the inbox', () => {
  it('the dot is 7px in this panel, on the card and in the big view', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    const dot = cardOf('Unread Sender').querySelector('[data-unread-dot]');
    expect([dot.style.width, dot.style.height]).toEqual(['7px', '7px']);
    await openView(user, 'Unread Sender');
    const big = screen.getByRole('dialog').querySelector('[data-unread-dot]');
    expect([big.style.width, big.style.height]).toEqual(['7px', '7px']);
  });

  it('the delete confirm says replies stay in SENT — only when there are some', async () => {
    useMessages.mockReturnValue({
      data: [{ ...MESSAGES[1], replies: [{ _id: 'r1', message: 'Hi', sentAt: '2026-09-16T00:00:00Z' }] }, MESSAGES[2]],
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openView(user, 'Read Sender');
    await user.click(view().getByRole('button', { name: 'Delete message from Read Sender' }));
    expect(dialog().getByText(/Your replies stay in SENT\./)).toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: /cancel/i }));
    await user.keyboard('{Escape}');
    await openView(user, 'Third Person');
    await user.click(view().getByRole('button', { name: 'Delete message from Third Person' }));
    expect(dialog().queryByText(/stay in SENT/)).toBeNull();
  });
});

describe('the card is short (PF-153)', () => {
  it('holds no REPLY, MARK READ or DELETE: those live in the big view', () => {
    render(<AdminMessagesPanel />);
    const card = within(cardOf('Unread Sender'));
    expect(card.queryByRole('link', { name: '✉ REPLY' })).toBeNull();
    expect(card.queryByRole('button', { name: '✓ MARK READ' })).toBeNull();
    expect(card.queryByRole('button', { name: /^Delete/ })).toBeNull();
    expect(card.getByRole('button', { name: 'Open message from Unread Sender' })).toBeInTheDocument();
  });

  it('shows at most three lines of the message, whatever its length', () => {
    const decls = {};
    postcss.parse(CSS).walkRules('.previewText', (r) => r.walkDecls((d) => { decls[d.prop] = d.value; }));
    expect(decls['-webkit-line-clamp']).toBe('3');
    expect(decls.overflow).toBe('hidden');
    expect(decls['min-height']).toBe('calc(14px * 1.75 * 3)');
    expect(decls['overflow-wrap']).toBe('anywhere');
  });

  it('shows the prototype empty state when there are no messages', () => {
    useMessages.mockReturnValue({ data: [], isLoading: false });
    render(<AdminMessagesPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'No messages yet. Once recruiters fill out the contact form, they will appear here.');
    expect(screen.queryByRole('checkbox', { name: 'SELECT ALL' })).toBeNull();
  });

  it('tags a message whose email never went out, on the card and in the view', async () => {
    useMessages.mockReturnValue({
      data: [{ ...MESSAGES[0], createdAt: '2026-11-01T10:00:00Z', notifiedAt: null }],
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    expect(within(cardOf('Unread Sender')).getByText('EMAIL NOT SENT')).toBeInTheDocument();
    await openView(user, 'Unread Sender');
    expect(view().getByText('EMAIL NOT SENT')).toBeInTheDocument();
  });

  it('does not tag a message that was emailed, or one from before email existed', () => {
    useMessages.mockReturnValue({
      data: [
        { ...MESSAGES[0], createdAt: '2026-11-01T10:00:00Z', notifiedAt: '2026-11-01T10:00:05Z' },
        { ...MESSAGES[1], createdAt: '2026-09-01T10:00:00Z', notifiedAt: null },
      ],
      isLoading: false,
    });
    render(<AdminMessagesPanel />);
    expect(screen.queryByText('EMAIL NOT SENT')).toBeNull();
  });
});

describe('the big view (PF-153)', () => {
  it('opens from OPEN and from the message text, with the whole message in it', async () => {
    const long = 'A long message. '.repeat(60).trim();
    useMessages.mockReturnValue({ data: [{ ...MESSAGES[0], message: long }, MESSAGES[1]], isLoading: false });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(screen.getByRole('button', { name: 'Read the message from Unread Sender' }));
    expect(view().getByRole('heading', { name: 'Unread Sender' })).toBeInTheDocument();
    expect(view().getByText(long)).toBeInTheDocument();
    expect(where()).toBe('?message=m1');
  });

  it('shows MARK READ on an unread message, MARK UNREAD on a read one, and REPLY as a mailto', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await openView(user, 'Unread Sender');
    expect(view().getByRole('button', { name: '✓ MARK READ' })).toBeInTheDocument();
    expect(view().queryByRole('button', { name: '↺ MARK UNREAD' })).toBeNull();
    await user.keyboard('{Escape}');

    await openView(user, 'Read Sender');
    expect(view().queryByRole('button', { name: '✓ MARK READ' })).toBeNull();
    expect(view().getByRole('button', { name: '↺ MARK UNREAD' })).toBeInTheDocument();
    expect(view().getByRole('button', { name: '✉ REPLY' })).toBeInTheDocument();
  });

  it('opening a message does not mark it read: MARK READ is the owner\'s "handled"', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openView(user, 'Unread Sender');
    expect(markRead.mutate).not.toHaveBeenCalled();
    expect(view().getByText('Please reply within 24 hours!!')).toBeInTheDocument();
  });

  it('sends an explicit value each way — never a flip', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await openView(user, 'Unread Sender');
    await user.click(view().getByRole('button', { name: '✓ MARK READ' }));
    await user.keyboard('{Escape}');
    await openView(user, 'Read Sender');
    await user.click(view().getByRole('button', { name: '↺ MARK UNREAD' }));

    expect(markRead.mutate.mock.calls.map(([arg]) => arg)).toEqual([
      { id: 'm1', read: true },
      { id: 'm2', read: false },
    ]);
  });

  it('surfaces a failed MARK READ and MARK UNREAD', async () => {
    markRead.mutate.mockImplementation((_arg, { onError }) =>
      onError({ response: { data: { message: 'Message not found' } } }));
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await openView(user, 'Read Sender');
    await user.click(view().getByRole('button', { name: '↺ MARK UNREAD' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Message not found');
  });

  it('says plainly when no server answered', async () => {
    markRead.mutate.mockImplementation((_id, { onError }) => onError(new Error('Network Error')));
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await openView(user, 'Unread Sender');
    await user.click(view().getByRole('button', { name: '✓ MARK READ' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/We can't connect right now/);
  });

  it('steps through the messages on screen, with no way past either end', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await openView(user, 'Unread Sender');
    expect(view().getByRole('button', { name: 'Previous message' })).toBeDisabled();
    expect(view().getByText('1 / 3')).toBeInTheDocument();

    await user.click(view().getByRole('button', { name: 'Next message' }));
    expect(view().getByRole('heading', { name: 'Read Sender' })).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(view().getByRole('heading', { name: 'Third Person' })).toBeInTheDocument();
    expect(view().getByRole('button', { name: 'Next message' })).toBeDisabled();

    await user.keyboard('{ArrowLeft}');
    expect(view().getByRole('heading', { name: 'Read Sender' })).toBeInTheDocument();
  });

  it('steps only through what the filter shows', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(filter('STARRED'));
    await openView(user, 'Read Sender');
    expect(view().getByRole('button', { name: 'Next message' })).toBeDisabled();
    expect(view().getByRole('button', { name: 'Previous message' })).toBeDisabled();
  });

  it('Esc, × and the backdrop close it; focus goes back to the card', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    const open = screen.getByRole('button', { name: 'Open message from Read Sender' });

    await user.click(open);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe('');
    expect(open).toHaveFocus();

    await user.click(open);
    await user.click(view().getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(open);
    await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a reload with no history behind it still closes', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />, { at: '/admin?message=m2' });
    expect(view().getByRole('heading', { name: 'Read Sender' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe('');
  });

  it('an address for a message that has gone closes itself', async () => {
    render(<AdminMessagesPanel />, { at: '/admin?message=gone' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(where()).toBe(''));
  });

  it('stops the page behind from scrolling, and puts that back', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openView(user, 'Read Sender');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('highlights the search in the whole message', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await search(user, 'dock');
    await openView(user, 'Read Sender');
    expect(within(screen.getByRole('dialog')).getAllByText('Dock', { selector: 'mark' })).toHaveLength(1);
  });

  it('FROM shows in the view when known, and never on the card', async () => {
    useMessages.mockReturnValue({
      data: [{ ...MESSAGES[0], location: 'New York, NY, United States' }, MESSAGES[1]],
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    expect(within(cardOf('Unread Sender')).queryByText('From', { selector: 'dt' })).toBeNull();

    await openView(user, 'Unread Sender');
    expect(view().getByText('From', { selector: 'dt' }).nextElementSibling.textContent)
      .toBe('New York, NY, United States (approx.)');
    await user.click(view().getByRole('button', { name: 'Next message' }));
    expect(view().queryByText('From', { selector: 'dt' })).toBeNull();
  });
});

describe('DELETE asks first (PF-115, from the big view since PF-153)', () => {
  const deleteFromView = async (user, name) => {
    await openView(user, name);
    await user.click(view().getByRole('button', { name: `Delete message from ${name}` }));
  };

  it('opens the confirm and deletes NOTHING until YES', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await deleteFromView(user, 'Read Sender');
    expect(deleteMsg.mutateAsync).not.toHaveBeenCalled();
    expect(dialog().getByText('This will permanently delete the message from Read Sender.')).toBeInTheDocument();
    // Focus starts on CANCEL — an Enter pressed by reflex deletes nothing.
    expect(dialog().getByRole('button', { name: 'CANCEL' })).toHaveFocus();

    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));
    expect(deleteMsg.mutateAsync).toHaveBeenCalledWith('m2');
  });

  it('CANCEL deletes nothing and the view stays', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await deleteFromView(user, 'Read Sender');
    await user.click(dialog().getByRole('button', { name: 'CANCEL' }));

    expect(deleteMsg.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(where()).toBe('?message=m2');
  });

  it('Esc answers only the dialog on top', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await deleteFromView(user, 'Read Sender');
    await user.keyboard('{Escape}');

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(where()).toBe('?message=m2');
  });

  it('the next message opens after a delete', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await deleteFromView(user, 'Read Sender');
    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));
    await waitFor(() => expect(where()).toBe('?message=m3'));
  });

  it('the one before opens when the last on screen is deleted', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await deleteFromView(user, 'Third Person');
    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));
    await waitFor(() => expect(where()).toBe('?message=m2'));
  });

  it('the view closes when nothing is left', async () => {
    useMessages.mockReturnValue({ data: [MESSAGES[0]], isLoading: false });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await deleteFromView(user, 'Unread Sender');
    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));
    await waitFor(() => expect(where()).toBe(''));
  });

  it('surfaces a failed delete, and stays where it was', async () => {
    deleteMsg.mutateAsync.mockRejectedValue({ response: { data: { message: 'Message not found' } } });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await deleteFromView(user, 'Read Sender');
    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Message not found');
    expect(where()).toBe('?message=m2');
  });
});

describe('selecting several (PF-153)', () => {
  it('shows no bar until something is ticked, then counts', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    expect(screen.queryByRole('group', { name: 'Selected messages' })).toBeNull();

    await user.click(tick('Read Sender'));
    expect(screen.getByText('1 SELECTED')).toBeInTheDocument();
    await user.click(tick('Third Person'));
    expect(screen.getByText('2 SELECTED')).toBeInTheDocument();
    await user.click(tick('Third Person'));
    expect(screen.getByText('1 SELECTED')).toBeInTheDocument();
  });

  it('SELECT ALL ticks everything on screen, half-ticks when partial, and unticks', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);

    await user.click(tick('Read Sender'));
    expect(selectAll().indeterminate).toBe(true);
    expect(selectAll()).not.toBeChecked();

    await user.click(selectAll());
    expect(screen.getByText('3 SELECTED')).toBeInTheDocument();
    expect(selectAll().indeterminate).toBe(false);
    expect(selectAll()).toBeChecked();

    await user.click(selectAll());
    expect(screen.queryByRole('group', { name: 'Selected messages' })).toBeNull();
  });

  it('MARK READ sends exactly what is ticked, then clears the ticks', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(tick('Unread Sender'));
    await user.click(tick('Third Person'));

    const bar = within(screen.getByRole('group', { name: 'Selected messages' }));
    await user.click(bar.getByRole('button', { name: '✓ MARK READ' }));

    expect(bulk.mutateAsync).toHaveBeenCalledWith({ action: 'read', ids: ['m1', 'm3'] });
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Selected messages' })).toBeNull());
  });

  it('DELETE asks first with the count, and deletes nothing until YES', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(selectAll());

    const bar = within(screen.getByRole('group', { name: 'Selected messages' }));
    await user.click(bar.getByRole('button', { name: 'DELETE' }));
    expect(bulk.mutateAsync).not.toHaveBeenCalled();
    expect(dialog().getByText('Delete 3 messages?')).toBeInTheDocument();
    expect(dialog().getByRole('button', { name: 'CANCEL' })).toHaveFocus();

    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));
    expect(bulk.mutateAsync).toHaveBeenCalledWith({ action: 'delete', ids: ['m1', 'm2', 'm3'] });
  });

  // The safety rule: a search must never delete what it hides.
  it('a message hidden by a search stays out, even when it was ticked', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(selectAll());
    await search(user, 'internship');   // leaves m1 and m3 on screen; m2 hidden
    expect(screen.getByText('2 SELECTED')).toBeInTheDocument();

    const bar = within(screen.getByRole('group', { name: 'Selected messages' }));
    await user.click(bar.getByRole('button', { name: 'DELETE' }));
    await user.click(dialog().getByRole('button', { name: 'YES, DELETE' }));

    expect(bulk.mutateAsync).toHaveBeenCalledWith({ action: 'delete', ids: ['m1', 'm3'] });
  });

  it('SELECT ALL under a filter leaves what is hidden unticked', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(filter('STARRED'));
    await user.click(selectAll());
    await user.click(filter('ALL'));
    expect(tick('Read Sender')).toBeChecked();
    expect(tick('Unread Sender')).not.toBeChecked();
    expect(tick('Third Person')).not.toBeChecked();
  });

  it('a message arriving later is not ticked by itself', async () => {
    const user = userEvent.setup();
    const { rerender } = rtlRender(<MemoryRouter><AdminMessagesPanel /></MemoryRouter>);
    await user.click(selectAll());

    useMessages.mockReturnValue({
      data: [{ ...MESSAGES[2], _id: 'new', name: 'New Arrival' }, ...MESSAGES],
      isLoading: false,
    });
    rerender(<MemoryRouter><AdminMessagesPanel /></MemoryRouter>);

    expect(tick('New Arrival')).not.toBeChecked();
    expect(selectAll().indeterminate).toBe(true);
    expect(screen.getByText('3 SELECTED')).toBeInTheDocument();
  });

  it('CLEAR SELECTION unticks and sends nothing', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(selectAll());
    await user.click(screen.getByRole('button', { name: 'CLEAR SELECTION' }));
    expect(bulk.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Selected messages' })).toBeNull();
  });

  it('a failure says so and keeps the ticks', async () => {
    bulk.mutateAsync.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(tick('Read Sender'));
    const bar = within(screen.getByRole('group', { name: 'Selected messages' }));
    await user.click(bar.getByRole('button', { name: '✓ MARK READ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/We can't connect right now/);
    expect(tick('Read Sender')).toBeChecked();
  });

  it('a checkbox click does not open the message', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await user.click(tick('Read Sender'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('REPLY from the panel (PF-153)', () => {
  const openReply = async (user, name = 'Read Sender') => {
    await openView(user, name);
    await user.click(view().getByRole('button', { name: '✉ REPLY' }));
  };
  const box = () => view().getByRole('textbox', { name: /Your reply/ });
  const send = () => view().getByRole('button', { name: 'SEND REPLY' });

  beforeEach(() => { replyMsg.mutateAsync.mockResolvedValue({ message: {}, recorded: true }); });

  it('opens a form addressed to the visitor, focused, with SEND dim until typed', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    expect(view().getByText('To: r@example.com')).toBeInTheDocument();
    expect(box()).toHaveFocus();
    expect(send()).toBeDisabled();
    expect(view().queryByRole('button', { name: '✉ REPLY' })).toBeNull();
  });

  it('sends the trimmed words for this message, then says so and closes the form', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.type(box(), '  Yes, thanks.  ');
    await user.click(send());
    expect(replyMsg.mutateAsync).toHaveBeenCalledWith({ id: 'm2', message: 'Yes, thanks.' });
    expect(await view().findByText('REPLY SENT.')).toBeInTheDocument();
    expect(view().queryByRole('form', { name: 'Reply to this message' })).toBeNull();
  });

  // PF-154: the email went, its SENT copy did not — never "not sent", or the
  // owner would send it twice.
  it('says plainly when the reply went but could not be saved to SENT', async () => {
    replyMsg.mutateAsync.mockResolvedValue({ message: {}, recorded: false });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.type(box(), 'Yes.');
    await user.click(send());
    expect(await view().findByText('REPLY SENT, but it couldn’t be saved to SENT. Don’t send it again.'))
      .toBeInTheDocument();
    expect(view().queryByText('REPLY SENT.')).toBeNull();
  });

  it('refuses a blank reply: no request, the banner, the field marked', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.type(box(), '   ');
    await user.click(send());
    expect(replyMsg.mutateAsync).not.toHaveBeenCalled();
    expect(view().getByText('CHECK THE CHANGES AGAIN — 1 field needs attention.')).toBeInTheDocument();
    expect(view().getByText('This field is required.')).toBeInTheDocument();
    expect(box()).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses one over the limit, and typing clears the mark', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.click(box());
    await user.paste('a'.repeat(3001));
    await user.click(send());
    expect(replyMsg.mutateAsync).not.toHaveBeenCalled();
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    await user.type(box(), 'x');
    expect(box()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('a failed send says so plainly and keeps the words', async () => {
    replyMsg.mutateAsync.mockRejectedValue({ response: { status: 503, data: { message: "Your reply wasn't sent. Please try again in a moment." } } });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.type(box(), 'Yes');
    await user.click(send());
    expect(await view().findByText(/wasn't sent/)).toBeInTheDocument();
    expect(box()).toHaveValue('Yes');
    expect(view().queryByText('REPLY SENT.')).toBeNull();
  });

  it('the arrow keys move the cursor in the box, not the message', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.type(box(), 'abc{ArrowLeft}{ArrowRight}');
    expect(view().getByRole('heading', { name: 'Read Sender' })).toBeInTheDocument();
  });

  it('CANCEL with nothing typed closes the form', async () => {
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await openReply(user);
    await user.click(view().getByRole('button', { name: 'CANCEL' }));
    expect(view().getByRole('button', { name: '✉ REPLY' })).toBeInTheDocument();
  });

  it('shows earlier replies in the view and REPLIED on the card', async () => {
    useMessages.mockReturnValue({
      data: [{ ...MESSAGES[1], replies: [{ message: 'Answered already.', sentAt: '2026-11-01T10:00:00Z' }] }],
      isLoading: false,
    });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    expect(within(cardOf('Read Sender')).getByText('REPLIED')).toBeInTheDocument();
    await openView(user, 'Read Sender');
    expect(view().getByText('Answered already.')).toBeInTheDocument();
    expect(view().getByText(/YOU REPLIED · 2026\/11\/01/)).toBeInTheDocument();
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

  it('a hit below the three lines moves the preview to it (PF-153)', async () => {
    const long = `${'plain words here '.repeat(20)}needle at the end.`;
    useMessages.mockReturnValue({ data: [{ ...MESSAGES[0], message: long }], isLoading: false });
    const user = userEvent.setup();
    render(<AdminMessagesPanel />);
    await search(user, 'needle');
    const preview = cardOf('Unread Sender').querySelector('button[aria-label^="Read the message"]');
    expect(preview.textContent.startsWith('…')).toBe(true);
    expect(preview.querySelector('mark')).toHaveTextContent('needle');
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

// PF-117 — a failed load used to read "No messages yet" with ALL 0 / UNREAD 0.
describe('when the messages could not be loaded', () => {
  const failed = (data) => ({ data, isLoading: false, isError: true, isFetching: false, refetch: vi.fn() });

  it('says so, with no empty-inbox sentence and no zero counts', () => {
    useMessages.mockReturnValue(failed(undefined));
    render(<AdminMessagesPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('COULDN’T LOAD YOUR MESSAGES');
    expect(screen.queryByText(/No messages yet/)).not.toBeInTheDocument();
    // The filters stay usable, but name no count they do not have.
    expect(screen.getByRole('button', { name: 'ALL', exact: true })).toBeInTheDocument();
  });

  it('keeps showing the inbox when only a background refetch failed', () => {
    useMessages.mockReturnValue(failed(MESSAGES));
    render(<AdminMessagesPanel />);
    expect(screen.queryByText(/COULDN.T LOAD/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `ALL ${MESSAGES.length}`, exact: true })).toBeInTheDocument();
  });
});

// PF-123 (owner, 2026-10-20) — the card shows what the owner's email copy shows.
describe('the email copy\'s details on the card (PF-123)', () => {
  const detail = (card, label) => {
    const dt = within(card).getByText(label, { selector: 'dt' });
    return dt.nextElementSibling.textContent;
  };

  it('DATE is YYYY/MM/DD and TIME is 12-hour in Asia/Colombo while About has no zone', () => {
    render(<AdminMessagesPanel />);
    const card = cardOf('Unread Sender');           // 2026-09-16T10:00Z = 3:30 PM in Colombo
    expect(detail(card, 'Date')).toBe('2026/09/16');
    expect(detail(card, 'Time')).toBe('3:30 PM (Asia/Colombo)');
  });

  it('follows the About panel time zone, so the card and the email agree', () => {
    useAbout.mockReturnValue({ data: { timezone: 'Asia/Tokyo' } });
    render(<AdminMessagesPanel />);
    const card = cardOf('Unread Sender');           // 10:00Z = 7:00 PM in Tokyo
    expect(detail(card, 'Time')).toBe('7:00 PM (Asia/Tokyo)');
  });

  it('the red reply reminder shows on UNREAD messages only', () => {
    render(<AdminMessagesPanel />);
    expect(within(cardOf('Unread Sender')).getByText('Please reply within 24 hours!!')).toBeInTheDocument();
    expect(within(cardOf('Read Sender')).queryByText('Please reply within 24 hours!!')).toBeNull();
    expect(within(cardOf('Third Person')).queryByText('Please reply within 24 hours!!')).toBeNull();
  });

  it('the reminder is red (--danger) below one SOLID line', () => {
    const decls = {};
    postcss.parse(CSS).walkRules('.replyDue', (r) => r.walkDecls((d) => { decls[d.prop] = d.value; }));
    expect(decls.color).toBe('var(--danger)');
    expect(decls['border-top']).toMatch(/^1px solid /);
  });
});
