# Wow Fashion Portal

A working website-build portal for Wow Fashion, combining the current website inventory, AliExpress product research, supplier records, writing prompts, editorial standards and a build roadmap.

## Included

- **Website map:** 113 editorial category records (7 parent pages, 106 children), 135 shop-category records (10 roots, 125 descendants), and 2 separate blog categories. Full source URLs, parent relationships, verification detail and migration findings are retained.
- **Page planning:** Editable status, priority, owner, target product count, keywords, proposed URLs and brief notes for every mapped category.
- **Product research:** Evidence-led AliExpress scorecard, selected-variant costs, destination, current review evidence, seller checks, shortlist status and supplier/category links.
- **Supplier directory:** Seller/manufacturer distinction, evidence, sample outcome, due diligence, status and linked product records.
- **Writing prompts:** 20 complete templates with contextual inputs, editable text, copy/download controls and saved custom versions.
- **Editorial standards:** 10 groups of proposed rules, provenance, source links and business-model distinctions.
- **Build roadmap:** Shared completion records, export and practical migration/launch milestones.
- **Backup:** JSON export/restore plus category, supplier and product CSV exports.

## Architecture

The frontend is a dependency-light JavaScript ES module application. It is built by copying `public/` into `dist/`; the UI doesn't require a framework runtime. Inter and Instrument Serif are self-hosted under their included licences.

Two Vercel Node.js functions provide shared persistence:

| Route | Purpose |
| --- | --- |
| `GET /api/session` | Session/configuration status |
| `POST /api/session` | Open a session with the workspace access code |
| `DELETE /api/session` | Sign out |
| `GET /api/workspace` | Load authenticated shared records |
| `PUT /api/workspace` | Validate and save using revision and ETag checks |

Shared workspace records are stored as private JSON in Vercel Blob at `wow-fashion/workspace-v1.json`. Reads bypass storage cache. Writes use Blob ETag preconditions; stale edits return 409 rather than silently overwriting newer work. There is no browser-local replica containing private supplier records.

The public reference view contains the dated site audit, prompt templates and proposed rules. Opening the shared workspace additionally loads its private product, supplier, planning and custom-prompt records. The access code protects those private records; the published source templates are public assets.

## Configuration

The Vercel project requires:

- `BLOB_READ_WRITE_TOKEN`: Provisioned by the connected private Blob store; never expose it to the browser.
- `WORKSPACE_ACCESS_CODE`: A high-entropy code of at least 12 characters, configured as a sensitive environment variable. Rotate it in Vercel and redeploy to invalidate existing sessions.

Session cookies are signed, HttpOnly, Secure and SameSite Strict with a seven-day lifetime. Mutations require matching Origin and JSON. The portal sends noindex headers and a disallowing robots file. The repository contains no production access code or storage token.

Shared code access is a lightweight team mechanism, not individual role-based accounts. If the team grows or needs user attribution/access revocation, replace it with individual authentication and a relational store. The current single-document store has a 2 MiB validation limit and is intended for this small planning workspace, with optimistic concurrency rather than realtime co-editing.

## Development and validation

Node.js 24 is the deployment runtime.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

`npm run dev` serves the static reference workspace. Private writes intentionally are not enabled in the local preview. Use a Vercel deployment with its configured environment to verify authenticated persistence. There is no development authentication bypass.

Tests cover tamper/expiry/rotation, request-origin checks, field/URL validation, first-write races, stale writes, corrupt-data preservation and scoring/approval edge cases.

## Research boundaries

The audit snapshot is **7 November 2026**. Public WordPress and WooCommerce APIs were fully paginated. Record verification is distinct from live destination verification: 15 URLs were individually HTTP-checked. There are **248 commercial records / 243 distinct commercial URLs**, or **250 records / 245 URLs** including the blog categories.

The current site has parallel editorial pages and shop categories. Five URLs overlap; all ten shop roots were observed with noindex. These are migration decisions to resolve, not changes made to the live website. See `docs/site-audit.md`.

The 20 new Wow-specific prompts and sourcing rubric are **proposed working standards**. Existing reference-portal guidelines informed them, but no previously approved Wow-specific internal prompt pack was found. See `docs/editorial-and-sourcing-standards.md`.

No products or suppliers are seeded as approved or represented as tested. Research prompts prepare instructions for an AI tool; they do not execute an AI model or provide an automatic AliExpress feed. Current listing data is entered with sources and dates. Product scores prioritize research and never automatically approve an item.

The new operating model remains undecided (affiliate, direct retail or hybrid). UK/GBP are configurable planning defaults. The proposed editorial language is US English to match the current category terminology; briefs can override it. Legacy shipping, returns and testing claims require current confirmation before reuse.

## Deployment

Repository: https://github.com/m0veproperty/wow-fashion-portal

Vercel project: `wow-fashion-portal`, under WiWy. The source repository is connected to Vercel, with `main` as the intended production branch. `vercel.json` declares the static output, function settings and response headers. No custom-domain or live wowfashion.com changes are included.

