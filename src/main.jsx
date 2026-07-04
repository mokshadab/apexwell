// main.jsx — application entry point.
// Mounts <App /> into #root. Imports global stylesheets so design
// tokens and accessibility rules apply everywhere.
//
// Style files (Section 22 / Section 24) live in src/styles/ and are
// part of the design-system build. If any are not yet present, remove
// its import line until it exists — the app still runs without them,
// but .sr-only and .skip-link visual hiding depend on them.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Global styles — order matters: tokens first, then base, then a11y.
import './styles/tokens.css';
import './styles/globals.css';
import './styles/accessibility.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
