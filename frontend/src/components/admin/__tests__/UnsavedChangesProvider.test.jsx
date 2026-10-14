// PF-118 batch 2 — the unsaved-changes guard, through a real data router.
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router-dom';
import { useUnsavedChanges, useRequestLeave } from '../../../hooks/useUnsavedChanges';
import { renderWithGuard } from '../../../test/renderWithGuard';

/** A stand-in panel: registers whatever the test says, offers two exits. */
function Panel({ entry, onLeave, leaveOpts }) {
  useUnsavedChanges(entry);
  const requestLeave = useRequestLeave();
  return (
    <>
      <button type="button" onClick={() => requestLeave(onLeave, leaveOpts)}>LEAVE</button>
      <Link to="/elsewhere">HOME LINK</Link>
    </>
  );
}

const DIRTY = (over = {}) => ({
  dirty: true, save: vi.fn().mockResolvedValue(true), saveLabel: 'SAVE AS DRAFT', what: 'your new project', ...over,
});
const dialog = () => screen.queryByRole('dialog');

describe('in-app exits (requestLeave)', () => {
  it('clean: leaves at once, no question asked', async () => {
    const onLeave = vi.fn();
    renderWithGuard(<Panel entry={{ dirty: false }} onLeave={onLeave} />);
    await userEvent.click(screen.getByText('LEAVE'));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('dirty: asks, naming what would be lost, with KEEP EDITING focused', async () => {
    const onLeave = vi.fn();
    renderWithGuard(<Panel entry={DIRTY()} onLeave={onLeave} />);
    await userEvent.click(screen.getByText('LEAVE'));

    expect(onLeave).not.toHaveBeenCalled();
    expect(dialog()).toHaveTextContent('Your new project has changes that are not saved yet.');
    expect(screen.getByRole('button', { name: 'KEEP EDITING' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'SAVE AS DRAFT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DISCARD & LEAVE' })).toBeInTheDocument();
  });

  it('KEEP EDITING stays, and so do Escape and the backdrop', async () => {
    const onLeave = vi.fn();
    renderWithGuard(<Panel entry={DIRTY()} onLeave={onLeave} />);

    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.click(screen.getByRole('button', { name: 'KEEP EDITING' }));
    expect(dialog()).toBeNull();

    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toBeNull();

    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.click(dialog());   // the overlay IS the backdrop
    expect(dialog()).toBeNull();

    expect(onLeave).not.toHaveBeenCalled();
  });

  it('DISCARD & LEAVE leaves without saving', async () => {
    const onLeave = vi.fn();
    const entry = DIRTY();
    renderWithGuard(<Panel entry={entry} onLeave={onLeave} />);
    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.click(screen.getByRole('button', { name: 'DISCARD & LEAVE' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(entry.save).not.toHaveBeenCalled();
  });

  it('SAVE runs the panel’s real save, then leaves', async () => {
    const onLeave = vi.fn();
    const entry = DIRTY();
    renderWithGuard(<Panel entry={entry} onLeave={onLeave} />);
    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.click(screen.getByRole('button', { name: 'SAVE AS DRAFT' }));
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(entry.save).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it.each([
    ['refused (the panel marked a field)', () => vi.fn().mockResolvedValue(false)],
    ['failed (the server said no)', () => vi.fn().mockRejectedValue(new Error('500'))],
  ])('a save that is %s STAYS — the panel shows why', async (_why, makeSave) => {
    const onLeave = vi.fn();
    const entry = DIRTY({ save: makeSave() });
    renderWithGuard(<Panel entry={entry} onLeave={onLeave} />);
    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.click(screen.getByRole('button', { name: 'SAVE AS DRAFT' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(entry.save).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('no single save to offer: Keep / Discard only', async () => {
    renderWithGuard(<Panel entry={{ dirty: true, what: 'your new skill and the skill order' }} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByText('LEAVE'));
    expect(screen.queryByRole('button', { name: /SAVE/ })).toBeNull();
    expect(dialog()).toHaveTextContent('Go back and save, or they will be lost.');
  });
});

describe('router exits (useBlocker) — HOME links, Back/Forward', () => {
  it('a link out while dirty is held; KEEP EDITING stays on the page', async () => {
    const { router } = renderWithGuard(<Panel entry={DIRTY()} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByText('HOME LINK'));
    expect(dialog()).toHaveTextContent('Your new project');
    await userEvent.click(screen.getByRole('button', { name: 'KEEP EDITING' }));
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('DISCARD & LEAVE follows the link', async () => {
    const { router } = renderWithGuard(<Panel entry={DIRTY()} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByText('HOME LINK'));
    await userEvent.click(screen.getByRole('button', { name: 'DISCARD & LEAVE' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'));
  });

  it('SAVE, then the link is followed', async () => {
    const entry = DIRTY();
    const { router } = renderWithGuard(<Panel entry={entry} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByText('HOME LINK'));
    await userEvent.click(screen.getByRole('button', { name: 'SAVE AS DRAFT' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'));
    expect(entry.save).toHaveBeenCalledTimes(1);
  });

  it('browser Back while dirty is held; DISCARD then goes back', async () => {
    const { router } = renderWithGuard(<Panel entry={DIRTY()} onLeave={vi.fn()} />, {
      history: ['/elsewhere', '/admin'],
    });

    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/admin');
    expect(dialog()).toHaveTextContent('Your new project');

    await userEvent.click(screen.getByRole('button', { name: 'DISCARD & LEAVE' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'));
  });

  it('a same-page hash link is not leaving — no question even while dirty', async () => {
    const { router } = renderWithGuard(<Panel entry={DIRTY()} onLeave={vi.fn()} />);
    await act(() => router.navigate('/admin#about'));
    expect(dialog()).toBeNull();
    expect(router.state.location.hash).toBe('#about');
  });

  it('a clean page follows links freely — the zero case', async () => {
    const { router } = renderWithGuard(<Panel entry={{ dirty: false }} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByText('HOME LINK'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'));
    expect(dialog()).toBeNull();
  });

  it('an approved exit that leaves the admin is not asked about twice', async () => {
    // SIGN OUT's shape: approved via requestLeave, then it navigates away.
    let routerRef;
    const onLeave = () => routerRef.navigate('/elsewhere');
    const { router } = renderWithGuard(
      <Panel entry={DIRTY()} onLeave={onLeave} leaveOpts={{ leavingAdmin: true }} />,
    );
    routerRef = router;
    await userEvent.click(screen.getByText('LEAVE'));
    await userEvent.click(screen.getByRole('button', { name: 'DISCARD & LEAVE' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/elsewhere'));
    expect(dialog()).toBeNull();
  });
});

describe('browser exits (beforeunload) — reload, close tab, typed URL', () => {
  const fire = () => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  };

  it('prompts while dirty', () => {
    renderWithGuard(<Panel entry={DIRTY()} onLeave={vi.fn()} />);
    expect(fire()).toBe(true);
  });

  it('does not prompt when clean — the zero case', () => {
    renderWithGuard(<Panel entry={{ dirty: false }} onLeave={vi.fn()} />);
    expect(fire()).toBe(false);
  });
});
