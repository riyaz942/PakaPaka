import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './theme.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

// Scroll restoration is handled manually (see ContentList) since content
// loads asynchronously and the browser's automatic restore fires too early.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
