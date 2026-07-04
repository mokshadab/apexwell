// storage.js — Firestore data layer for ApexWell. Domain-aware.
//
// Interface (consumed by CaptureMode.jsx and HomeScreen.jsx):
//   saveDiscovery(discovery)            -> Promise<string> (new doc id)
//   getDiscoveries(userId, domain)      -> Promise<object[]> (each has d.id)
//   writeField(ref, path, value, source)-> Promise (current value + history)
//   updateDiscovery(id, updates)        -> Promise (non-trackable fields only)
//   getUserLocations(userId)            -> Promise<string[]>
//   saveUserLocation(userId, location)  -> Promise
//
// Schema (Section 7): current values are plain strings/numbers in their
// normal location. Revision history lives in a separate top-level
// `history` object that MIRRORS the document's nesting, so the same
// dot-path works for both the live update and the history push.

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase.js';

const DISCOVERIES = 'discoveries';

// -------------------------------------------------------------------
// History seeding.
// On creation, seed one initial {value, timestamp, source} entry per
// trackable field — the same shape writeField() pushes later.
// Two categories are tracked (Section 7):
//   1. Learning fields (evolving thinking)
//   2. Correctable metadata (AI suggests, gets corrected)
// NOT tracked: context.type, context.timestamp, context.season.
// -------------------------------------------------------------------
function seedHistory(d, iso) {
  const entry = (value, source) => [{ value, timestamp: iso, source }];
  const ctx = d.context || {};
  const obs = d.observation || {};
  const inq = d.inquiry || {};
  const ref = d.reflection || {};

  return {
    context: {
      species: entry(ctx.species ?? null, 'ai'),
      scientificName: entry(ctx.scientificName ?? null, 'ai'),
      habitat: entry(ctx.habitat ?? null, 'ai'),
      location: entry(ctx.location ?? '', 'voice'),
      confidence: entry(ctx.confidence ?? null, 'ai'),
      aiCorrect: entry(ctx.aiCorrect ?? null, 'ai'),
      aiCorrected: entry(ctx.aiCorrected ?? false, 'ai'),
    },
    observation: {
      noticed: entry(obs.noticed ?? '', 'voice'),
    },
    inquiry: {
      wondered: entry(inq.wondered ?? '', 'voice'),
      explored: entry(inq.explored ?? '', 'voice'),
    },
    reflection: {
      discovered: entry(ref.discovered ?? '', 'ai_organized'),
      myNewUnderstanding: entry(ref.myNewUnderstanding ?? '', 'student_edit'),
      nextIll: entry(ref.nextIll ?? '', 'student_edit'),
      stillWonder: entry(ref.stillWonder ?? '', 'voice'),
    },
    insight: entry(d.insight ?? null, 'ai_suggested'),
  };
}

// Assign the next sequential display number for this user's domain.
// Simple count-based approach — fine for a single user (Phase 1).
async function nextNumber(userId, domain) {
  const q = query(
    collection(db, DISCOVERIES),
    where('userId', '==', userId),
    where('domain', '==', domain)
  );
  const snap = await getDocs(q);
  return snap.size + 1;
}

// Create a Discovery document. Seeds history + number + timestamps.
// Returns the new document id.
export async function saveDiscovery(discovery) {
  const iso = new Date().toISOString();
  const number = await nextNumber(discovery.userId, discovery.domain || 'nature');

  const docData = {
    ...discovery,
    number,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: seedHistory(discovery, iso),
  };

  const created = await addDoc(collection(db, DISCOVERIES), docData);
  return created.id;
}

// Fetch all discoveries for a user in a domain. Each returned object
// includes its Firestore document id as `id` (required by HomeScreen).
export async function getDiscoveries(userId, domain) {
  const q = query(
    collection(db, DISCOVERIES),
    where('userId', '==', userId),
    where('domain', '==', domain)
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

// Read a single discovery by id (returns object with id, or null).
export async function getDiscovery(id) {
  const snap = await getDoc(doc(db, DISCOVERIES, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// The ONE shared write helper for every trackable field — learning or
// correctable metadata. Updates the current value AND pushes a history
// entry in the same operation (Section 7). Never call updateDoc directly
// for these fields.
export function writeField(discoveryRef, path, value, source) {
  return updateDoc(discoveryRef, {
    [path]: value,
    [`history.${path}`]: arrayUnion({
      value,
      timestamp: new Date().toISOString(),
      source,
    }),
    updatedAt: serverTimestamp(),
  });
}

// Update NON-trackable fields only (reflectCompleted, number, etc.).
// Do not use this for trackable fields — use writeField.
export function updateDiscovery(id, updates) {
  return updateDoc(doc(db, DISCOVERIES, id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// -------------------------------------------------------------------
// User locations — a per-user list of previously-used location strings,
// stored at users/{userId} with a `locations` array (Section correction
// made this session). Used by CaptureMode for suggestion chips.
// -------------------------------------------------------------------
function userRef(userId) {
  return doc(db, 'users', userId);
}

// Return the user's saved locations as an array of strings.
export async function getUserLocations(userId) {
  const snap = await getDoc(userRef(userId));
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data.locations) ? data.locations : [];
}

// Add a location to the user's list (de-duplicated, no empty strings).
export async function saveUserLocation(userId, location) {
  const clean = (location || '').trim();
  if (!clean) return;
  await setDoc(
    userRef(userId),
    { locations: arrayUnion(clean) },
    { merge: true }
  );
}

