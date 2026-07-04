// HomeScreen — the return to Observe.
// Hero greeting, two hero metrics + two secondary (Section 10),
// the Continuity Engine card ("Yesterday you wondered..."),
// two action buttons, and a recent discoveries list.
//
// CRITICAL (Section 11): the Inquiry Index is NEVER shown here.
// Students see counts as narrative, never as a competitive score.
//
// Reads NATURE discoveries only via getDiscoveries(userId, 'nature'),
// so everything derived below is already domain-filtered.
//
// Storage interface requirement: getDiscoveries(userId, domain) must
// return objects that each include the Firestore document id as d.id.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase.js';
import { getDiscoveries } from '../lib/storage.js';
import { newUnderstandingCount } from '../lib/inquiryDepth.js';
import { colors, font, layout, radius, space, shadow } from '../constants/design.js';

// First name from a display name or email, for the greeting.
function firstName(user) {
  if (!user) return 'there';
  if (user.displayName) return user.displayName.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return 'there';
}

// Time-of-day greeting.
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function str(v) {
  return typeof v === 'string' ? v : '';
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const list = await getDiscoveries(user.uid, 'nature');
        if (active) setDiscoveries(Array.isArray(list) ? list : []);
      } catch {
        if (active) setDiscoveries([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  // --- derived counts (narrative, never a score) ---
  const total = discoveries.length;
  const understandings = newUnderstandingCount(discoveries);
  const openQuestions = discoveries.filter(
    (d) => str(d.reflection && d.reflection.stillWonder).trim().length > 0
  ).length;
  const returnVisits = discoveries.filter((d) =>
    str(d.inquiry && d.inquiry.explored).toLowerCase().includes('return')
  ).length;
  const incompleteReflections = discoveries.filter(
    (d) => !d.reflectCompleted
  ).length;

  // Most recent discovery (by timestamp) for the Continuity Engine card.
  const sorted = [...discoveries].sort((a, b) => {
    const ta = str(a.context && a.context.timestamp);
    const tb = str(b.context && b.context.timestamp);
    return tb.localeCompare(ta);
  });
  const latest = sorted[0] || null;
  const yesterdayWonder = latest
    ? str(latest.reflection && latest.reflection.stillWonder).trim() ||
      str(latest.inquiry && latest.inquiry.wondered).trim()
    : '';
  const yesterdayLocation = latest
    ? str(latest.context && latest.context.location).trim()
    : '';

  const recent = sorted.slice(0, 5);

  // ---- styles ----
  const page = {
    minHeight: '100vh',
    background: colors.bg,
    color: colors.ink,
    fontFamily: font.family,
    paddingBottom: `calc(${layout.navHeight} + ${space.s8})`,
  };
  const hero = {
    background: `linear-gradient(160deg, ${colors.forest}, ${colors.moss})`,
    color: colors.surface,
    padding: `${space.s8} ${space.s5} ${space.s6}`,
  };
  const heroDate = {
    fontSize: font.sizeSm,
    opacity: 0.85,
    margin: 0,
  };
  const heroMetrics = {
    display: 'flex',
    gap: space.s4,
    marginTop: space.s5,
  };
  const heroMetric = {
    flex: 1,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: radius.lg,
    padding: space.s4,
  };
  const heroNum = { fontSize: font.size2xl, fontWeight: font.weightBold, lineHeight: 1 };
  const heroLbl = { fontSize: font.sizeSm, opacity: 0.9, marginTop: space.s1 };
  const secRow = { display: 'flex', gap: space.s4, marginTop: space.s3 };
  const secMetric = {
    flex: 1,
    display: 'flex',
    alignItems: 'baseline',
    gap: space.s2,
    fontSize: font.sizeSm,
    opacity: 0.95,
  };

  const body = { padding: space.s5 };
  const wonderCard = {
    background: colors.surface,
    borderLeft: `4px solid ${colors.gold}`,
    borderRadius: radius.md,
    boxShadow: shadow.sm,
    padding: space.s4,
    marginBottom: space.s5,
  };
  const actionRow = { display: 'flex', gap: space.s3, marginBottom: space.s6 };
  const actionBtn = (primary) => ({
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    border: primary ? 'none' : `1px solid ${colors.forest}`,
    background: primary ? colors.forest : 'transparent',
    color: primary ? colors.surface : colors.forest,
    fontFamily: font.family,
    fontSize: font.sizeBase,
    fontWeight: font.weightSemi,
    cursor: 'pointer',
  });
  const recentCard = {
    display: 'flex',
    alignItems: 'center',
    gap: space.s3,
    background: colors.surface,
    borderRadius: radius.md,
    boxShadow: shadow.sm,
    padding: space.s3,
    marginBottom: space.s3,
    width: '100%',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  };
  const thumb = {
    width: '48px',
    height: '48px',
    borderRadius: radius.sm,
    objectFit: 'cover',
    flexShrink: 0,
    background: colors.leaf,
  };
  const badge = {
    fontSize: font.sizeXs,
    color: colors.purple,
    fontWeight: font.weightSemi,
  };

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main id="main-content" role="main" style={page}>
      {/* Hero */}
      <header style={hero}>
        <p style={heroDate}>{dateStr}</p>
        <h1 style={{ fontSize: font.sizeXl, margin: `${space.s1} 0 0` }}>
          {greeting()}, {firstName(user)} 🌿
        </h1>
        <p style={{ fontSize: font.sizeBase, opacity: 0.9, margin: `${space.s2} 0 0` }}>
          You've been changing how you see the world.
        </p>

        {/* Two hero metrics */}
        <div style={heroMetrics}>
          <div
            style={heroMetric}
            role="region"
            aria-label={`${total} Discoveries`}
            aria-live="polite"
          >
            <div style={heroNum} aria-hidden="true">🌿 {total}</div>
            <div style={heroLbl} aria-hidden="true">Discoveries</div>
          </div>
          <div
            style={heroMetric}
            role="region"
            aria-label={`${understandings} New Understandings`}
            aria-live="polite"
          >
            <div style={heroNum} aria-hidden="true">💡 {understandings}</div>
            <div style={heroLbl} aria-hidden="true">New Understandings</div>
          </div>
        </div>

        {/* Two secondary metrics */}
        <div style={secRow}>
          <div style={secMetric} aria-label={`${openQuestions} Open Questions`}>
            <span aria-hidden="true">❓ {openQuestions} Open Questions</span>
          </div>
          <div style={secMetric} aria-label={`${returnVisits} Return visits`}>
            <span aria-hidden="true">🔄 {returnVisits} Return visits</span>
          </div>
        </div>
      </header>

      <div style={body}>
        {/* Continuity Engine — "Yesterday you wondered..." */}
        {yesterdayWonder && (
          <section style={wonderCard} aria-label="Yesterday you wondered">
            <p style={{ margin: 0, fontSize: font.sizeSm, color: colors.muted }}>
              🌙 Yesterday you wondered…
            </p>
            <p style={{ margin: `${space.s2} 0`, fontStyle: 'italic', color: colors.ink }}>
              {yesterdayWonder}
            </p>
            <p style={{ margin: 0, fontSize: font.sizeSm, color: colors.muted }}>
              {yesterdayLocation ? `${yesterdayLocation} · ` : ''}Maybe today you'll find out.
            </p>
          </section>
        )}

        {/* Actions */}
        <div style={actionRow}>
          <button
            type="button"
            onClick={() => navigate('/capture')}
            style={actionBtn(true)}
          >
            New Discovery
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={actionBtn(false)}
            aria-label={
              incompleteReflections > 0
                ? `Reflect — ${incompleteReflections} ready to reflect`
                : 'Reflect'
            }
          >
            {incompleteReflections > 0
              ? `Reflect · ${incompleteReflections} →`
              : 'Reflect'}
          </button>
          {/* Phase 2: navigate('/journal') */}
        </div>

        {/* Recent discoveries */}
        <h2 style={{ fontSize: font.sizeLg, color: colors.forest, margin: `0 0 ${space.s3}` }}>
          Recent Discoveries
        </h2>

        {loading && (
          <p style={{ color: colors.muted, fontSize: font.sizeBase }}>Loading…</p>
        )}

        {!loading && recent.length === 0 && (
          <p style={{ color: colors.muted, fontSize: font.sizeBase }}>
            No discoveries yet. Tap <strong>New Discovery</strong> to begin.
          </p>
        )}

        {/* Phase 2: navigate(`/discovery/${detailId}`) */}
        {!loading &&
          recent.map((d) => {
            const species = str(d.context && d.context.species) || 'Unnamed discovery';
            const loc = str(d.context && d.context.location);
            const ts = str(d.context && d.context.timestamp);
            const dateLabel = ts
              ? new Date(ts).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '';
            const hasUnderstanding =
              str(d.reflection && d.reflection.myNewUnderstanding).trim().length > 0;
            const photo = d.evidence && d.evidence.url;
            const detailId = d.id || '';
            return (
              <button
                key={detailId || species + ts}
                type="button"
                onClick={() => navigate('/')}
                style={recentCard}
                aria-label={`${species} at ${loc || 'unknown location'}${
                  hasUnderstanding ? ', new understanding recorded' : ''
                }`}
              >
                {photo ? (
                  <img src={photo} alt="" aria-hidden="true" style={thumb} />
                ) : (
                  <span aria-hidden="true" style={{ ...thumb, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🌿
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: font.weightSemi }}>
                    {species}
                  </span>
                  <span style={{ display: 'block', fontSize: font.sizeSm, color: colors.muted }}>
                    {loc}{loc && dateLabel ? ' · ' : ''}{dateLabel}
                  </span>
                  {hasUnderstanding && (
                    <span style={badge}>💡 New Understanding</span>
                  )}
                </span>
                <span aria-hidden="true" style={{ color: colors.muted }}>›</span>
              </button>
            );
          })}
      </div>
    </main>
  );
}

