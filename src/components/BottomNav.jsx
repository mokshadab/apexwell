// BottomNav — fixed bottom navigation, shared across screens.
// Four student tabs. A fifth Admin tab appears only when isAdmin.
// Accessibility (Section 24): nav landmark, aria-current for the
// active tab, emoji hidden from screen readers, 44px touch targets.

import { useNavigate, useLocation } from 'react-router-dom';
import { colors, font, layout, space } from '../constants/design.js';

const STUDENT_TABS = [
  { path: '/', emoji: '🏠', label: 'Home' },
  { path: '/capture', emoji: '📷', label: 'Capture' },
  { path: '/journal', emoji: '📚', label: 'Journal' },
  { path: '/research', emoji: '🔬', label: 'My Journey' },
];

const ADMIN_TAB = { path: '/admin', emoji: '⚙️', label: 'Admin Research' };

export default function BottomNav({ isAdmin = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = isAdmin ? [...STUDENT_TABS, ADMIN_TAB] : STUDENT_TABS;

  const navStyle = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    height: layout.navHeight,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'stretch',
    background: colors.surface,
    borderTop: `1px solid ${colors.rule}`,
    zIndex: 50,
  };

  const itemStyle = (active) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: active ? colors.forest : colors.muted,
    fontFamily: font.family,
    fontSize: font.sizeXs,
    fontWeight: active ? font.weightSemi : font.weightNormal,
    padding: `${space.s1} 0`,
  });

  return (
    <nav aria-label="Main navigation" style={navStyle}>
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={itemStyle(active)}
          >
            <span aria-hidden="true" style={{ fontSize: font.sizeLg }}>
              {tab.emoji}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}