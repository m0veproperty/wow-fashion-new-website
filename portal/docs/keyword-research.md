# Keyword Research

The portal's `#/keywords` route contains the UK Ahrefs snapshot researched on 7 November 2026. Each commercial child record links to a research group, retaining separate editorial and shop IDs where wording overlaps.

## Scope

- 231 child category records, organised into 141 seed groups.
- 86,836 returned matches; 71,371 unique keywords after exact-keyword deduplication.
- 7,980 proposed clusters, of which 3,671 have a leading keyword with at least 100 estimated monthly searches.
- 63 groups still hit the 500-row response ceiling. Eight deeper expansion calls were blocked by the available Ahrefs API unit allowance. All groups have a successful first pass.

Endpoint: Ahrefs Keywords Explorer matching terms. Country `gb`; terms matching; columns `keyword,volume,difficulty,parent_topic`; volume greater than zero; order by volume descending. First requests asked for 2,000 results but the connection returned at most 500. Second passes used volume less than or equal to the first pass's lowest volume, then deduplicated. Seeds and pass coverage are retained in the dataset. Requests were made on 7 November 2026; this is the retrieval date, not a claim that each keyword's SERP was refreshed that day.

## Interpretation

Volumes are Ahrefs estimates of average monthly UK searches over its latest known 12 months. Null KD and Parent Topic remain unknown. Generic apparel queries can contain mixed-gender demand. No volumes are invented, and variant volumes are not summed.

Classification uses apparel-word rules, a known-brand exclusion list and audience/intent filters. Unknown terms remain in Review. Proposed clusters normalise word order, gender modifiers, singular/plural and selected UK/US wording; they require a contiguous category seed in at least one variant. Parent Topics that explicitly indicate another audience are removed from proposals unless the lead query explicitly specifies women. These rules are conservative triage, not manual semantic or SERP validation. All raw matches remain accessible, including excluded terms.

Before approving any page, validate commercial intent, competing SERP pages, product depth, overlap with existing pages and one canonical parent. Draft slugs are planning suggestions, not deployed URLs. Compound existing categories and synonyms still need architecture decisions.

The snapshot is broad but not exhaustive. Capped terms, low-volume tails, wider synonyms, competitor gaps and manual SERP validation remain outstanding. Absence from this snapshot does not imply no demand. The default proposed-page filter is 100 searches; choose All measured demand to include low-volume examples such as black denim blouse (10).

## Implementation

Research is a public reference snapshot, like the existing taxonomy. It does not alter private workspace records, authentication or live wowfashion.com pages. Keywords are loaded only when opening the full-match view. Filters, sorting, pagination, variant details, coverage and CSV exports run client-side without additional Ahrefs API calls.
