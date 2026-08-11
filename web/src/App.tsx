import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import ContentList from './pages/ContentList';
import Dashboard from './pages/Dashboard';
import ItemDetail from './pages/ItemDetail';

const NAV_LINKS = [
  { id: 'dashboard', label: 'Dashboard', to: '/', end: true },
  { id: 'content', label: 'Content', to: '/content', end: false },
] as const;

const NAV_PLACEHOLDERS = [
  { id: 'graph', label: 'Graph' },
  { id: 'audit', label: 'Audit' },
] as const;

export default function App() {
  const [reloadStatus, setReloadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleReload() {
    setReloadStatus('loading');
    try {
      const res = await fetch('/api/reload', { method: 'POST' });
      setReloadStatus(res.ok ? 'done' : 'error');
    } catch {
      setReloadStatus('error');
    } finally {
      setTimeout(() => setReloadStatus('idle'), 2000);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Curriculum Studio</h1>
        <nav className="app-nav" aria-label="Primary">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link--active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
          {NAV_PLACEHOLDERS.map((item) => (
            <button key={item.id} type="button" className="nav-link" disabled>
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="app-header__reload" onClick={handleReload} disabled={reloadStatus === 'loading'}>
          {reloadStatus === 'loading' ? 'Reloading…' : reloadStatus === 'done' ? 'Reloaded ✓' : reloadStatus === 'error' ? 'Reload failed' : 'Reload from disk'}
        </button>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/content" element={<Navigate to="/content/radical" replace />} />
          <Route path="/content/:type" element={<ContentList />} />
          <Route path="/content/:type/:slug" element={<ItemDetail />} />
        </Routes>
      </main>
    </div>
  );
}
