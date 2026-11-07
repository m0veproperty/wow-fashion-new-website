# Wow Fashion: category inventory and migration audit

Audited: **7 November 2026**  
Website: https://wowfashion.com/

## Scope and confirmed totals

The audit separates the site's **editorial category pages** from its **WooCommerce product categories**. They are different records, often different URLs, and should not be merged into one unlabeled list.

| Inventory | Root records | Descendants | Total records |
| --- | ---: | ---: | ---: |
| Editorial category pages | 7 | 106 | 113 |
| Shop categories | 10 | 125 | 135 |
| Blog categories, separate from the commercial category inventory | 2 | 0 | 2 |

The commercial category inventory contains **248 records across 243 distinct URLs**. Including the two blog categories, the complete dataset contains **250 records across 245 distinct URLs**. Five paths are registered in both the editorial and shop systems.

The public APIs were paginated to completion: 132 published WordPress pages (100 + 32) and 135 shop categories (100 + 35, with empty categories included). Of the WordPress pages, 113 belong to the seven editorial category hierarchies; the other 19 are support, account, home and similar pages. All 106 editorial subcategories are also present in the homepage directory and page sitemap. No parent references are missing.

## Seven primary departments

| Department | Editorial parent URL | Main navigation/shop parent URL | Editorial subcategories |
| --- | --- | --- | ---: |
| Dresses | https://wowfashion.com/dresses/ | https://wowfashion.com/all-dresses/ | 11 |
| Blouses | https://wowfashion.com/blouses/ | https://wowfashion.com/blouses/ | 14 |
| Skirts | https://wowfashion.com/skirts/ | https://wowfashion.com/skirts/ | 15 |
| Pants & Leggings | https://wowfashion.com/pants/ | https://wowfashion.com/trousers-and-leggings/ | 26 |
| Cardigans | https://wowfashion.com/cardigans/ | https://wowfashion.com/cardigans/ | 12 |
| Sweaters | https://wowfashion.com/sweaters/ | https://wowfashion.com/sweaters/ | 13 |
| Coats & Jackets | https://wowfashion.com/coats-and-jackets/ | https://wowfashion.com/coats-jackets/ | 15 |

The menu uses shop URLs. Editorial subcategories generally use nested paths such as `/dresses/summer-dresses/`; shop categories generally use flat paths such as `/summer-dresses/`. Matching names do not establish identical page content or search intent.

## Additional shop hierarchy

The shop API has three root categories beyond the seven main menu departments:

- **Fashion:** https://wowfashion.com/fashion/
- **Outfits & Sets:** https://wowfashion.com/outfits-sets/, with Casual, Going out, Sporty and Pajama Sets.
- **Plus size:** https://wowfashion.com/plus-size/, with Blouses, Dresses and Outfits.

Pants and Leggings also has a Shorts child with **Denim Shorts and Short Pants as third-level descendants**. The dataset preserves this actual hierarchy rather than flattening it.

These are existing records. Their presence does not mean each should become a new-site navigation item.

## Five URL collisions

| Shared URL | Editorial record | Shop record | Live result |
| --- | --- | --- | --- |
| https://wowfashion.com/blouses/ | Blouses parent page | Blouses root category | Product archive |
| https://wowfashion.com/cardigans/ | Cardigans parent page | Cardigans root category | Product archive |
| https://wowfashion.com/skirts/ | Skirts parent page | Skirts root category | Product archive |
| https://wowfashion.com/sweaters/ | Sweaters parent page | Sweaters root category | Product archive |
| https://wowfashion.com/dresses/ | Dresses parent page | Dresses child of Plus size | Single-product archive |

The **/dresses/** collision needs particular attention. WordPress registers it as the parent of 11 editorial pages, while the live URL serves the Plus size child category with one product. The main Dresses shop archive is **/all-dresses/**.

## Live indexability checks

All ten shop root URLs returned **HTTP 200** with a **noindex** robots directive:

| Shop root | URL | Products reported by API | Robots observed |
| --- | --- | ---: | --- |
| Blouses | https://wowfashion.com/blouses/ | 80 | follow, noindex, noarchive, noimageindex, nosnippet |
| Cardigans | https://wowfashion.com/cardigans/ | 48 | follow, noindex, noarchive, noimageindex, nosnippet |
| Coats & Jackets | https://wowfashion.com/coats-jackets/ | 77 | follow, noindex, noarchive, noimageindex, nosnippet |
| Dresses | https://wowfashion.com/all-dresses/ | 120 | nofollow, noindex, noarchive, noimageindex, nosnippet |
| Fashion | https://wowfashion.com/fashion/ | 125 | follow, noindex, noarchive, noimageindex, nosnippet |
| Outfits & Sets | https://wowfashion.com/outfits-sets/ | 16 | follow, noindex, noarchive, noimageindex, nosnippet |
| Pants and Leggings | https://wowfashion.com/trousers-and-leggings/ | 97 | follow, noindex, noarchive, noimageindex, nosnippet |
| Plus size | https://wowfashion.com/plus-size/ | 9 | follow, noindex, noarchive, noimageindex, nosnippet |
| Skirts | https://wowfashion.com/skirts/ | 64 | follow, noindex, noarchive, noimageindex, nosnippet |
| Sweaters | https://wowfashion.com/sweaters/ | 41 | follow, noindex, noarchive, noimageindex, nosnippet |

Product counts are a dated API snapshot. They must not be added together to calculate unique products because products can belong to multiple categories.

The alternate editorial parents **/pants/** and **/coats-and-jackets/** returned 200 with an index directive. The sampled nested editorial **/dresses/summer-dresses/** also returned 200 and index. This audit does not claim that all 106 nested editorial pages were individually checked for indexability.

## Other findings

- **Broken HTML sitemap link:** https://wowfashion.com/sitemap/ links Pants & Leggings to https://wowfashion.com/pants-and-leggings-blog/, which returned **404**. The known alternatives are the editorial https://wowfashion.com/pants/ and shop https://wowfashion.com/trousers-and-leggings/.
- **Duplicate shop label:** Black Leggings exists at both https://wowfashion.com/black-leggings/ and https://wowfashion.com/black-leggings-trousers-and-leggings/, under the same parent. Check product assignments before consolidation.
- **Two empty shop categories:** Animal Print Cardigans at https://wowfashion.com/animal-print-cardigans/ and Pussy Bow Blouses at https://wowfashion.com/pussy-bow-blouses-blouses/ each report zero products.
- **Blog categories are a separate scope:** Fashion at https://wowfashion.com/category/fashion/ has 2 posts; Info at https://wowfashion.com/category/info/ has 5 posts. Neither should inflate the headline commercial category count or be mistaken for the shop Fashion category.

## Implications for the new website

1. **Keep both original inventories.** Record decisions against source IDs and URLs. Avoid silently replacing current slugs with proposed ones.
2. **Choose an intended destination for each commercial category.** Decide whether editorial content and product listings should share a page or remain separate before writing final briefs.
3. **Resolve URL collisions and duplicates.** The Dresses collision and duplicate Black Leggings categories require explicit migration decisions.
4. **Decide indexability deliberately.** Do not automatically carry the shop archives' noindex directives into the replacement website.
5. **Create the redirect register after destinations are approved.** Record source URL, target URL, action, rationale, owner and verification status. Validate internal links, canonicals and sitemaps against the approved targets.
6. **Review zero-product and additional taxonomy categories.** Populate, consolidate or retire them based on sourcing and user demand. An existing record is not by itself a recommendation to publish.
7. **Preserve evidence dates.** Product counts, source availability and robots directives can change after this snapshot.

## Data contract and verification meaning

The files `public/data/taxonomy.json` and `public/data/taxonomy.csv` contain all records.

Each normalized row includes a namespaced unique ID, source CMS ID, name, exact URL, slug, parent ID/name, root ID/name, system, level, source URLs and verification state. `level` is 1 for roots, 2 for children and 3 for grandchildren.

**Source verified** means the record and parent hierarchy were confirmed in a first-party public API or sitemap. `httpStatus`, `robots` and `finalUrl` are populated only when that destination was individually requested. A missing HTTP value means **not individually checked**, not a failed page.

Fifteen distinct destination URLs were checked live: ten shop roots; the three alternate editorial paths /dresses/, /pants/ and /coats-and-jackets/; one nested editorial sample; and the broken HTML sitemap link. The five shared paths were included in those checks.

This is a complete inventory of the **publicly returned category/page records at the audit date**. Draft/private CMS records, individual products, query-string filters, pagination, complete redirect chains and full canonical validation are outside this inventory. It is a migration baseline, not approval to publish every record.

## First-party evidence and exact source URLs

- Homepage navigation and complete category directory: https://wowfashion.com/
- XML sitemap index: https://wowfashion.com/sitemap_index.xml
- Published page sitemap: https://wowfashion.com/page-sitemap.xml
- HTML sitemap: https://wowfashion.com/sitemap/
- WordPress page enumeration, page 1: https://wowfashion.com/wp-json/wp/v2/pages?per_page=100&_fields=id,parent,slug,link,title&page=1
- WordPress page enumeration, page 2: https://wowfashion.com/wp-json/wp/v2/pages?per_page=100&_fields=id,parent,slug,link,title&page=2
- Shop category enumeration including empty categories, page 1: https://wowfashion.com/wp-json/wc/store/v1/products/categories?per_page=100&hide_empty=false&page=1
- Shop category enumeration including empty categories, page 2: https://wowfashion.com/wp-json/wc/store/v1/products/categories?per_page=100&hide_empty=false&page=2
- Blog category enumeration: https://wowfashion.com/wp-json/wp/v2/categories?per_page=100
- Direct live destination URLs are included in the tables and findings above.

Raw public evidence and extraction notes were collected alongside the normalized dataset during research. No authenticated CMS access was required.


