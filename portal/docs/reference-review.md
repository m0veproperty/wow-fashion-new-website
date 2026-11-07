# Wow Fashion portal reference review

Reviewed 7 November 2026. Public references were read with Firecrawl and raw HTML/CSS; Vercel account fetch was used for protected previews. No source content was changed.

## Recommended portal structure

| Section | Main workflow |
| --- | --- |
| Overview | Category inventory counts, research gaps, saved products, supplier count, and a short next-action list. |
| Category map | Searchable hierarchy with live URLs, top-level/subcategory status, evidence, planned copy state and product target. Drill into a category to assemble its brief and shortlist. |
| Product research | AliExpress-first search prompt, input/evidence fields, explainable product score, shortlist, status, linked supplier and destination category. |
| Suppliers | Searchable supplier records, public store URL, identity type (seller/manufacturer/unknown), shipping/returns evidence, product links, last checked date and notes. |
| Prompt library | Contextual category, product, research, supplier diligence, editorial, internal linking, metadata and QA prompts. Preview and copy prompts with the selected category/product data included. |
| Writing guidelines | Shared source guidance and Wow-specific adaptations, clearly labelled. Search, table of contents, copy and source links. |
| Build plan | Existing previews, milestones, page readiness and outstanding decisions. Can be compact if navigation is already crowded. |

Recommended interaction model: a persistent left rail, breadcrumb header, searchable table/list in the main canvas, and a focused detail drawer. The overview can be more editorial, but working screens should preserve information density. Maintain explicit evidence versus proposed/new content labels.

## Reference findings

### Affiliate Build OS
Source: https://affiliate-websites-nu.vercel.app/

The strongest operational reference. Its page-first approach connects site/page context to saved products and a generated implementation prompt. The left rail is a portfolio/site selector; the main workspace has Pages, Vendor prompt, Writing guidelines and Testimonial Content tabs. Header links point to actual website, GitHub and Vercel deployment. New-page and product add/edit controls are present.

Inventory rows show page title, URL, type, saved/required product count and research status. Filters cover page type and whether product targets are met. A page drawer contains product mappings and a generated prompt. Product records carry name, retailer, URL, image and description.

Reusable workflow:
1. Select category/page.
2. Set a product target.
3. Research and map products.
4. Copy a prompt prefilled with page, links, vendors, guidelines and product evidence.
5. Write/build and resolve specific gaps.

Useful guideline distinctions include shared voice, landing pages, articles, internal/external links and FAQs. The shared vendor/content prompt preserves supplied product mappings, avoids inventing availability/prices/test experience, separates evidence notes from public copy, requires genuine source reviews, and keeps illustrative testimonials out of published ratings.

Evidence URLs:
- https://affiliate-websites-nu.vercel.app/#guidelines/voice
- https://affiliate-websites-nu.vercel.app/#guidelines/landing-pages
- https://affiliate-websites-nu.vercel.app/#guidelines/articles
- https://affiliate-websites-nu.vercel.app/#guidelines/internal-links
- https://affiliate-websites-nu.vercel.app/#guidelines/external-links
- https://affiliate-websites-nu.vercel.app/#guidelines/faqs
- https://affiliate-websites-nu.vercel.app/api/portfolio

The portfolio API returned ten sites: Come Feast With Me, The Gadget Nerds, The Cosplay Site, TVMates.com, TVMates.co.uk, Laptop Den, Sofa Spring, Fika NYC, Epik Watch and Olly Sleep. Wow Fashion is **not** in that retrieved portfolio. No existing Wow-specific prompt was found there.

Visuals: dark navy site rail, DM Sans, restrained pale working canvas, strong table focus and clear primary actions.

### Find a Cheap Flight master portal
Source: https://find-a-cheap-flight-master-portal.vercel.app/

Full navigation includes Overview, About, Writing Guidelines, Master Content, Core Pages, Blog, SEO Considerations, and Master Routes. Master Routes expands to Main Routes, Templates, Outside UK/US, Entity Dictionary, Workbook Notes and Release Batches.

The overview combines summary counts, top opportunities, a category mix and destination coverage. Routes have source-record details. The original workbook is downloadable. The UI explicitly distinguishes historical keyword data from live fares.

Reusable ideas:
- Audited page inventory and source evidence stay attached to planned pages.
- Alias/canonical-name dictionary is valuable for overlapping or oddly named Wow categories.
- Release batches convert a large inventory into manageable publishing groups.
- Clear source dates and caveats prevent historical research being mistaken for current commercial claims.

Visuals: white 252px sidebar; pale sage canvas; forest green accent; compact, legible sans type; rounded summary panels; generous overview whitespace.

### MX Page Workspace
Source: https://mx-page-workspace.vercel.app/

Public browsing redirected to Vercel authentication. Authenticated Vercel connector successfully returned the real workspace HTML and CSS.

Navigation: Overview; All pages; UK; US; Shared pages; Keyword strategy; Blog Articles; FAQs; Testimonials; Source review; Deployment status; Writing Guidelines. Page records open an editable modal and the header exposes connection status. This is the clearest example of content operations, shared master content and progress tracking.

Reusable ideas:
- Separate reusable master guidance from per-page editable records.
- Surface source issues and readiness gaps.
- Distinguish existing pages, shared content and deployment state.
- Show save/connection status clearly in an editable workspace.

Visuals verified in brand.css: Manrope; dark aubergine sidebar #12081d; pink accent #de097f; pale lilac canvas #f7f5fa; ink #21132f. Small tags and tidy tables use soft borders. These exact colours belong to MX, so Wow should adapt the structure with its own palette.

### The Writing Room
Source: https://writing-guidelines-portal.vercel.app/

Five collections:
- Landing Page Tonality Guidelines
- Article Page Tonality Guidelines
- Article Formatting Guidelines (42 components)
- Internal links
- SEO Guidelines

The left sidebar includes search and collection navigation. A guideline detail view has a table of contents, formatted rules/examples, copy button and .txt download. Search has a keyboard shortcut. This is the best prompt-reading experience to reuse.

Raw shared source: https://writing-guidelines-portal.vercel.app/guides.json

Original five guideline collections were saved to research/reference-guides.json for internal source access. They are shared editorial guidance, **not an existing Wow-specific writing brief**. Shared tone specifies US spelling, contractions, direct language and avoidance of clichés. Any locale adaptation for Wow should be explicit. Article-specific guidance adds occasional dry wit and meaningful short sentences while retaining factual accuracy. Internal links require relevant natural anchors and useful destinations. SEO guidance prioritises reader purpose and distinguishes inferred keywords from verified research metrics.

Visuals: white 268px sidebar; warm paper #faf9f6; purple #6d55ab; serif accents in editorial display moments; readable neutral sans interface; coloured collection icons; structured examples and lightweight cards.

## Existing Wow Fashion preview projects

Vercel project metadata shows all three latest production deployments READY. These previews require Vercel account access under their current protection settings. No Git repository pointer was returned by the project metadata endpoint.

| Project | Preview | Main purpose |
| --- | --- | --- |
| wow-fashion-homepage | https://wow-fashion-homepage.vercel.app/ | Broad wardrobe homepage |
| wow-fashion-dress-edit | https://wow-fashion-dress-edit.vercel.app/ | Dresses parent/category landing page |
| wow-fashion-club-dresses | https://wow-fashion-club-dresses.vercel.app/ | Club dresses subcategory landing page |

Homepage and dress edit use warm cream, brown ink and blush. Homepage CSS defines cream #f7f2eb, ink #352821, muted #807064, line #d9ccbf and blush #dfc5b3. It loads local Editorial serif and Sans fonts. WOW wordmark is large serif with small spaced FASHION underneath.

Observed positioning includes “For every side of you”, “For every version of you” and “Find your WOW”. The designs use lifestyle/occasion-based discovery, photographic heroes, saved pieces, collections and style notes.

Club dresses shifts to charcoal #181822 and champagne details. Its font pair is Cormorant Garamond + DM Sans. It is an after-dark subcategory direction with party/club dress filtering, saved pieces and style notes.

These previews are design references. They do not establish the exhaustive live category taxonomy, approved ecommerce model, current stock or supplier authenticity.

## Concrete visual recommendation

Use the existing Wow cream/brown/blush palette for brand continuity and the reference portals' persistent workbench shell. Suggested foundation:

- Warm cream canvas with white or subtly tinted data panels.
- Deep brown sidebar, pale active navigation state and restrained terracotta accent.
- Editorial serif for the overview heading and section openers; a clear sans font for controls, data tables and reading.
- No giant fashion hero on every working screen. One quiet editorial overview moment is sufficient.
- Dense category table, visible hierarchy, quick type/status filters and an evidence drawer.
- Prompt viewer with required inputs, output preview, copy action, source guidance and version/adaptation notes.
- Supplier records should start empty until real evidence is added. Never invent seller approval or manufacturer status.

The strongest blend is Affiliate Build OS for workflow, Flight for inventory/evidence and release planning, MX for editable operations/status, and Writing Room for readable reusable guidance, all wearing the existing Wow visual identity.


