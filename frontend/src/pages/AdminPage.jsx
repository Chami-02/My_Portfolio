import { useState }              from 'react';
import { AdminLayout }           from '../components/admin/AdminLayout';
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

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <ActivePanel />
    </AdminLayout>
  );
}