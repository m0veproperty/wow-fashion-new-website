# Product and supplier catalogue

Each product is one source listing, linked to one supplier. The primary category is retained for older records and briefs; additional category IDs and proposed keyword page mappings allow a product to appear on more than one relevant page. Keyword mappings also include their parent category in coverage. These links are planning records, not live pages or approvals.

Each variation is a purchasable combination with colour, style, size, another option, SKU, price and availability. The product currency applies to all its variations. Unknown prices remain null. If variations exist, the displayed range uses their known prices and flags incomplete prices; otherwise the legacy reference price is displayed. Shipping remains the selected reference variant's recorded shipping charge.

Product and variation CSV exports retain the listing and supplier relationship. Supplier exports include linked product counts, variation count, mapped categories, aggregate product rating and coverage, separate store rating, contact, country, lead time, destinations, order terms, returns, sample outcome and dates.

Aggregate product rating is weighted by each item's rating-response count. Items without both a valid rating and a positive count are excluded. Duplicate source listings are counted once using their most recently checked record; AliExpress item IDs are normalised across .com/.us and query parameters. A product with many variations contributes only once. Store ratings are not mixed into the product aggregate. No rating or supplier claims are inferred for missing data.

The existing authenticated shared workspace and optimistic concurrency controls persist the added optional fields. Existing records and backups remain valid without a migration. There is no production authentication bypass and no seeded supplier or product research. Tests cover validation, preserved unknowns, weighted aggregation, duplicate URLs and storage round-tripping.
