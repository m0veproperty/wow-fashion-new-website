import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreProduct, scoringFields } from '../public/scoring.js';

const now = new Date('2026-11-07T12:00:00Z');
const candidate = {
  rating: 4.8, reviews: 700, sold: '5,000+',
  recentReviewScore: 5, sellerScore: 5, specificationScore: 5, valueScore: 5, deliveryScore: 5,
  evidenceDate: '2026-11-07', destination: 'United Kingdom',
  sourceUrl: 'https://www.aliexpress.com/item/1005000000000.html',
  price: 25, shipping: 0, currency: 'GBP', hardGate: 'clear',
  gateNotes: 'Hypothetical test fixture; not a real product assessment.',
};

test('complete current evidence supports a shortlist, never automatic approval', () => {
  const result = scoreProduct(candidate, now);
  assert.equal(result.coverage, 100);
  assert.equal(result.eligibility, 'Priority shortlist');
  assert.equal(result.approvalEligible, true);
  assert.ok(result.total >= 80 && result.total <= 100);
  assert.ok(result.reasons.some(x => x.includes('human/sample review')));
});

test('unknown fields do not become zeros or uplift other components', () => {
  const empty = scoreProduct({}, now);
  assert.equal(empty.total, 0);
  assert.equal(empty.coverage, 0);
  assert.equal(empty.ceiling, 100);
  assert.equal(empty.adjustedRating, null);
  assert.equal(empty.eligibility, 'More evidence needed');
  assert.ok(empty.components.every(x => x.points === null));

  const partial = scoreProduct({ ...candidate, sellerScore: '', specificationScore: null }, now);
  const complete = scoreProduct(candidate, now);
  assert.equal(partial.coverage, 75);
  assert.equal(partial.total, complete.total - 25);
  assert.equal(partial.ceiling, complete.total);
  assert.equal(partial.eligibility, 'More evidence needed');
});

test('zero review history cannot manufacture a confident rating component', () => {
  const result = scoreProduct({ ...candidate, rating: 5, reviews: 0 }, now);
  assert.equal(result.adjustedRating, null);
  assert.equal(result.coverage, 70);
  assert.equal(result.eligibility, 'More evidence needed');
  assert.equal(result.historyLimited, true);
});

test('a tiny high-star sample is discounted and remains pilot-only', () => {
  const small = scoreProduct({ ...candidate, rating: 4.9, reviews: 4, sold: 25 }, now);
  const established = scoreProduct({ ...candidate, rating: 4.7, reviews: 500, sold: 500 }, now);
  assert.ok(small.adjustedRating < established.adjustedRating);
  assert.equal(small.adjustedRating, 4.252);
  assert.equal(small.eligibility, 'Pilot only');
  assert.equal(small.approvalEligible, false);
});

test('critical rejection overrides an otherwise high complete score', () => {
  const result = scoreProduct({ ...candidate, hardGate: 'reject', gateNotes: 'Documented critical mismatch.' }, now);
  assert.ok(result.total > 80);
  assert.equal(result.eligibility, 'Do not shortlist');
  assert.equal(result.approvalEligible, false);
});

test('stale evidence blocks a shortlist and the 14-day boundary is explicit', () => {
  const stale = scoreProduct({ ...candidate, evidenceDate: '2026-10-23' }, now);
  assert.equal(stale.stale, true);
  assert.equal(stale.ageDays, 15);
  assert.equal(stale.eligibility, 'More evidence needed');
  const fresh = scoreProduct({ ...candidate, evidenceDate: '2026-10-24' }, now);
  assert.equal(fresh.stale, false);
  assert.equal(fresh.ageDays, 14);
});

test('future or invalid dates and unsafe source URLs cannot clear evidence checks', () => {
  for (const evidenceDate of ['2026-11-08', '2026-02-30', 'not-a-date']) {
    assert.equal(scoreProduct({ ...candidate, evidenceDate }, now).eligibility, 'More evidence needed');
  }
  assert.equal(scoreProduct({ ...candidate, sourceUrl: 'javascript:alert(1)' }, now).eligibility, 'More evidence needed');
});

test('a confirmed grade zero is scored, a missing or invalid grade is not', () => {
  const zero = scoreProduct({ ...candidate, recentReviewScore: 0 }, now);
  const unknown = scoreProduct({ ...candidate, recentReviewScore: '' }, now);
  assert.equal(zero.coverage, 100);
  assert.equal(unknown.coverage, 85);
  assert.equal(zero.components.find(x => x.id === 'recentReviews').points, 0);
  assert.equal(zero.eligibility, 'Do not shortlist');
  assert.equal(unknown.components.find(x => x.id === 'recentReviews').points, null);
  for (const invalid of [6, -1, Infinity, true, 'unknown']) {
    assert.equal(scoreProduct({ ...candidate, recentReviewScore: invalid }, now).coverage, 85);
  }
});

test('critical zero grades cannot be overruled by a contradictory clear gate', () => {
  for (const field of ['recentReviewScore', 'sellerScore', 'specificationScore', 'deliveryScore']) {
    const result = scoreProduct({ ...candidate, [field]: 0, hardGate: 'clear' }, now);
    assert.equal(result.eligibilityCode, 'rejected');
    assert.equal(result.approvalEligible, false);
  }
});

test('rounded sold labels preserve a conservative count and costs remain explicit', () => {
  const short = scoreProduct({ ...candidate, sold: '2.5k+' }, now);
  const full = scoreProduct({ ...candidate, sold: 2500 }, now);
  assert.equal(short.total, full.total);
  assert.equal(short.knownCost, 25);
  assert.equal(scoreProduct({ ...candidate, shipping: '' }, now).knownCost, null);
  assert.equal(scoreProduct({ ...candidate, shipping: '' }, now).eligibility, 'More evidence needed');
});

test('field contract exposes the requested data keys exactly once', () => {
  const ids = scoringFields.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const field of ['rating','reviews','sold','recentReviewScore','sellerScore','specificationScore','valueScore','deliveryScore','evidenceDate','destination','sourceUrl','price','shipping','currency','hardGate','gateNotes']) {
    assert.ok(ids.includes(field));
  }
});

