// Inquiry Depth Score
// Five components, each 0-10. Final score = average.
// Applied to NATURE discoveries only.
//
// CRITICAL (Section 11): students NEVER see this as a score or
// achievement. It is calculated for teacher/researcher views only.
// If students optimize the score, extrinsic motivation re-enters
// through the back door. Keep this out of all student-facing UI.

// Helper: safely read a nested field value as a string.
function str(v) {
  return typeof v === 'string' ? v : '';
}

// C1 — Question Diversity: share of discoveries with a wondered field.
function questionDiversity(discoveries) {
  if (discoveries.length === 0) return 0;
  const filled = discoveries.filter(
    (d) => str(d.inquiry && d.inquiry.wondered).trim().length > 0
  ).length;
  return (filled / discoveries.length) * 10;
}

// C2 — Return Visits: share of discoveries whose explored text
// mentions returning. Scaled ×1.5, capped at 10.
function returnVisits(discoveries) {
  if (discoveries.length === 0) return 0;
  const returned = discoveries.filter((d) =>
    str(d.inquiry && d.inquiry.explored)
      .toLowerCase()
      .includes('return')
  ).length;
  return Math.min((returned / discoveries.length) * 1.5 * 10, 10);
}

// C3 — Experimentation: share of discoveries with a substantial
// explored field (more than 50 characters).
function experimentation(discoveries) {
  if (discoveries.length === 0) return 0;
  const experimented = discoveries.filter(
    (d) => str(d.inquiry && d.inquiry.explored).length > 50
  ).length;
  return (experimented / discoveries.length) * 10;
}

// C4 — Evidence Collection: share of discoveries with a
// discovered field filled.
function evidenceCollection(discoveries) {
  if (discoveries.length === 0) return 0;
  const filled = discoveries.filter(
    (d) => str(d.reflection && d.reflection.discovered).trim().length > 0
  ).length;
  return (filled / discoveries.length) * 10;
}

// C5 — Conceptual Change: share of discoveries with a
// myNewUnderstanding field. Scaled ×3, capped at 10.
// This is the most important signal — conceptual change.
function conceptualChange(discoveries) {
  if (discoveries.length === 0) return 0;
  const filled = discoveries.filter(
    (d) =>
      str(d.reflection && d.reflection.myNewUnderstanding).trim().length > 0
  ).length;
  return Math.min((filled / discoveries.length) * 3 * 10, 10);
}

// Compute the full Inquiry Depth Score from an array of
// nature discovery documents. Returns the five components and
// the averaged index. All values 0-10.
export function inquiryDepth(discoveries) {
  const list = Array.isArray(discoveries) ? discoveries : [];
  const c1 = questionDiversity(list);
  const c2 = returnVisits(list);
  const c3 = experimentation(list);
  const c4 = evidenceCollection(list);
  const c5 = conceptualChange(list);
  const index = (c1 + c2 + c3 + c4 + c5) / 5;

  return {
    questionDiversity: c1,
    returnVisits: c2,
    experimentation: c3,
    evidenceCollection: c4,
    conceptualChange: c5,
    index,
  };
}

// The single most important number for answering the research
// question: the count of discoveries with a new understanding.
// This one IS surfaced to students (as "New Understandings"),
// unlike the Inquiry Index itself.
export function newUnderstandingCount(discoveries) {
  const list = Array.isArray(discoveries) ? discoveries : [];
  return list.filter(
    (d) => str(d.reflection && d.reflection.myNewUnderstanding).trim().length > 0
  ).length;
}