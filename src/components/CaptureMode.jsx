// CaptureMode — Moment 1 (in the field, 30 seconds).
// Nature domain only. No Kakara here (that's Reflect Mode).
//
// Flow (Section 4):
//   photo (rear camera) -> identify.js -> voice "I noticed..."
//   -> location (typed, with previously-used chips) -> Save.
//
// Dependencies built by Dad (storage.js / auth.js) and Vercel:
//   saveDiscovery(discovery)            -> creates doc, seeds history, returns id
//   getUserLocations(userId)            -> string[]
//   saveUserLocation(userId, location)  -> void
//   /api/identify.js                    -> species JSON (nature only)
//
// This file NEVER writes the history object directly. saveDiscovery
// seeds history at creation (Section 7). Later edits use writeField.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, storage } from '../lib/firebase.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  saveDiscovery,
  getUserLocations,
  saveUserLocation,
} from '../lib/storage.js';
import { emptyKakara } from '../lib/kakara.js';
import { colors, font, layout, radius, space } from '../constants/design.js';

// Derive the season from a Date (Northern Hemisphere).
function seasonOf(date) {
  const m = date.getMonth(); // 0-11
  if (m >= 2 && m <= 4) return 'Spring';
  if (m >= 5 && m <= 7) return 'Summer';
  if (m >= 8 && m <= 10) return 'Fall';
  return 'Winter';
}

export default function CaptureMode() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Photo + identification
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [identifying, setIdentifying] = useState(false);
  const [identification, setIdentification] = useState(null); // {species, scientificName, habitat, confidence, interesting}
  const [identifyMsg, setIdentifyMsg] = useState('');

  // Voice note
  const [noticed, setNoticed] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef(null);

  // Location
  const [location, setLocation] = useState('');
  const [knownLocations, setKnownLocations] = useState([]);

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load the user's previously-used locations for suggestion chips.
  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      try {
        const locs = await getUserLocations(user.uid);
        if (active) setKnownLocations(Array.isArray(locs) ? locs : []);
      } catch {
        // Non-fatal — just show no suggestions.
        if (active) setKnownLocations([]);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  // Feature-detect Web Speech API once.
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setNoticed((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  function toggleListening() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }

  // Photo captured from rear camera -> preview -> identify.
  async function handleCapture(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    await identify(file);
  }

  // Call /api/identify.js with the photo. Nature domain only.
  async function identify(file) {
    setIdentifying(true);
    setIdentifyMsg('Identifying your discovery…');
    setIdentification(null);
    try {
      const base64 = await fileToBase64(file);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // Section 28 timeout
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('identify failed');
      const data = await res.json();
      setIdentification(data);
      setIdentifyMsg(
        `AI identified: ${data.species} with ${data.confidence}% confidence. ${data.interesting || ''}`
      );
    } catch {
      // Never block the flow — let her name it herself later.
      setIdentifyMsg('Could not identify — you can name it yourself.');
    } finally {
      setIdentifying(false);
    }
  }

  // Build the full nested Discovery object (Section 7) and save.
  async function save(thenReflect) {
    if (!user) {
      setError('You must be signed in to save.');
      return;
    }
    setSaving(true);
    setError('');
    const now = new Date();
    try {
      // 1. Upload photo to Storage (if present); store URL, never base64.
      let evidence = { url: null, mimeType: null, type: null };
      if (photoFile) {
        const path = `discoveries/${user.uid}/${now.getTime()}.jpg`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, photoFile);
        const url = await getDownloadURL(sRef);
        evidence = { url, mimeType: photoFile.type, type: 'photo' };
      }

      const id = identification || {};
      const discovery = {
        userId: user.uid,
        visibility: 'private',
        reflectCompleted: false,
        domain: 'nature',
        system: {
          appVersion: '1.0.0',
          schemaVersion: '1.0',
          promptVersion: 'capture_v1',
          model: 'claude-haiku-4-5',
        },
        evidence,
        context: {
          type: 'field',
          species: id.species || null,
          scientificName: id.scientificName || null,
          habitat: id.habitat || null,
          confidence: typeof id.confidence === 'number' ? id.confidence : null,
          interesting: id.interesting || null,
          location: location.trim(),
          timestamp: now.toISOString(),
          season: seasonOf(now),
          aiCorrect: null,
          aiCorrected: false,
        },
        observation: { noticed: noticed.trim() },
        inquiry: { wondered: '', explored: '' },
        reflection: {
          discovered: '',
          myNewUnderstanding: '',
          nextIll: '',
          stillWonder: '',
        },
        kakara: emptyKakara(),
        insight: null,
      };

      // 2. Create the document (storage seeds history + number, returns id).
      const savedId = await saveDiscovery(discovery);

      // 3. Remember this location for future suggestion chips.
      if (location.trim()) {
        try {
          await saveUserLocation(user.uid, location.trim());
        } catch {
          // Non-fatal.
        }
      }

      // 4. Navigate onward.
      // Phase 1: ReflectMode does not exist yet — both paths go home.
      navigate('/');
      // Phase 2: navigate(`/reflect/${savedId}`)
    } catch (err) {
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  }

  const online = typeof navigator === 'undefined' ? true : navigator.onLine;

  // ---- styles ----
  const page = {
    minHeight: '100vh',
    background: colors.ink,
    color: colors.surface,
    fontFamily: font.family,
    paddingBottom: `calc(${layout.navHeight} + ${space.s6})`,
  };
  const bar = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.s4,
    gap: space.s3,
  };
  const closeBtn = {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    background: 'transparent',
    border: 'none',
    color: colors.surface,
    fontSize: font.sizeXl,
    cursor: 'pointer',
  };
  const section = { padding: `0 ${space.s4} ${space.s4}` };
  const label = {
    display: 'block',
    fontSize: font.sizeSm,
    color: colors.leaf,
    marginBottom: space.s2,
    fontWeight: font.weightSemi,
  };
  const input = {
    width: '100%',
    boxSizing: 'border-box',
    padding: space.s3,
    borderRadius: radius.md,
    border: `1px solid ${colors.rule}`,
    background: colors.surface,
    color: colors.ink,
    fontFamily: font.family,
    fontSize: font.sizeMd,
  };
  const chip = (active) => ({
    minHeight: layout.touchTarget,
    padding: `${space.s2} ${space.s3}`,
    marginRight: space.s2,
    marginTop: space.s2,
    borderRadius: radius.full,
    border: `1px solid ${active ? colors.moss : colors.rule}`,
    background: active ? colors.moss : 'transparent',
    color: active ? colors.surface : colors.leaf,
    fontFamily: font.family,
    fontSize: font.sizeSm,
    cursor: 'pointer',
  });
  const captureLabel = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    height: '260px',
    borderRadius: radius.lg,
    border: `2px dashed ${colors.sage}`,
    background: `linear-gradient(160deg, ${colors.forest}, ${colors.moss})`,
    color: colors.surface,
    cursor: 'pointer',
    overflow: 'hidden',
  };
  const micBtn = {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    padding: `${space.s2} ${space.s4}`,
    borderRadius: radius.full,
    border: 'none',
    background: listening ? colors.moss : colors.sage,
    color: colors.surface,
    fontFamily: font.family,
    fontSize: font.sizeBase,
    fontWeight: font.weightSemi,
    cursor: 'pointer',
    marginBottom: space.s2,
  };
  const saveRow = { display: 'flex', gap: space.s3, padding: space.s4 };
  const saveBtn = (primary) => ({
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    border: primary ? 'none' : `1px solid ${colors.sage}`,
    background: primary ? colors.forest : 'transparent',
    color: colors.surface,
    fontFamily: font.family,
    fontSize: font.sizeBase,
    fontWeight: font.weightSemi,
    cursor: saving ? 'default' : 'pointer',
    opacity: saving ? 0.6 : 1,
  });

  return (
    <main id="main-content" role="main" style={page}>
      <div style={bar}>
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Close and return home"
          style={closeBtn}
        >
          ✕
        </button>
        <h1 style={{ fontSize: font.sizeMd, margin: 0 }}>New Discovery</h1>
        <span style={{ width: layout.touchTarget }} aria-hidden="true" />
      </div>

      {!online && (
        <p style={{ ...section, color: colors.leaf, fontSize: font.sizeSm }}>
          📵 Saved locally — syncs when connected
        </p>
      )}

      {/* Photo capture */}
      <div style={section}>
        <label htmlFor="photo-capture" style={captureLabel}>
          <span className="sr-only">Take a photo of your discovery</span>
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Your discovery"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <>
              <span aria-hidden="true" style={{ fontSize: '2.5rem' }}>📷</span>
              <span style={{ fontSize: font.sizeBase }}>Tap to take a photo</span>
              <span style={{ fontSize: font.sizeSm, color: colors.leaf }}>
                or skip if there's nothing to photograph
              </span>
            </>
          )}
          <input
            id="photo-capture"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            style={{ display: 'none' }}
          />
        </label>

        {/* Identification status — live region for screen readers */}
        <div role="status" aria-live="polite" aria-atomic="true"
             style={{ marginTop: space.s3, minHeight: '1.5em' }}>
          {identifyMsg && (
            <p style={{ margin: 0, fontSize: font.sizeSm, color: colors.leaf }}>
              {identifying ? '…' : ''} {identifyMsg}
            </p>
          )}
          {identification && !identifying && (
            <p style={{ margin: `${space.s2} 0 0`, fontSize: font.sizeBase }}>
              <strong>{identification.species}</strong>
              {identification.scientificName ? ` · ${identification.scientificName}` : ''}
              {typeof identification.confidence === 'number'
                ? ` · High confidence (${identification.confidence}%)`
                : ''}
            </p>
          )}
        </div>
      </div>

      {/* Voice note — "I noticed..." */}
      <div style={section}>
        <label htmlFor="noticed-input" style={label}>
          👀 I noticed…
        </label>
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label="Record what you noticed"
            aria-pressed={listening}
            style={micBtn}
          >
            <span aria-hidden="true">🎤</span>{' '}
            {listening ? 'Listening…' : 'Tap to speak'}
          </button>
        )}
        <textarea
          id="noticed-input"
          value={noticed}
          onChange={(e) => setNoticed(e.target.value)}
          placeholder="I noticed…"
          rows={3}
          style={{ ...input, resize: 'vertical' }}
        />
        <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
          {listening ? 'Listening. Speak now.' : ''}
        </div>
      </div>

      {/* Location — typed, with previously-used chips */}
      <div style={section}>
        <label htmlFor="location-input" style={label}>
          📍 Location
        </label>
        <input
          id="location-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where are you?"
          style={input}
        />
        {knownLocations.length > 0 && (
          <div style={{ marginTop: space.s1 }}>
            {knownLocations.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocation(loc)}
                aria-label={`Use location ${loc}`}
                style={chip(location === loc)}
              >
                {loc}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" style={{ ...section, color: colors.leaf }}>
          {error}
        </p>
      )}

      {/* Save — two paths (Section 5) */}
      <div style={saveRow}>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving}
          style={saveBtn(false)}
        >
          {saving ? 'Saving…' : 'Save & Keep Exploring'}
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving}
          style={saveBtn(true)}
        >
          {saving ? 'Saving…' : 'Reflect Now →'}
        </button>
      </div>
    </main>
  );
}

// Convert a File to a base64 string (no data: prefix) for the API.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

