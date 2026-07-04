// App — auth wrapper + routing shell.
//
// Responsibilities:
//   - Watch Firebase auth state.
//   - Show a Google Sign-In gate when signed out.
//   - Compute isAdmin ONCE and pass it to BottomNav.
//   - Route the Phase 1 screens. Phase 2/3 routes are placeholders
//     so navigation never dead-ends.
//   - Provide accessibility landmarks (skip link, live regions).
//
// Auth helpers are Dad's file (src/lib/auth.js):
//   signInWithGoogle()  -> starts Google sign-in
//   signOutUser()       -> signs out
//   isAdminUser(user)   -> boolean (user.email === ADMIN_EMAIL)

import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase.js';
import { signInWithGoogle, isAdminUser } from './lib/auth.js';
import BottomNav from './components/BottomNav.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import CaptureMode from './components/CaptureMode.jsx';
import { colors, font, layout, radius, space } from './constants/design.js';

// Simple placeholder for routes that activate in later phases.
function Placeholder({ title, note }) {
  return (
    <main
      id="main-content"
      role="main"
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.ink,
        fontFamily: font.family,
        padding: space.s6,
        paddingBottom: `calc(${layout.navHeight} + ${space.s8})`,
      }}
    >
      <h1 style={{ fontSize: font.sizeXl, color: colors.forest }}>{title}</h1>
      <p style={{ fontSize: font.sizeBase, color: colors.muted }}>{note}</p>
    </main>
  );
}

// Sign-in gate shown when no user is authenticated.
function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch {
      setError('Sign-in failed. Please try again.');
      setBusy(false);
    }
  }

  return (
    <main
      id="main-content"
      role="main"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.s5,
        background: `linear-gradient(160deg, ${colors.forest}, ${colors.moss})`,
        color: colors.surface,
        fontFamily: font.family,
        padding: space.s6,
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: font.size2xl, margin: 0 }}>ApexWell 🌿</h1>
        <p style={{ fontSize: font.sizeBase, opacity: 0.9, marginTop: space.s2 }}>
          Learn from Reality. Flourish Through Discovery.
        </p>
      </div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        style={{
          minHeight: layout.touchTarget,
          padding: `${space.s3} ${space.s6}`,
          borderRadius: radius.md,
          border: 'none',
          background: colors.surface,
          color: colors.forest,
          fontFamily: font.family,
          fontSize: font.sizeBase,
          fontWeight: font.weightSemi,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && (
        <p role="alert" style={{ fontSize: font.sizeSm, opacity: 0.95 }}>
          {error}
        </p>
      )}
    </main>
  );
}

// The authenticated shell: active screen + bottom navigation.
function AppShell({ user }) {
  const admin = isAdminUser(user);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Global live regions (Section 24.4) */}
      <div id="polite-announce" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="assertive-announce" role="alert" aria-live="assertive" aria-atomic="true" className="sr-only" />

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/capture" element={<CaptureMode />} />
        <Route
          path="/journal"
          element={
            <Placeholder
              title="My Journal"
              note="Your journal activates in Phase 2, once you have a few field discoveries saved."
            />
          }
        />
        <Route
          path="/research"
          element={
            <Placeholder
              title="My Learning Journey"
              note="Your learning journey activates in Phase 3, after 30 discoveries."
            />
          }
        />
        {admin && (
          <Route
            path="/admin"
            element={
              <Placeholder
                title="Research Discovery"
                note="Admin research capture activates alongside the admin build."
              />
            }
          />
        )}
        {/* Unknown routes fall back home. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav isAdmin={admin} />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) {
    return (
      <main
        role="main"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bg,
          color: colors.muted,
          fontFamily: font.family,
        }}
      >
        Loading ApexWell…
      </main>
    );
  }

  return (
    <BrowserRouter>
      {user ? <AppShell user={user} /> : <SignIn />}
    </BrowserRouter>
  );
}

