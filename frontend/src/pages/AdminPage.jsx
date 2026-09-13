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
  const [activeTab, setActiveTab] = useState('overview');
  const ActivePanel = PANELS[activeTab] || AdminOverviewPanel;

  // PF-107. The flash provider wraps the layout rather than sitting
  // inside it, because the layout is what RENDERS the banner and a
  // panel is what raises it — they need a common ancestor holding the
  // state, and the layout cannot be its own ancestor.
  return (
    <AdminFlashProvider>
      <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
        <ActivePanel />
      </AdminLayout>
    </AdminFlashProvider>
  );
}