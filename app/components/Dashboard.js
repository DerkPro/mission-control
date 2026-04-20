'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ABTestPanel from './ABTestPanel';
import AnalyticsPanel from './AnalyticsPanel';
import ContactsPanel from './ContactsPanel';
import DataHealthPanel from './DataHealthPanel';
import EmailPanel from './EmailPanel';
import ProspectorPanel from './ProspectorPanel';
import SavedSearchesPanel from './SavedSearchesPanel';
import SequencesPanel from './SequencesPanel';
import WarmupPanel from './WarmupPanel';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'contacts', label: 'Contacts', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'email', label: 'Email Studio', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'sequences', label: 'Sequences', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'abtest', label: 'A/B Tests', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'warmup', label: 'Warmup', icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z' },
  { id: 'prospector', label: 'Prospector', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'health', label: 'Data Health', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'saved', label: 'Smart Lists', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  contacts: 'Contacts',
  email: 'Email Studio',
  sequences: 'Sequences',
  abtest: 'A/B Tests',
  warmup: 'Warmup',
  prospector: 'Prospector',
  health: 'Data Health',
  saved: 'Smart Lists',
};

function NavIcon({ path }) {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      {dark ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function Dashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentDate = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
    []
  );

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const onDataChange = useCallback(() => setRefreshKey(key => key + 1), []);

  const handleNavigate = useCallback(pageId => {
    setActivePage(pageId);
    setRefreshKey(key => key + 1);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  let activePanel;
  switch (activePage) {
    case 'contacts':
      activePanel = <ContactsPanel key={refreshKey} showToast={showToast} onDataChange={onDataChange} />;
      break;
    case 'email':
      activePanel = <EmailPanel key={refreshKey} showToast={showToast} onDataChange={onDataChange} />;
      break;
    case 'sequences':
      activePanel = <SequencesPanel key={refreshKey} showToast={showToast} />;
      break;
    case 'abtest':
      activePanel = <ABTestPanel key={refreshKey} showToast={showToast} />;
      break;
    case 'warmup':
      activePanel = <WarmupPanel key={refreshKey} showToast={showToast} />;
      break;
    case 'prospector':
      activePanel = <ProspectorPanel key={refreshKey} showToast={showToast} onDataChange={onDataChange} />;
      break;
    case 'health':
      activePanel = <DataHealthPanel key={refreshKey} showToast={showToast} onDataChange={onDataChange} />;
      break;
    case 'saved':
      activePanel = <SavedSearchesPanel key={refreshKey} showToast={showToast} />;
      break;
    case 'dashboard':
    default:
      activePanel = <AnalyticsPanel key={refreshKey} />;
      break;
  }

  return (
    <div className="app-layout">
      <aside className="sidebar-shell">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark-core" />
          </div>
          <div className="sidebar-brand-copy">
            <div className="sidebar-logo">Mission Control</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleNavigate(item.id)}
            >
              <span className="sidebar-icon-wrap">
                <NavIcon path={item.icon} />
              </span>
              <span className="sidebar-link-copy">
                <span className="sidebar-link-label">{item.label}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="sidebar-footnote">{currentDate}</p>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-toolbar">
          <div className="mobile-toolbar-header">
            <div className="mobile-brand">Mission Control</div>
            <ThemeToggle />
          </div>
          <div className="mobile-nav-scroll" aria-label="Mobile navigation">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                className={`mobile-nav-button ${activePage === item.id ? 'active' : ''}`}
                onClick={() => handleNavigate(item.id)}
              >
                <NavIcon path={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <header style={{ marginBottom: '20px' }}>
          <h1 className="hero-title">{PAGE_TITLES[activePage]}</h1>
        </header>

        <section>{activePanel}</section>
      </main>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
