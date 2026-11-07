// The admin page's first tab and its address. PF-153: a reload with a message
// open comes back to Messages. PF-154: so does a reload on SENT, and leaving
// Messages takes SENT's address with it.
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

const stub = (name) => () => <p>{name} panel</p>;
vi.mock('../../components/admin/AdminLayout', () => ({
  AdminLayout: ({ activeTab, onTabChange, children }) => (
    <div data-active={activeTab}>
      <button type="button" onClick={() => onTabChange('projects')}>Projects</button>
      <button type="button" onClick={() => onTabChange('messages')}>Messages</button>
      {children}
    </div>
  ),
}));
vi.mock('../../components/admin/panels/AdminOverviewPanel',     () => ({ AdminOverviewPanel: stub('Overview') }));
vi.mock('../../components/admin/panels/AdminProjectsPanel',     () => ({ AdminProjectsPanel: stub('Projects') }));
vi.mock('../../components/admin/panels/AdminSkillsPanel',       () => ({ AdminSkillsPanel: stub('Skills') }));
vi.mock('../../components/admin/panels/AdminAboutPanel',        () => ({ AdminAboutPanel: stub('About') }));
vi.mock('../../components/admin/panels/AdminBlogPanel',         () => ({ AdminBlogPanel: stub('Blog') }));
vi.mock('../../components/admin/panels/AdminMessagesPanel',     () => ({ AdminMessagesPanel: stub('Messages') }));
vi.mock('../../components/admin/panels/AdminSettingsPanel',     () => ({ AdminSettingsPanel: stub('Settings') }));
vi.mock('../../components/admin/panels/AdminAnalyticsPanel',    () => ({ AdminAnalyticsPanel: stub('Analytics') }));
vi.mock('../../components/admin/panels/AdminEducationPanel',    () => ({ AdminEducationPanel: stub('Education') }));
vi.mock('../../components/admin/panels/AdminCertificatesPanel', () => ({ AdminCertificatesPanel: stub('Certificates') }));

const { AdminPage } = await import('../AdminPage');

function Where() {
  const { search } = useLocation();
  return <span data-testid="where">{search}</span>;
}
// A DATA router, as App.jsx's: the unsaved-changes guard's useBlocker needs one.
const renderAt = (at) => render(<RouterProvider router={createMemoryRouter(
  [{ path: '*', element: <><AdminPage /><Where /></> }],
  { initialEntries: [at] },
)} />);
const where = () => screen.getByTestId('where').textContent;

describe('AdminPage — the first tab and its address', () => {
  it('opens on the Overview', () => {
    renderAt('/admin');
    expect(screen.getByText('Overview panel')).toBeInTheDocument();
  });

  it('a reload with a message open comes back to Messages (PF-153)', () => {
    renderAt('/admin?message=m1');
    expect(screen.getByText('Messages panel')).toBeInTheDocument();
  });

  it('a reload on SENT, or with a sent reply open, comes back to Messages (PF-154)', () => {
    renderAt('/admin?box=sent&sent=s1');
    expect(screen.getByText('Messages panel')).toBeInTheDocument();
  });

  it('leaving Messages takes SENT\'s address with it', async () => {
    const user = userEvent.setup();
    renderAt('/admin?box=sent');
    await user.click(screen.getByRole('button', { name: 'Projects' }));
    expect(screen.getByText('Projects panel')).toBeInTheDocument();
    expect(where()).toBe('');
  });

  it('an unrelated address is left alone', async () => {
    const user = userEvent.setup();
    renderAt('/admin?x=1');
    await user.click(screen.getByRole('button', { name: 'Projects' }));
    expect(where()).toBe('?x=1');
  });
});
