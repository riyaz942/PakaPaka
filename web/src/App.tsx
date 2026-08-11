import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Audit from './pages/Audit';
import ContentList from './pages/ContentList';
import Dashboard from './pages/Dashboard';
import Graph from './pages/Graph';
import Guide from './pages/Guide';
import ItemDetail from './pages/ItemDetail';
import Pipeline from './pages/Pipeline';
import type { PipelineRunResult } from './types/api';

const NAV_LINKS = [
  { id: 'dashboard', label: 'Dashboard', to: '/', end: true },
  { id: 'content', label: 'Content', to: '/content', end: false },
  { id: 'graph', label: 'Graph', to: '/graph', end: false },
  { id: 'audit', label: 'Audit', to: '/audit', end: false },
  { id: 'pipeline', label: 'Pipeline', to: '/pipeline', end: false },
  { id: 'guide', label: 'Guide', to: '/guide', end: false },
] as const;

export default function App() {
  const [reloadStatus, setReloadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [validateStatus, setValidateStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

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

  async function handleValidate() {
    setValidateStatus('loading');
    try {
      const res = await fetch('/api/pipeline/validate', { method: 'POST' });
      const body = (await res.json()) as PipelineRunResult;
      setValidateStatus(body.ok ? 'ok' : 'error');
    } catch {
      setValidateStatus('error');
    } finally {
      setTimeout(() => setValidateStatus('idle'), 3000);
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
        </nav>
        <button
          type="button"
          className={
            validateStatus === 'ok'
              ? 'app-header__validate app-header__validate--ok'
              : validateStatus === 'error'
                ? 'app-header__validate app-header__validate--error'
                : 'app-header__validate'
          }
          onClick={handleValidate}
          disabled={validateStatus === 'loading'}
        >
          {validateStatus === 'loading'
            ? 'Validating…'
            : validateStatus === 'ok'
              ? 'Valid ✓'
              : validateStatus === 'error'
                ? 'Invalid ✗'
                : 'Validate'}
        </button>
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
          <Route path="/graph" element={<Graph />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/guide" element={<Guide />} />
        </Routes>
      </main>
    </div>
  );
}
