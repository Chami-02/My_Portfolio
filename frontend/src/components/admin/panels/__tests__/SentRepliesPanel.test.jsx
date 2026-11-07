// PF-154 (owner, 2026-11-07) — SENT in the Messages panel: the INBOX | SENT
// switch, the list, its search, the big view, and deleting (one, or what is
// ticked on screen), each behind the shared confirm.
import { render as rtlRender, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const removeOne  = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const removeMany = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const useMessages    = vi.hoisted(() => vi.fn());
const useSentReplies = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useMessages', () => ({
  useMessages,
  useSentReplies,
  useDeleteSentReply:   () => removeOne,
  useDeleteSentReplies: () => removeMany,
  useMarkMessageRead: () => ({ mutate: vi.fn() }),
  useStarMessage:     () => ({ mutate: vi.fn() }),
  useDeleteMessage:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkMessages:    () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReplyToMessage:  () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const useAbout = vi.hoisted(() => vi.fn());
vi.mock('../../../../hooks/useAbout', () => ({ useAbout }));

const { AdminMessagesPanel } = await import('../AdminMessagesPanel');

function Where() {
  const { search } = useLocation();
  return <span data-testid="where">{search}</span>;
}
const render = (at = '/admin/messages?box=sent') => rtlRender(
  <MemoryRouter initialEntries={[at]}><AdminMessagesPanel /><Where /></MemoryRouter>,
);

const MESSAGES = Object.freeze([
  Object.freeze({ _id: 'm1', name: 'Ada', email: 'ada@example.com', message: 'Are you free for a Docker role?', read: true, createdAt: '2026-11-01T04:00:00Z' }),
]);
// Newest first, as the server sends them. s2's message (m9) has been deleted.
const SENT = Object.freeze([
  Object.freeze({
    _id: 's1', contact: 'm1', toName: 'Ada', toEmail: 'ada@example.com',
    subject: 'Re: Your message to Parindra Gallage', message: 'Yes, I am free next week.',
    original: Object.freeze({ message: 'Are you free for a Docker role?', receivedAt: '2026-11-01T04:00:00Z' }),
    sentAt: '2026-11-02T05:30:00Z',
  }),
  Object.freeze({
    _id: 's2', contact: 'm9', toName: 'Grace', toEmail: 'grace@corp.com',
    subject: 'Re: Your message to Parindra Gallage', message: 'Thanks for writing.',
    original: Object.freeze({ message: 'Loved the blog post.', receivedAt: '2026-10-20T04:00:00Z' }),
    sentAt: '2026-10-21T05:30:00Z',
  }),
]);

beforeEach(() => {
  vi.clearAllMocks();
  removeOne.mutateAsync.mockResolvedValue(undefined);
  removeMany.mutateAsync.mockResolvedValue(undefined);
  useMessages.mockReturnValue({ data: MESSAGES, isLoading: false });
  useSentReplies.mockReturnValue({ data: SENT, isLoading: false });
  useAbout.mockReturnValue({ data: { timezone: 'Asia/Colombo' } });
});

const where = () => screen.getByTestId('where').textContent;
const cards = () => screen.queryAllByRole('listitem').filter((li) => li.matches('[data-sent-card]'));
const cardNames = () => cards().map((li) => li.querySelector('[class*="name"]').textContent);
const view = () => within(screen.getAllByRole('dialog')[0]);
const dialog = () => within(screen.getAllByRole('dialog').at(-1));
const tick = (name) => screen.getByRole('checkbox', { name: `Select your reply to ${name}` });

describe('the INBOX | SENT switch', () => {
  it('shows both counts once loaded, and which box is open', () => {
    render();
    const box = within(screen.getByRole('group', { name: 'Messages box' }));
    expect(box.getByRole('button', { name: 'INBOX 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(box.getByRole('button', { name: 'SENT 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Sent replies' })).toBeInTheDocument();
  });

  it('no count while a list is still loading (PF-117)', () => {
    useSentReplies.mockReturnValue({ data: undefined, isLoading: true });
    render();
    expect(screen.getByRole('button', { name: 'SENT' })).toBeInTheDocument();
  });

  it('switches through the address, so Back and a reload keep the box', async () => {
    const user = userEvent.setup();
    render('/admin/messages');
    expect(screen.getByRole('region', { name: 'Messages' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'SENT 2' }));
    expect(where()).toBe('?box=sent');
    await user.click(screen.getByRole('button', { name: 'INBOX 1' }));
    expect(where()).toBe('');
    expect(screen.getByRole('region', { name: 'Messages' })).toBeInTheDocument();
  });
});

describe('the SENT list', () => {
  it('lists every reply in the server\'s order: newest first', () => {
    render();
    expect(cardNames()).toEqual(['Ada', 'Grace']);
  });

  it('a card shows who, when (in the About zone), the reply and what it answered', () => {
    render();
    const card = within(cards()[0]);
    expect(card.getByText('TO')).toBeInTheDocument();
    expect(card.getByText('ada@example.com')).toBeInTheDocument();
    expect(card.getByText('2026/11/02')).toBeInTheDocument();      // 05:30Z = 11:00 AM Colombo
    expect(card.getByText(/11:00 AM/)).toBeInTheDocument();
    expect(card.getByText('Yes, I am free next week.')).toBeInTheDocument();
    expect(card.getByText('Answering: “Are you free for a Docker role?”')).toBeInTheDocument();
    expect(card.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('says so when nothing has been sent yet', () => {
    useSentReplies.mockReturnValue({ data: [], isLoading: false });
    render();
    expect(screen.getByRole('status'))
      .toHaveTextContent('No replies sent yet. When you reply to a message, your reply appears here.');
  });

  it('a failed load shows LoadError, never the empty state', () => {
    useSentReplies.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render();
    expect(screen.queryByText(/No replies sent yet/)).toBeNull();
    expect(screen.getByText(/YOUR SENT REPLIES/)).toBeInTheDocument();
  });

  it('a failed refetch keeps the list it already has', () => {
    useSentReplies.mockReturnValue({ data: SENT, isLoading: false, isError: true, refetch: vi.fn() });
    render();
    expect(cardNames()).toEqual(['Ada', 'Grace']);
  });

  it('searches names, emails, the reply AND the message it answered', async () => {
    const user = userEvent.setup();
    render();
    const box = screen.getByRole('textbox', { name: 'Search sent replies' });
    await user.type(box, 'blog');
    expect(cardNames()).toEqual(['Grace']);
    await user.clear(box);
    await user.type(box, 'corp.com');
    expect(cardNames()).toEqual(['Grace']);
    await user.clear(box);
    await user.type(box, 'nobody');
    expect(screen.getByRole('status')).toHaveTextContent('No sent replies match “nobody”.');
  });
});

describe('the big view', () => {
  it('opens from OPEN with everything that was sent, in the address', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Open your reply to Ada' }));
    expect(where()).toBe('?box=sent&sent=s1');
    expect(view().getByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(view().getByText('Re: Your message to Parindra Gallage')).toBeInTheDocument();
    expect(view().getByText('Yes, I am free next week.')).toBeInTheDocument();
    expect(view().getByText('Are you free for a Docker role?')).toBeInTheDocument();
    expect(view().getByText(/ADA WROTE · 2026\/11\/01/)).toBeInTheDocument();
  });

  it('steps through the list, and Esc closes back to SENT', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Open your reply to Ada' }));
    expect(view().getByRole('button', { name: 'Previous sent reply' })).toBeDisabled();
    await user.click(view().getByRole('button', { name: 'Next sent reply' }));
    expect(view().getByRole('heading', { name: 'Grace' })).toBeInTheDocument();
    expect(view().getByRole('button', { name: 'Next sent reply' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe('?box=sent');
  });

  it('links to the message it answered while that is still in the inbox', async () => {
    const user = userEvent.setup();
    render('/admin/messages?box=sent&sent=s1');
    expect(view().queryByText(/deleted from your inbox/)).toBeNull();
    await user.click(view().getByRole('button', { name: 'OPEN THEIR MESSAGE' }));
    expect(where()).toBe('?message=m1');
  });

  it('says the message is gone when it was deleted — the reply stays', () => {
    render('/admin/messages?box=sent&sent=s2');
    expect(view().getByText('Their message has been deleted from your inbox.')).toBeInTheDocument();
    expect(view().queryByRole('button', { name: 'OPEN THEIR MESSAGE' })).toBeNull();
  });

  it('guesses neither while the inbox has not loaded', () => {
    useMessages.mockReturnValue({ data: undefined, isLoading: true });
    render('/admin/messages?box=sent&sent=s2');
    expect(view().queryByText(/deleted from your inbox/)).toBeNull();
    expect(view().queryByRole('button', { name: 'OPEN THEIR MESSAGE' })).toBeNull();
  });

  it('an address for a reply that has gone closes itself', () => {
    render('/admin/messages?box=sent&sent=gone');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe('?box=sent');
  });
});

describe('deleting', () => {
  it('asks first, says the email cannot be unsent, and deletes nothing until YES', async () => {
    const user = userEvent.setup();
    render('/admin/messages?box=sent&sent=s1');
    await user.click(view().getByRole('button', { name: 'Delete your reply to Ada' }));
    expect(dialog().getByText('Delete sent reply?')).toBeInTheDocument();
    expect(dialog().getByText(/removes your reply to Ada from SENT\. The email they received can’t be unsent\./))
      .toBeInTheDocument();
    expect(removeOne.mutateAsync).not.toHaveBeenCalled();
    await user.click(dialog().getByRole('button', { name: /cancel/i }));
    expect(removeOne.mutateAsync).not.toHaveBeenCalled();
  });

  it('deletes that one, then shows the next', async () => {
    const user = userEvent.setup();
    render('/admin/messages?box=sent&sent=s1');
    await user.click(view().getByRole('button', { name: 'Delete your reply to Ada' }));
    await user.click(dialog().getByRole('button', { name: /^(yes|delete)/i }));
    expect(removeOne.mutateAsync).toHaveBeenCalledWith('s1');
    // After the delete settles — the click returns before the async handler does.
    await waitFor(() => expect(where()).toBe('?box=sent&sent=s2'));
  });

  it('a failed delete says so plainly and keeps the view', async () => {
    removeOne.mutateAsync.mockRejectedValue({ response: { status: 404, data: { message: "We couldn't find that sent reply. It may have been deleted already." } } });
    const user = userEvent.setup();
    render('/admin/messages?box=sent&sent=s1');
    await user.click(view().getByRole('button', { name: 'Delete your reply to Ada' }));
    await user.click(dialog().getByRole('button', { name: /^(yes|delete)/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/sent reply/i);
    expect(where()).toBe('?box=sent&sent=s1');
  });

  it('bulk delete sends only what is ticked AND on screen', async () => {
    const user = userEvent.setup();
    render();
    await user.click(tick('Ada'));
    await user.click(tick('Grace'));
    await user.type(screen.getByRole('textbox', { name: 'Search sent replies' }), 'grace');
    const bar = within(screen.getByRole('group', { name: 'Selected sent replies' }));
    expect(bar.getByText('1 SELECTED')).toBeInTheDocument();
    await user.click(bar.getByRole('button', { name: 'DELETE' }));
    expect(dialog().getByText('Delete 1 sent reply?')).toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: /^(yes|delete)/i }));
    await waitFor(() => expect(removeMany.mutateAsync).toHaveBeenCalledWith(['s2']));
  });

  it('a failed bulk delete says so', async () => {
    removeMany.mutateAsync.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('checkbox', { name: 'SELECT ALL' }));
    await user.click(within(screen.getByRole('group', { name: 'Selected sent replies' }))
      .getByRole('button', { name: 'DELETE' }));
    expect(dialog().getByText('Delete 2 sent replies?')).toBeInTheDocument();
    await user.click(dialog().getByRole('button', { name: /^(yes|delete)/i }));
    expect(removeMany.mutateAsync).toHaveBeenCalledWith(['s1', 's2']);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
