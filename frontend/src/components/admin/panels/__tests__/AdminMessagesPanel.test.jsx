// frontend/src/components/admin/panels/__tests__/AdminMessagesPanel.test.jsx
//
// 2026-09-16 fix — the unread marker. The panel is still Phase 1 (PF-115
// restyles it); this pins only the marker's contract so PF-115 carries
// it over: green, top-right, on the global glowdot carrier with longhand
// timing, and the header row padded clear of it.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const useMessages        = vi.hoisted(() => vi.fn());
const useMarkMessageRead = vi.hoisted(() => vi.fn(() => ({ mutate: vi.fn() })));
const useDeleteMessage   = vi.hoisted(() => vi.fn(() => ({ mutate: vi.fn() })));
vi.mock('../../../../hooks/useMessages', () => ({ useMessages, useMarkMessageRead, useDeleteMessage }));

const { AdminMessagesPanel } = await import('../AdminMessagesPanel');

const MESSAGES = [
  { _id: 'm1', name: 'Unread Sender', email: 'u@example.com', message: 'Hello there.', read: false, createdAt: '2026-09-16T10:00:00Z' },
  { _id: 'm2', name: 'Read Sender',   email: 'r@example.com', message: 'Already seen.', read: true,  createdAt: '2026-09-15T10:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  useMessages.mockReturnValue({ data: MESSAGES, isLoading: false });
});

const cardOf = (name) => screen.getByText(name).closest('[style*="position"]');

describe('AdminMessagesPanel — unread marker', () => {
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

  it('pads the header row so the date clears the dot', () => {
    render(<AdminMessagesPanel />);
    const card = cardOf('Unread Sender');
    const header = card.querySelector('div[style*="flex"]');
    expect(header.style.paddingRight).toBe('20px');
  });

  it('uses no Phase 1 indigo on the unread card', () => {
    render(<AdminMessagesPanel />);
    const card = cardOf('Unread Sender');
    expect(card.getAttribute('style')).not.toMatch(/129,\s*140,\s*248/);
    expect(card.querySelector('[data-unread-dot]').getAttribute('style')).not.toContain('--accent');
  });
});
