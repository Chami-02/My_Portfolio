// frontend/src/hooks/__tests__/useDashboardStats.test.jsx
//
// PF-110 — the invalidation contract for GET /api/dashboard/stats.
//
// The stats entry is read by three consumers (Overview cards, sidebar
// badges, footer counts) and written by NONE of them. Every mutation that
// changes a document count has to invalidate DASHBOARD_KEY, or the badges
// sit on the old number for staleTime (5 minutes) after a save — which
// looks like "the save didn't work" while the list beside it shows it did.
// A component test cannot see that; the panel looks right and the shell
// looks stale. So the contract is pinned on the hooks, the way
// useVocabulary.test.jsx pins the tag cascade.
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const projectService = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
const skillService   = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), reorder: vi.fn(), remove: vi.fn() }));
const blogService    = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), togglePublish: vi.fn(), remove: vi.fn(), recordView: vi.fn(),
}));
const contactService = vi.hoisted(() => ({ markRead: vi.fn(), remove: vi.fn(), star: vi.fn(), getAll: vi.fn() }));
const dashboardService = vi.hoisted(() => ({ getStats: vi.fn() }));
const skillCategoryService = vi.hoisted(() => ({ create: vi.fn(), rename: vi.fn(), reorder: vi.fn(), remove: vi.fn() }));

vi.mock('../../services/projectService',   () => ({ projectService }));
vi.mock('../../services/skillService',     () => ({ skillService }));
vi.mock('../../services/blogService',      () => ({ blogService }));
vi.mock('../../services/contactService',   () => ({ contactService }));
vi.mock('../../services/dashboardService', () => ({ dashboardService }));
vi.mock('../../services/skillCategoryService', () => ({ skillCategoryService }));

const { DASHBOARD_KEY, STATS_POLL_MS, useDashboardStats } = await import('../useDashboardStats');
const { useCreateProject, useUpdateProject, useDeleteProject } = await import('../useProjects');
const { useCreateSkill, useUpdateSkill, useReorderSkills, useDeleteSkill } = await import('../useSkills');
const { useCreatePost, useUpdatePost, useTogglePublish, useDeletePost, useRecordView } =
  await import('../useBlog');
const { useMessages, useMarkMessageRead, useDeleteMessage, useStarMessage } = await import('../useMessages');
const {
  useCreateSkillCategory, useRenameSkillCategory, useReorderSkillCategories, useDeleteSkillCategory,
} = await import('../useSkillCategories');

let client;
let invalidated;

const wrapper = ({ children }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const invalidatedKeys = () => invalidated.map((c) => JSON.stringify(c[0].queryKey));
const STATS_KEY = JSON.stringify(DASHBOARD_KEY);

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidated = [];
  const real = client.invalidateQueries.bind(client);
  vi.spyOn(client, 'invalidateQueries').mockImplementation((...args) => {
    invalidated.push(args);
    return real(...args);
  });
  for (const svc of [projectService, skillService, blogService, contactService, skillCategoryService]) {
    for (const fn of Object.values(svc)) fn.mockResolvedValue({});
  }
});

describe('useDashboardStats', () => {
  it('reads the service under DASHBOARD_KEY', async () => {
    const payload = { projects: 1, skills: 2, posts: 3, published: 2, drafts: 1, messages: 4, unread: 3 };
    dashboardService.getStats.mockResolvedValue(payload);

    const { result } = renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(payload));
    expect(client.getQueryData(DASHBOARD_KEY)).toEqual(payload);
  });
});

// PF-119 follow-up — counts also change OUTSIDE this tab (a visitor's
// message), which no mutation here hears about.
describe('the stats stay live without a reload', () => {
  const STATS = { projects: 1, skills: 2, posts: 3, published: 2, drafts: 1, messages: 4, unread: 3 };

  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it(`refetches every ${STATS_POLL_MS / 1000} s, and not before`, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dashboardService.getStats.mockResolvedValue(STATS);
    renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(dashboardService.getStats).toHaveBeenCalledTimes(1));

    await act(() => vi.advanceTimersByTimeAsync(STATS_POLL_MS - 1000));
    expect(dashboardService.getStats).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(dashboardService.getStats).toHaveBeenCalledTimes(2));
  });

  it('refetches when the window regains focus', async () => {
    dashboardService.getStats.mockResolvedValue(STATS);
    renderHook(() => useDashboardStats(), { wrapper });
    await waitFor(() => expect(dashboardService.getStats).toHaveBeenCalledTimes(1));

    act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
    await waitFor(() => expect(dashboardService.getStats).toHaveBeenCalledTimes(2));
  });
});

describe('the message list follows the stats total', () => {
  const statsWith = (messages) => ({ projects: 0, skills: 0, posts: 0, published: 0, drafts: 0, messages, unread: 0 });

  it('refetches the list when the total moves — a new message arrived', async () => {
    dashboardService.getStats.mockResolvedValue(statsWith(3));
    contactService.getAll.mockResolvedValue([]);
    renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(contactService.getAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.getQueryData(DASHBOARD_KEY)).toEqual(statsWith(3)));

    act(() => { client.setQueryData(DASHBOARD_KEY, statsWith(4)); });
    await waitFor(() => expect(contactService.getAll).toHaveBeenCalledTimes(2));
  });

  it('does not refetch on mount when the shell already has the stats cached', async () => {
    client.setQueryData(DASHBOARD_KEY, statsWith(3));
    dashboardService.getStats.mockResolvedValue(statsWith(3));
    contactService.getAll.mockResolvedValue([]);
    renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(contactService.getAll).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(contactService.getAll).toHaveBeenCalledTimes(1);
  });

  it('leaves the list alone when a stats answer brings the SAME total', async () => {
    dashboardService.getStats.mockResolvedValue(statsWith(3));
    contactService.getAll.mockResolvedValue([]);
    renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(contactService.getAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.getQueryData(DASHBOARD_KEY)).toEqual(statsWith(3)));

    act(() => { client.setQueryData(DASHBOARD_KEY, { ...statsWith(3), unread: 1 }); });
    await new Promise((r) => setTimeout(r, 50));
    expect(contactService.getAll).toHaveBeenCalledTimes(1);
  });
});

describe('mutations that change a count invalidate the stats entry', () => {
  it.each([
    ['useCreateProject',   useCreateProject,   { title: 'x' }],
    ['useDeleteProject',   useDeleteProject,   'id'],
    ['useCreateSkill',     useCreateSkill,     { name: 'x' }],
    ['useDeleteSkill',     useDeleteSkill,     'id'],
    ['useCreatePost',      useCreatePost,      { title: 'x' }],
    ['useUpdatePost',      useUpdatePost,      { id: 'id', data: {} }],   // the form can flip `published`
    ['useTogglePublish',   useTogglePublish,   'id'],
    ['useDeletePost',      useDeletePost,      'id'],
    ['useMarkMessageRead', useMarkMessageRead, { id: 'id', read: true }],
    ['useMarkMessageRead (unread)', useMarkMessageRead, { id: 'id', read: false }],
    ['useDeleteMessage',   useDeleteMessage,   'id'],
    // PF-114: deleting a section can delete its skills with it.
    ['useDeleteSkillCategory', useDeleteSkillCategory, { id: 'id', choice: { deleteSkills: true } }],
  ])('%s invalidates DASHBOARD_KEY', async (_name, hook, arg) => {
    const { result } = renderHook(() => hook(), { wrapper });
    await result.current.mutateAsync(arg);
    await waitFor(() => expect(invalidatedKeys()).toContain(STATS_KEY));
  });
});

describe('mutations that cannot change a count leave it alone', () => {
  // An update edits fields on a project that already exists; the count
  // the stats carry is unchanged, so a refetch would be a wasted request.
  it('useUpdateProject does not invalidate DASHBOARD_KEY', async () => {
    const { result } = renderHook(() => useUpdateProject(), { wrapper });
    await result.current.mutateAsync({ id: 'id', data: {} });
    await waitFor(() => expect(invalidated.length).toBeGreaterThan(0));
    expect(invalidatedKeys()).not.toContain(STATS_KEY);
  });

  // PF-114 — editing or reordering a skill changes no count.
  it.each([
    ['useUpdateSkill',   useUpdateSkill,   { id: 'id', data: {} }],
    ['useReorderSkills', useReorderSkills, ['a', 'b']],
  ])('%s refreshes the skill list but not DASHBOARD_KEY', async (_name, hook, arg) => {
    const { result } = renderHook(() => hook(), { wrapper });
    await result.current.mutateAsync(arg);
    await waitFor(() => expect(invalidatedKeys()).toContain(JSON.stringify(['skills'])));
    expect(invalidatedKeys()).not.toContain(STATS_KEY);
  });

  // PF-114 — section create/rename/reorder change no count and move no skill.
  it.each([
    ['useCreateSkillCategory',    useCreateSkillCategory,    'Soft Skills'],
    ['useRenameSkillCategory',    useRenameSkillCategory,    { id: 'id', label: 'x' }],
    ['useReorderSkillCategories', useReorderSkillCategories, ['a', 'b']],
  ])('%s refreshes only the section list', async (_name, hook, arg) => {
    const { result } = renderHook(() => hook(), { wrapper });
    await result.current.mutateAsync(arg);
    await waitFor(() => expect(invalidatedKeys()).toEqual([JSON.stringify(['skillCategories'])]));
  });

  // PF-115 — a star changes neither unread nor total.
  it('useStarMessage refreshes the message list but not DASHBOARD_KEY', async () => {
    const { result } = renderHook(() => useStarMessage(), { wrapper });
    await result.current.mutateAsync({ id: 'id', starred: true });
    await waitFor(() => expect(invalidatedKeys()).toEqual([JSON.stringify(['messages'])]));
    expect(contactService.star).toHaveBeenCalledWith('id', true);
  });

  // ⚠️ Locked (PF-99): useRecordView invalidates NOTHING. A view changes
  // no count, and copying the invalidation pattern here would refetch on
  // every public page view.
  it('useRecordView invalidates nothing at all', async () => {
    const { result } = renderHook(() => useRecordView(), { wrapper });
    await result.current.mutateAsync('slug');
    expect(invalidated).toHaveLength(0);
  });
});

// ── PF-118 — a save during the FIRST stats fetch ────────────────────────────
// The defect PF-115 measured: a draft saved ~1 s after login left the shell
// reading `0 DRAFT` for five minutes. TanStack only cancels an in-flight fetch
// on refetch when the query already has data, so during the first fetch a bare
// invalidation was deduped into the request that predated the save.
describe('a count-changing save while the first stats fetch is in flight', () => {
  const deferred = () => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; };

  it('ends on the post-save answer, not the one that was already on its way', async () => {
    const answers = [];
    dashboardService.getStats.mockImplementation(() => {
      const d = deferred(); answers.push(d); return d.p;
    });

    const { result } = renderHook(
      () => ({ stats: useDashboardStats(), create: useCreatePost() }),
      { wrapper },
    );
    await waitFor(() => expect(answers).toHaveLength(1));   // first fetch in flight

    await result.current.create.mutateAsync({ title: 'Draft' });

    // The stale request answers AFTER the save landed — the race itself.
    answers[0].resolve({ drafts: 0 });
    await waitFor(() => expect(answers).toHaveLength(2));   // a NEW request
    answers[1].resolve({ drafts: 1 });

    await waitFor(() => expect(result.current.stats.data).toEqual({ drafts: 1 }));
    expect(result.current.stats.isError).toBe(false);
  });

  it('with stats already loaded, still exactly one refetch', async () => {
    // The control: cancelling first must not cost a second request, or leave
    // the query in an error state, on the ordinary path.
    dashboardService.getStats.mockResolvedValueOnce({ drafts: 0 }).mockResolvedValueOnce({ drafts: 1 });
    const { result } = renderHook(
      () => ({ stats: useDashboardStats(), create: useCreatePost() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.stats.data).toEqual({ drafts: 0 }));

    await result.current.create.mutateAsync({ title: 'Draft' });

    await waitFor(() => expect(result.current.stats.data).toEqual({ drafts: 1 }));
    expect(dashboardService.getStats).toHaveBeenCalledTimes(2);
    expect(result.current.stats.isError).toBe(false);
  });
});
