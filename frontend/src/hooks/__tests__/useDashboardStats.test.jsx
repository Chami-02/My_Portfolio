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
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const projectService = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
const skillService   = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
const blogService    = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), togglePublish: vi.fn(), remove: vi.fn(), recordView: vi.fn(),
}));
const contactService = vi.hoisted(() => ({ markRead: vi.fn(), remove: vi.fn() }));
const dashboardService = vi.hoisted(() => ({ getStats: vi.fn() }));

vi.mock('../../services/projectService',   () => ({ projectService }));
vi.mock('../../services/skillService',     () => ({ skillService }));
vi.mock('../../services/blogService',      () => ({ blogService }));
vi.mock('../../services/contactService',   () => ({ contactService }));
vi.mock('../../services/dashboardService', () => ({ dashboardService }));

const { DASHBOARD_KEY, useDashboardStats } = await import('../useDashboardStats');
const { useCreateProject, useUpdateProject, useDeleteProject } = await import('../useProjects');
const { useCreateSkill, useDeleteSkill } = await import('../useSkills');
const { useCreatePost, useUpdatePost, useTogglePublish, useDeletePost, useRecordView } =
  await import('../useBlog');
const { useMarkMessageRead, useDeleteMessage } = await import('../useMessages');

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
  for (const svc of [projectService, skillService, blogService, contactService]) {
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
    ['useMarkMessageRead', useMarkMessageRead, 'id'],
    ['useDeleteMessage',   useDeleteMessage,   'id'],
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

  // ⚠️ Locked (PF-99): useRecordView invalidates NOTHING. A view changes
  // no count, and copying the invalidation pattern here would refetch on
  // every public page view.
  it('useRecordView invalidates nothing at all', async () => {
    const { result } = renderHook(() => useRecordView(), { wrapper });
    await result.current.mutateAsync('slug');
    expect(invalidated).toHaveLength(0);
  });
});
