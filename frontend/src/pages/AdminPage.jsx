import { useState }              from 'react';
import { AdminLayout }           from '../components/admin/AdminLayout';
import { AdminFlashProvider }    from '../components/admin/AdminFlashProvider';
import { AdminOverviewPanel }    from '../components/admin/panels/AdminOverviewPanel';
import { AdminProjectsPanel }    from '../components/admin/panels/AdminProjectsPanel';
import { AdminSkillsPanel }      from '../components/admin/panels/AdminSkillsPanel';
import { AdminAboutPanel }       from '../components/admin/panels/AdminAboutPanel';
import { AdminBlogPanel }        from '../components/admin/panels/AdminBlogPanel';
import { AdminMessagesPanel }    from '../components/admin/panels/AdminMessagesPanel';

const PANELS = {
  overview:  AdminOverviewPanel,
  projects:  AdminProjectsPanel,
  skills:    AdminSkillsPanel,
  about:     AdminAboutPanel,
  blog:      AdminBlogPanel,
  messages:  AdminMessagesPanel,
};

export function AdminPage() {
  // PF-110: `compose` travels with the tab. The Overview's `+ NEW POST`
  // sets it so the blog panel mounts with its editor open; a sidebar
  // click never does. It is read only where the blog panel is rendered
  // — the other panels mount with their create form already showing, so
  // for them the tab IS the action.
  const [nav, setNav] = useState({ tab: 'overview', compose: false });
  const activeTab = nav.tab;
  const ActivePanel = PANELS[activeTab] || AdminOverviewPanel;

  const onTabChange = (tab) => setNav({ tab, compose: false });
  const onNavigate  = (tab, { compose = false } = {}) => setNav({ tab, compose });

  const panel =
    activeTab === 'overview' ? <AdminOverviewPanel onNavigate={onNavigate} /> :
    activeTab === 'blog'     ? <AdminBlogPanel initialView={nav.compose ? 'edit' : 'list'} /> :
    <ActivePanel />;

  // PF-107. The flash provider wraps the layout rather than sitting
  // inside it, because the layout is what RENDERS the banner and a
  // panel is what raises it — they need a common ancestor holding the
  // state, and the layout cannot be its own ancestor.
  return (
    <AdminFlashProvider>
      <AdminLayout activeTab={activeTab} onTabChange={onTabChange}>
        {panel}
      </AdminLayout>
    </AdminFlashProvider>
  );
}