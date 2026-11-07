import { useState }              from 'react';
import { useSearchParams }       from 'react-router-dom';
import { AdminLayout }           from '../components/admin/AdminLayout';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AdminFlashProvider }    from '../components/admin/AdminFlashProvider';
import { UnsavedChangesProvider } from '../components/admin/UnsavedChangesProvider';
import { AdminOverviewPanel }    from '../components/admin/panels/AdminOverviewPanel';
import { AdminProjectsPanel }    from '../components/admin/panels/AdminProjectsPanel';
import { AdminSkillsPanel }      from '../components/admin/panels/AdminSkillsPanel';
import { AdminAboutPanel }       from '../components/admin/panels/AdminAboutPanel';
import { AdminBlogPanel }        from '../components/admin/panels/AdminBlogPanel';
import { AdminMessagesPanel }    from '../components/admin/panels/AdminMessagesPanel';
import { AdminSettingsPanel }    from '../components/admin/panels/AdminSettingsPanel';
import { AdminAnalyticsPanel }   from '../components/admin/panels/AdminAnalyticsPanel';
import { AdminEducationPanel }   from '../components/admin/panels/AdminEducationPanel';     // PF-143
import { AdminCertificatesPanel } from '../components/admin/panels/AdminCertificatesPanel'; // PF-143

const PANELS = {
  overview:  AdminOverviewPanel,
  analytics: AdminAnalyticsPanel,
  projects:  AdminProjectsPanel,
  skills:    AdminSkillsPanel,
  about:     AdminAboutPanel,
  blog:      AdminBlogPanel,
  messages:  AdminMessagesPanel,
  education:    AdminEducationPanel,
  certificates: AdminCertificatesPanel,
  settings:  AdminSettingsPanel,
};

export function AdminPage() {
  // PF-110: `compose` travels with the tab. The Overview's `+ NEW POST`
  // sets it so the blog panel mounts with its editor open; a sidebar
  // click never does. It is read only where the blog panel is rendered
  // — the other panels mount with their create form already showing, so
  // for them the tab IS the action.
  // PF-153: a reload with a message open comes back to it. PF-154: and to SENT.
  const [params, setParams] = useSearchParams();
  const inMessages = params.has('message') || params.get('box') === 'sent';
  const [nav, setNav] = useState({ tab: inMessages ? 'messages' : 'overview', compose: false });
  const activeTab = nav.tab;
  const ActivePanel = PANELS[activeTab] || AdminOverviewPanel;

  // PF-154: leaving Messages leaves its address behind too, or a later reload
  // would open SENT instead of where the owner had moved on to.
  const goTab = (tab, compose) => {
    setNav({ tab, compose });
    if (tab !== 'messages' && params.get('box') === 'sent') setParams({}, { replace: true });
  };
  const onTabChange = (tab) => goTab(tab, false);
  const onNavigate  = (tab, { compose = false } = {}) => goTab(tab, compose);

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
      {/* PF-118 batch 2 — outside the layout for the same reason as the flash
          provider: the layout's sidebar ASKS and the panel ANSWERS (what is
          unsaved, how to save it), so both need it as an ancestor. */}
      <UnsavedChangesProvider>
        <AdminLayout activeTab={activeTab} onTabChange={onTabChange}>
          {/* PF-149: a crash in one panel keeps the menu, so the owner can move
              on. `key`: choosing another tab clears the failure. */}
          <ErrorBoundary key={activeTab}>{panel}</ErrorBoundary>
        </AdminLayout>
      </UnsavedChangesProvider>
    </AdminFlashProvider>
  );
}
