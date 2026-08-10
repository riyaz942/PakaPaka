const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'content', label: 'Content' },
  { id: 'graph', label: 'Graph' },
  { id: 'audit', label: 'Audit' },
] as const;

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Curriculum Studio</h1>
        <nav className="app-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" className="nav-link" disabled>
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <p className="placeholder">
          Local curriculum debug tool. Chunk 1 scaffold is live — content views
          come next.
        </p>
      </main>
    </div>
  );
}
