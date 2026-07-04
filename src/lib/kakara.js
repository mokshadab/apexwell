// The Eight Inquiry Dimensions (Kakara)
// Universal across all domains. Used internally by AI and scoring.
// The framework name "Kakara" NEVER appears in student UI —
// only the UI labels below are shown.

// Ordered priority — AI selects the highest-priority uncovered
// dimension when generating a follow-up question.
export const PRIORITY = [
  'Purpose',
  'Cause',
  'Scale',
  'Timing',
  'Method',
  'Place',
  'Observation',
  'Growth',
];

// Dimension metadata: internal name (object key), student-facing
// UI label, icon, and the question each dimension addresses.
export const DIMENSIONS = {
  Observation: { label: 'Observation', icon: '🔍', asks: 'What exactly?' },
  Place: { label: 'Place', icon: '📍', asks: 'Where precisely?' },
  Scale: { label: 'Scale', icon: '🔢', asks: 'How many?' },
  Timing: { label: 'Timing', icon: '🕐', asks: 'When?' },
  Cause: { label: 'Cause', icon: '🌱', asks: 'What caused this?' },
  Method: { label: 'Method', icon: '⚗️', asks: 'How did you investigate?' },
  Purpose: { label: 'Purpose', icon: '🎯', asks: 'For what purpose?' },
  Growth: { label: 'Growth', icon: '🔄', asks: 'What changed in you?' },
};

// The eight dimension names in display order (for chips).
export const DIMENSION_NAMES = Object.keys(DIMENSIONS);

// Build a fresh, empty kakara object for a new Discovery.
// Every dimension starts uncovered.
export function emptyKakara() {
  const k = {};
  for (const name of DIMENSION_NAMES) {
    k[name] = { covered: false, how: 'pending', detail: null };
  }
  return k;
}

// Select the highest-priority dimension that is not yet covered.
// Returns 'Purpose' as a safe default if all are covered.
export function selectDimension(kakara) {
  if (!kakara) return 'Purpose';
  for (const dim of PRIORITY) {
    const entry = kakara[dim];
    if (!entry || entry.how === 'pending') {
      return dim;
    }
  }
  return 'Purpose';
}

// Chip status helper — returns 'covered' | 'asking' | 'pending'
// for a given dimension. `askingDim` is the dimension the AI is
// currently asking about (gold star in UI).
export function chipStatus(kakara, dim, askingDim) {
  if (dim === askingDim) return 'asking';
  const entry = kakara && kakara[dim];
  if (entry && entry.covered) return 'covered';
  return 'pending';
}

// Count how many dimensions are covered (for internal metrics).
export function coveredCount(kakara) {
  if (!kakara) return 0;
  return DIMENSION_NAMES.filter((d) => kakara[d] && kakara[d].covered).length;
}