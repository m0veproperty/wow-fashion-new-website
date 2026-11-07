/**
 * Wow Fashion product-sourcing rubric v1.
 * These weights and thresholds are house defaults, not AliExpress standards.
 * This module is pure and can be imported by a browser or by Node.js.
 */

export const SCORING_VERSION = '1.0';

export const scoringDefaults = Object.freeze({
  priorRating: 4.2,
  priorReviews: 50,
  soldCap: 5000,
  minimumRating: 4.5,
  minimumReviews: 50,
  minimumSold: 100,
  freshnessDays: 14,
});

const gradeOptions = [
  { value: '', label: 'Not verified' },
  { value: '0', label: '0 · Confirmed serious issue' },
  { value: '1', label: '1 · Weak evidence / concerns' },
  { value: '2', label: '2 · Limited or mixed' },
  { value: '3', label: '3 · Adequate evidence' },
  { value: '4', label: '4 · Strong evidence' },
  { value: '5', label: '5 · Well corroborated' },
];

/** Field definitions for a manual, evidence-led candidate form. */
export const scoringFields = [
  { id: 'rating', key: 'rating', label: 'Product rating', type: 'number', min: 1, max: 5, step: 0.1, help: 'Displayed item rating out of five. Leave blank if unavailable.' },
  { id: 'reviews', key: 'reviews', label: 'Rating responses', type: 'number', min: 0, step: 1, help: 'Count supporting that star rating. Do not substitute the store rating or an unrelated written-review count.' },
  { id: 'sold', key: 'sold', label: 'Displayed sold count', type: 'text', help: 'Keep the original label, such as 1,000+ or 2.5k+. Rounded counts are lower bounds.' },
  { id: 'recentReviewScore', key: 'recentReviewScore', label: 'Recent review evidence', type: 'select', options: gradeOptions, help: 'Grade 0-5 using the rubric and documented review sample. Unknown stays blank.' },
  { id: 'sellerScore', key: 'sellerScore', label: 'Seller evidence', type: 'select', options: gradeOptions, help: 'Grade 0-5 using recorded store, communication and sample evidence.' },
  { id: 'specificationScore', key: 'specificationScore', label: 'Fit and specification clarity', type: 'select', options: gradeOptions, help: 'Grade 0-5 using composition, garment measurements, care and construction evidence.' },
  { id: 'valueScore', key: 'valueScore', label: 'Comparable landed value', type: 'select', options: gradeOptions, help: 'Grade 0-5 against comparable selected variants, shipping and visible tax.' },
  { id: 'deliveryScore', key: 'deliveryScore', label: 'Delivery and returns clarity', type: 'select', options: gradeOptions, help: 'Grade 0-5 for the selected item and actual destination. Estimates remain estimates.' },
  { id: 'evidenceDate', key: 'evidenceDate', label: 'Evidence checked', type: 'date', help: 'Use the date the listing and seller evidence were actually checked. Refresh after 14 days.' },
  { id: 'destination', key: 'destination', label: 'Delivery destination', type: 'text', help: 'Country, plus postal area where it affects availability or cost.' },
  { id: 'sourceUrl', key: 'sourceUrl', label: 'Product source URL', type: 'url', help: 'The exact product listing inspected, with selected variant recorded in the research notes.' },
  { id: 'price', key: 'price', label: 'Selected variant price', type: 'number', min: 0, step: 0.01, help: 'Observed price in the chosen currency. Unknown is not zero.' },
  { id: 'shipping', key: 'shipping', label: 'Shipping cost', type: 'number', min: 0, step: 0.01, help: 'Enter 0 only for verified free shipping to this destination. Record unknown tax separately.' },
  { id: 'currency', key: 'currency', label: 'Currency', type: 'text', help: 'Three-letter currency code, such as USD, GBP or EUR.' },
  { id: 'hardGate', key: 'hardGate', label: 'Critical checks', type: 'select', options: [
    { value: 'review', label: 'Review required' },
    { value: 'clear', label: 'All critical checks reviewed and clear' },
    { value: 'reject', label: 'Critical check failed' },
  ], help: 'Availability, destination, identity, essential specifications and serious unresolved issues must be checked. A score does not clear these automatically.' },
  { id: 'gateNotes', key: 'gateNotes', label: 'Evidence and check notes', type: 'textarea', help: 'Record sources, exact variant, review sample, date scope, grade reasons and any concerns. No private credentials or payment information.' },
];

const qualitativeComponents = [
  { id: 'recentReviews', field: 'recentReviewScore', label: 'Recent review evidence', weight: 15 },
  { id: 'seller', field: 'sellerScore', label: 'Seller evidence', weight: 15 },
  { id: 'specs', field: 'specificationScore', label: 'Fit and specification clarity', weight: 10 },
  { id: 'value', field: 'valueScore', label: 'Comparable landed value', weight: 10 },
  { id: 'fulfilment', field: 'deliveryScore', label: 'Delivery and returns clarity', weight: 5 },
];

const DAY = 86400000;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round = (n, places = 2) => Number(n.toFixed(places));
const present = (v) => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim());
const text = (v) => typeof v === 'string' ? v.trim() : '';

function numberValue(value, { min = 0, max = Infinity, integer = false } = {}) {
  if (!present(value) || !['number', 'string'].includes(typeof value)) return null;
  if (typeof value === 'string' && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isSafeInteger(n))) return null;
  return n;
}

function soldValue(value) {
  if (typeof value === 'number') return numberValue(value, { integer: true });
  if (typeof value !== 'string' || !value.trim()) return null;
  // Accept ordinary marketplace labels without interpreting arbitrary prose.
  const match = value.trim().match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([km])?\s*(\+)?$/i);
  if (!match) return null;
  const magnitude = match[2]?.toLowerCase() === 'k' ? 1000 : match[2]?.toLowerCase() === 'm' ? 1000000 : 1;
  const n = Number(match[1].replaceAll(',', '')) * magnitude;
  return numberValue(n, { integer: true });
}

function evidenceDate(value) {
  if (!text(value)) return null;
  const datePart = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const d = new Date(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== datePart) return null;
  if (value.length > 10 && !Number.isFinite(Date.parse(value))) return null;
  return d;
}

function validWebUrl(value) {
  try {
    const url = new URL(text(value));
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

/**
 * Return earned points out of 100 and known weight out of 100 separately.
 * Missing values never earn points and never rescale the other components.
 * eligibility is a research decision. It is never an approval to publish/buy.
 */
export function scoreProduct(product = {}, now = new Date()) {
  const p = product && typeof product === 'object' ? product : {};
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime())) throw new TypeError('scoreProduct requires a valid current date.');
  const today = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate()));
  const reasons = [];
  const contextIssues = [];
  const components = [];
  const rating = numberValue(p.rating, { min: 1, max: 5 });
  const reviews = numberValue(p.reviews, { integer: true });
  const sold = soldValue(p.sold);
  let adjustedRating = null;
  let ratingPoints = null;

  if (rating !== null && reviews !== null && reviews > 0) {
    adjustedRating = (rating * reviews + scoringDefaults.priorRating * scoringDefaults.priorReviews) / (reviews + scoringDefaults.priorReviews);
    ratingPoints = 30 * clamp((adjustedRating - 3) / 2, 0, 1);
  } else {
    reasons.push(reviews === 0
      ? 'No rating responses are recorded. The rating component needs review evidence.'
      : 'A valid item rating and its response count are needed to score the rating component.');
  }
  components.push({ id: 'rating', label: 'Review-adjusted rating', weight: 30, value: rating, points: ratingPoints === null ? null : round(ratingPoints), known: ratingPoints !== null });

  const salesPoints = sold === null ? null : 15 * Math.min(Math.log10(sold + 1) / Math.log10(scoringDefaults.soldCap + 1), 1);
  if (sold === null) reasons.push('The displayed sold count is missing or invalid. Keep rounded figures as lower bounds.');
  components.push({ id: 'sales', label: 'Sold-volume signal', weight: 15, value: sold, points: salesPoints === null ? null : round(salesPoints), known: salesPoints !== null });

  let rawTotal = (ratingPoints ?? 0) + (salesPoints ?? 0);
  for (const definition of qualitativeComponents) {
    const grade = numberValue(p[definition.field], { min: 0, max: 5, integer: true });
    const points = grade === null ? null : definition.weight * grade / 5;
    if (grade === null) reasons.push(`${definition.label} needs an evidence-backed grade from 0 to 5.`);
    rawTotal += points ?? 0;
    components.push({ id: definition.id, field: definition.field, label: definition.label, weight: definition.weight, value: grade, points: points === null ? null : round(points), known: points !== null });
  }

  const coverage = components.filter(c => c.known).reduce((sum, c) => sum + c.weight, 0);
  const total = round(rawTotal);
  const date = evidenceDate(p.evidenceDate);
  const ageDays = date ? Math.round((today.getTime() - date.getTime()) / DAY) : null;
  const stale = ageDays !== null && ageDays > scoringDefaults.freshnessDays;
  const futureDate = ageDays !== null && ageDays < 0;
  if (!date) contextIssues.push('Record a valid evidence-check date.');
  if (futureDate) contextIssues.push('The evidence-check date is in the future.');
  if (stale) contextIssues.push(`Evidence is ${ageDays} days old. Refresh it before a shortlist decision.`);
  if (!text(p.destination)) contextIssues.push('Record the destination used for availability, delivery and cost checks.');
  if (!validWebUrl(p.sourceUrl)) contextIssues.push('Record a valid HTTP(S) product source URL.');
  const price = numberValue(p.price);
  const shipping = numberValue(p.shipping);
  if (price === null) contextIssues.push('Record the selected variant price, or leave the candidate under review.');
  if (shipping === null) contextIssues.push('Record shipping cost for the destination; use zero only when free shipping is verified.');
  const currency = text(p.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) contextIssues.push('Record a three-letter currency code for the cost comparison.');

  const hardGate = ['clear', 'review', 'reject'].includes(p.hardGate) ? p.hardGate : 'review';
  if (hardGate === 'review') contextIssues.push('Critical product, destination, identity, specifications and defect checks need review.');
  if (text(p.gateNotes)) reasons.push(`Research notes: ${text(p.gateNotes)}`);
  reasons.push(...contextIssues);

  const historyLimited = reviews !== null && reviews < scoringDefaults.minimumReviews || sold !== null && sold < scoringDefaults.minimumSold;
  const ratingBelowFloor = rating !== null && rating < scoringDefaults.minimumRating;
  const criticalZeroComponents = components.filter(c => ['recentReviews', 'seller', 'specs', 'fulfilment'].includes(c.id) && c.known && c.value === 0);
  let eligibility;
  let eligibilityCode;

  if (hardGate === 'reject' || criticalZeroComponents.length > 0) {
    eligibility = 'Do not shortlist';
    eligibilityCode = 'rejected';
    reasons.unshift('A critical check failed. The numeric score cannot override this decision.');
    if (criticalZeroComponents.length > 0) reasons.unshift(`A grade of zero records a critical concern in: ${criticalZeroComponents.map(c => c.label).join(', ')}. Resolve that evidence before reconsidering the candidate.`);
  } else if (coverage < 100 || contextIssues.length > 0) {
    eligibility = 'More evidence needed';
    eligibilityCode = 'needs-evidence';
    reasons.unshift(`Only confirmed evidence contributes to the score. ${coverage}/100 component weight is evaluated.`);
  } else if (historyLimited || ratingBelowFloor) {
    eligibility = 'Pilot only';
    eligibilityCode = 'pilot';
    if (ratingBelowFloor) reasons.unshift('The observed rating is below the 4.5-star screening threshold. Any pilot needs a documented reviewer exception.');
    if (reviews < scoringDefaults.minimumReviews) reasons.unshift('Fewer than 50 rating responses: use a documented pilot/sample review.');
    if (sold < scoringDefaults.minimumSold) reasons.unshift('Fewer than 100 displayed sales: use a documented pilot/sample review.');
  } else if (rawTotal >= 80) {
    eligibility = 'Priority shortlist';
    eligibilityCode = 'priority';
    reasons.unshift('Current evidence and screening thresholds support a priority shortlist. A human/sample review is still required before approval.');
  } else if (rawTotal >= 65) {
    eligibility = 'Compare alternatives';
    eligibilityCode = 'compare';
    reasons.unshift('The completed score is 65-79.9. Compare alternatives and resolve the weaker components.');
  } else {
    eligibility = 'Deprioritize';
    eligibilityCode = 'deprioritize';
    reasons.unshift('The completed score is below 65. Prioritize stronger alternatives for this brief.');
  }

  return {
    version: SCORING_VERSION,
    total,
    coverage,
    adjustedRating: adjustedRating === null ? null : round(adjustedRating, 3),
    eligibility,
    eligibilityCode,
    reasons,
    components,
    stale,
    ageDays,
    futureDate,
    ceiling: round(total + 100 - coverage),
    incomplete: coverage < 100,
    historyLimited,
    ratingBelowFloor,
    approvalEligible: eligibilityCode === 'priority',
    knownCost: price !== null && shipping !== null ? round(price + shipping) : null,
    costNote: 'Selected variant price plus recorded shipping only. Include verified tax/fees separately; unknown fees are not zero.',
  };
}

