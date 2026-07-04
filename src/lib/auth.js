// auth.js — Google Sign-In helpers and the admin gate.
//
// Interface (consumed by App.jsx):
//   signInWithGoogle()  -> Promise, resolves on successful sign-in
//   signOutUser()       -> Promise, signs the user out
//   isAdminUser(user)   -> boolean (user.email === ADMIN_EMAIL)
//
// isAdmin is a UI gate only, NOT a security boundary (Section 27.2).
// Firestore/Storage rules are what actually protect data.

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { ADMIN_EMAIL } from '../constants/design.js';

const provider = new GoogleAuthProvider();

// Start Google sign-in. Returns the signed-in user credential.
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// Sign the current user out.
export async function signOutUser() {
  await signOut(auth);
}

// Admin check — email match only. One source of truth (design.js).
export function isAdminUser(user) {
  return !!user && user.email === ADMIN_EMAIL;
}
