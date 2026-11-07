# WOW Fashion — new website

One repository for the new collection website and the progress portal.

## Website

- `/blouses/`: blouse parent page with a static campaign image.
- `/blouses/<subcategory>/`: all 14 editorial blouse subcategories from the portal.
- `/dresses/`: the original dress parent design and campaign video.
- `/dresses/club-dresses/`: the original club dress design and campaign video.

The root opens Blouses. Category navigation and product links work; size, colour and price controls are deliberate visual previews. This is a design deployment with noindex headers, not a replacement for wowfashion.com.

Run `npm run build`, `npm test`, then `npm run dev`. Node 24; no runtime dependencies for the collection site. `data/collections.json` contains category-specific copy and product selection. `scripts/build.mjs` generates the reusable parent and subcategory templates. All referenced images, fonts and original campaign videos are stored in this repository.

## Product provenance

Product names, category assignments, links and photographs were read from the existing WOWFashion.com blouse catalogue on 7 November 2026. `data/products.json` retains the original image and product URLs. Links marked `__trashed` are excluded. Prices are intentionally linked to the original shop instead of presented as current inventory.

Most selections use the shop's category assignments. Peasant and pussy-bow pages use editorial selections based on silhouette or bow/tie-neck detail; see `assignment` notes in the category data. No matching denim products were found: that page labels its cotton alternatives explicitly. Parent and denim campaign images are illustrative AI-generated styling images; product cards retain real catalogue photography.

## Progress portal

`portal/` contains the portal application, backend validation, tests and public reference data. The existing private shared workspace stays in its original Vercel Blob store; no private workspace data, access code or credentials are included here. Existing page plans remain compatible.

The website map now shows **Has the page been built?** and **Does the page feature an animated header?**. Page plans can edit both fields and the new preview URL; CSV exports include all three. `portal/public/data/build-status.json` supplies released-page defaults without rewriting saved private records. Saved values override the defaults.

Deploy the collection site from repository root. Deploy the portal with Root Directory `portal` and retain its existing Blob and access-code environment settings. Portal commands run inside `portal/`: `npm ci`, `npm test`, `npm run check`, `npm run build`.

Original deployed design sources: https://wow-fashion-dress-edit.vercel.app/ and https://wow-fashion-club-dresses.vercel.app/. Existing project URLs remain available as historical references.
