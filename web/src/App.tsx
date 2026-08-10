import Dashboard from './pages/Dashboard';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', active: true },
  { id: 'content', label: 'Content', active: false },
  { id: 'graph', label: 'Graph', active: false },
  { id: 'audit', label: 'Audit', active: false },
] as const;

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Curriculum Studio</h1>
        <nav className="app-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                item.active ? 'nav-link nav-link--active' : 'nav-link'
              }
              disabled={!item.active}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  );
}
