const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#icon-${name}"></use></svg>`;
const arrow = '<span aria-hidden="true">↗</span>';

export function renderHomepage({home, departments, campaign}) {
  const asset = name => {
    const item = campaign.assets.find(item => item.name === name);
    if (!item) throw new Error('Missing homepage campaign image: ' + name);
    return { ...item, src: '/' + item.path.replace(/^public\//, '') };
  };
  const hero = asset('home-hero');
  const everyday = asset('everyday-editorial');
  const layers = asset('layers-editorial');
  const details = asset('details-still-life');
  const image = (item, extra = '') => `<img src="${item.src}" alt="${escape(item.alt)}" width="${item.width}" height="${item.height}" ${extra}>`;
  const products = home.products.map(selection => {
    const department = departments.find(item => item.slug === selection.department);
    const product = department?.products.find(item => item.id === selection.id && !item.url.includes('__trashed'));
    if (!product) throw new Error('Missing homepage product: ' + JSON.stringify(selection));
    return {
      id: selection.department + '-' + product.id,
      name: product.name,
      category: department.parent.name,
      group: selection.group,
      href: selection.department === 'cardigans' && product.id === 6 ? '/products/cotton-button-down-cardigan/' : product.url,
      image: `/assets/${selection.department}/${product.id}.webp`
    };
  });
  const search = departments.flatMap(department => [
    {name:department.parent.name, type:'Collection', href:`/${department.slug}/`, keywords:department.slug === 'pants' ? 'trousers leggings pants' : department.slug},
    ...department.collections.map(collection => ({name:collection.name, type:'Collection', href:`/${department.slug}/${collection.slug}/`, keywords:department.parent.name}))
  ]).concat(products.map(product => ({name:product.name, type:'Selected piece', href:product.href, keywords:product.category})));
  const productCards = products.map(product => `<article class="piece" data-group="${product.group}" data-product-id="${product.id}">
    <div class="piece-image"><a href="${escape(product.href)}" tabindex="-1" aria-hidden="true"><img src="${product.image}" alt="${escape(product.name)}" width="800" height="800" loading="lazy" decoding="async"></a><button class="save-piece js-only" type="button" data-save="${product.id}" aria-label="Save ${escape(product.name)}" aria-pressed="false">${icon('heart')}</button></div>
    <div class="piece-category">${escape(product.category)}</div><h3><a href="${escape(product.href)}">${escape(product.name)}</a></h3><a class="piece-link" href="${escape(product.href)}">View piece ${arrow}</a>
  </article>`).join('');
  const navLinks = home.collections.map(collection => `<a href="/${collection.slug}/">${escape(collection.name)} ${arrow}</a>`).join('');
  const config = JSON.stringify({products, search}).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f3ed">
  <title>${escape(home.title)}</title><meta name="description" content="${escape(home.description)}">
  <meta property="og:type" content="website"><meta property="og:title" content="${escape(home.title)}"><meta property="og:description" content="${escape(home.description)}"><meta property="og:image" content="https://wow-fashion-new-website.vercel.app${hero.src}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2348342d'/%3E%3Ctext x='32' y='46' text-anchor='middle' font-family='Georgia' font-size='43' fill='%23f7f0e9'%3EW%3C/text%3E%3C/svg%3E">
  <link rel="preload" href="/dresses/assets/sans.ttf" as="font" type="font/ttf" crossorigin><link rel="preload" href="/dresses/assets/editorial.ttf" as="font" type="font/ttf" crossorigin><link rel="preload" href="/dresses/assets/editorial-italic.ttf" as="font" type="font/ttf" crossorigin><link rel="preload" href="${hero.src}" as="image" fetchpriority="high">
  <link rel="stylesheet" href="/homepage.css"><script type="module" src="/homepage.js"></script>
</head>
<body id="top">
<a class="skip-link" href="#main">Skip to content</a>
<svg class="icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><symbol id="icon-heart" viewBox="0 0 24 24"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/></symbol><symbol id="icon-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></symbol></svg>
<div class="announcement">For every version of you.</div>
<header class="site-header" id="site-header">
  <nav class="header-left" aria-label="Main navigation"><button class="nav-button js-only" data-open="wardrobe-dialog" aria-haspopup="dialog">Shop collections <span aria-hidden="true">⌄</span></button><a class="no-js" href="#collections">Shop collections</a><a class="desktop-link" href="#the-edit">The selected edit</a></nav>
  <a class="wordmark" href="/" aria-label="WOW Fashion home">WOW<span>FASHION</span></a>
  <div class="header-actions"><button class="icon-button js-only" data-open="search-dialog" aria-label="Search collections and selected pieces">${icon('search')}</button><button class="icon-button js-only" data-open="saved-dialog" aria-label="Open saved pieces">${icon('heart')}<span class="saved-count" aria-hidden="true">0</span></button><a class="shop-link" href="https://wowfashion.com/">Visit the shop ${arrow}</a><button class="menu-toggle js-only" data-open="wardrobe-dialog" aria-haspopup="dialog" aria-label="Open collections menu"><span></span><span></span></button></div>
</header>
<main id="main">
  <section class="home-hero" aria-labelledby="hero-title">
    <div class="hero-media">${image(hero, 'fetchpriority="high" class="hero-photo"')}</div><div class="hero-wash" aria-hidden="true"></div><div class="hero-atmosphere" aria-hidden="true"></div><div class="hero-blend" aria-hidden="true"></div>
    <div class="hero-copy"><p class="eyebrow">The art of getting dressed</p><h1 id="hero-title">Find your<br><em>kind of WOW.</em></h1><p class="hero-description">Good pieces. Great possibilities.<br>A wardrobe for every version of you.</p><div class="hero-actions"><a class="button" href="#collections">Explore collections ${arrow}</a><a class="text-link" href="#the-edit">Meet your next favourite <span aria-hidden="true">→</span></a></div></div>
    <button class="motion-control hero-motion js-only" type="button" id="hero-motion" aria-pressed="false"><span class="pause-mark" aria-hidden="true"></span><span>Pause motion</span></button>
  </section>

  <section class="collections section-wrap" id="collections" aria-labelledby="collections-title">
    <div class="section-heading reveal"><h2 id="collections-title">Where will you <em>start?</em></h2><p>One wardrobe. A world of possibilities.</p></div>
    <div class="collection-track" id="collection-track" tabindex="0" aria-label="Browse all seven collections">
      ${home.collections.map(collection => `<a class="collection-card" href="/${collection.slug}/"><span class="collection-image"><img src="${collection.image}" style="object-position:${collection.position}" alt="" width="360" height="460" loading="lazy" decoding="async"></span><span class="collection-name">${escape(collection.name)} ${arrow}</span><span class="collection-description">${escape(collection.description)}</span></a>`).join('')}
    </div><div class="collection-controls rail-controls js-only"><button data-rail="collection-track" data-direction="-1" aria-label="Previous collections" disabled>←</button><button data-rail="collection-track" data-direction="1" aria-label="Next collections">→</button></div>
  </section>

  <section class="everyday section-wrap" id="everyday" aria-labelledby="everyday-title">
    <div class="everyday-primary reveal"><a class="editorial-photo" href="/blouses/" aria-label="Explore the blouse collection">${image(everyday, 'loading="lazy" decoding="async"')}</a><div class="editorial-caption"><div><h3>A fresh point of view.</h3><p>The blouse that changes your whole day.</p></div><a class="text-link" href="/blouses/">Explore blouses ${arrow}</a></div></div>
    <div class="everyday-secondary"><div class="everyday-copy reveal"><p class="eyebrow">The everyday, reimagined</p><h2 id="everyday-title">Less overthinking.<br><em>More you.</em></h2><p>An easy blouse. Beautiful trousers. A layer you reach for again. Start with what feels good, and make it your own.</p><a class="text-link" href="/pants/">Find your everyday fit ${arrow}</a></div><div class="layers-story reveal"><a class="editorial-photo" href="/cardigans/" aria-label="Explore the cardigan collection">${image(layers, 'loading="lazy" decoding="async"')}</a><div class="editorial-caption"><div><h3>A softer side.</h3><p>Good days begin with a lovely layer.</p></div><a class="text-link" href="/cardigans/">Discover cardigans ${arrow}</a></div></div></div>
  </section>

  <section class="selected-edit section-wrap" id="the-edit" aria-labelledby="edit-title">
    <div class="section-heading reveal"><h2 id="edit-title">Consider this <em>your shortlist.</em></h2><p>A few pieces to make getting dressed feel easy.</p></div>
    <div class="edit-toolbar"><div class="edit-filters js-only" role="group" aria-label="Filter selected pieces"><button type="button" data-filter="all" aria-pressed="true">All pieces</button><button type="button" data-filter="everyday" aria-pressed="false">Everyday</button><button type="button" data-filter="dresses" aria-pressed="false">Dresses</button><button type="button" data-filter="layers" aria-pressed="false">Layers</button></div><span id="edit-count" aria-live="polite">${products.length} pieces to explore</span></div>
    <div class="product-track" id="product-track" tabindex="0" aria-label="Selected WOW Fashion pieces">${productCards}</div>
    <div class="edit-foot"><p>Explore each piece for current prices, sizes and availability.</p><div class="rail-controls js-only"><button data-rail="product-track" data-direction="-1" aria-label="Previous selected pieces" disabled>←</button><button data-rail="product-track" data-direction="1" aria-label="Next selected pieces">→</button></div></div>
  </section>

  <section class="after-dark" aria-labelledby="night-title">
    <div class="night-media"><video id="night-film" muted loop playsinline preload="none" poster="/dresses/club-dresses/assets/hero-poster.jpg" aria-label="WOW Fashion evening campaign"><source data-src="/dresses/club-dresses/assets/hero.mp4" type="video/mp4"></video></div><div class="night-shade" aria-hidden="true"></div>
    <div class="night-copy reveal"><p class="eyebrow">When the mood changes</p><h2 id="night-title">A little after dark.<br><em>A lot of possibility.</em></h2><p>For the plans you made.<br>And the ones you didn’t see coming.</p><a class="button button-light" href="/dresses/club-dresses/">Meet the after-dark edit ${arrow}</a></div><button class="motion-control night-motion js-only" id="night-motion" type="button"><span class="play-mark" aria-hidden="true"></span><span>Play film</span></button>
  </section>

  <section class="details-story section-wrap" aria-labelledby="details-title"><div class="details-copy reveal"><h2 id="details-title">Fall for<br><em>the little things.</em></h2><p>A beautiful texture. A considered detail. The feeling of a favourite piece, worn your way.</p><a class="text-link" href="/sweaters/">Find a softer layer ${arrow}</a></div><div class="details-photo reveal">${image(details, 'loading="lazy" decoding="async"')}</div></section>

  <section class="help-section section-wrap" aria-labelledby="help-title"><div><h2 id="help-title">A few little details.</h2><p>Before you find your next favourite.</p></div><div class="help-questions"><details><summary>How do I find the right fit?<span aria-hidden="true">+</span></summary><p>Check the measurements on the individual product page and compare them with a piece you already love. Fit and sizing can vary between styles.</p></details><details><summary>Where can I shop the pieces?<span aria-hidden="true">+</span></summary><p>Follow a product link to see the current details and buying options. The <a href="https://wowfashion.com/">WOW Fashion shop</a> has current prices, sizes and availability.</p></details><details><summary>Can I shop the campaign looks?<span aria-hidden="true">+</span></summary><p>Our campaign photographs offer styling inspiration. The selected edit uses photographs of the actual pieces, with links to their product details.</p></details></div></section>
</main>
<footer class="site-footer"><div class="footer-main section-wrap"><div class="footer-brand"><a class="wordmark" href="/" aria-label="WOW Fashion home">WOW<span>FASHION</span></a><p>For every version<br><em>of you.</em></p><a class="text-link" href="https://wowfashion.com/">Make it yours ${arrow}</a></div><nav class="footer-collections" aria-label="Footer collections"><h2>Explore the wardrobe</h2>${navLinks}</nav><div class="footer-more"><h2>A little more WOW</h2><a href="#the-edit">The selected edit</a><a href="/dresses/club-dresses/">After dark</a><button class="footer-saved js-only" data-open="saved-dialog">Your saved pieces</button><a href="https://wowfashion.com/">Visit WOWFashion.com ${arrow}</a></div></div><div class="footer-bottom section-wrap"><span>© 2026 WOW Fashion</span><span>Campaign imagery is illustrative styling inspiration.</span><a href="#top">Back to top ↑</a></div></footer>

<dialog id="wardrobe-dialog" class="panel-dialog" aria-labelledby="wardrobe-title"><div class="dialog-heading"><h2 id="wardrobe-title">Your whole wardrobe.</h2><button class="close-dialog" aria-label="Close collections menu" autofocus>×</button></div><nav class="wardrobe-links" aria-label="All collections">${navLinks}</nav><a class="menu-night" href="/dresses/club-dresses/"><img src="/dresses/club-dresses/assets/hero-poster.jpg" alt="" loading="lazy" width="640" height="360"><span>A little after dark. ${arrow}</span></a></dialog>
<dialog id="search-dialog" class="panel-dialog" aria-labelledby="search-title"><div class="dialog-heading"><h2 id="search-title">Find your next favourite.</h2><button class="close-dialog" aria-label="Close search">×</button></div><label class="search-label" for="search-input">Search collections and selected pieces</label><div class="search-field">${icon('search')}<input id="search-input" type="search" placeholder="Try cardigans, linen or a dress…" autocomplete="off" autofocus></div><p class="search-status" id="search-status" role="status">Choose a collection or search for something you love.</p><div id="search-results" class="search-results"></div></dialog>
<dialog id="saved-dialog" class="panel-dialog" aria-labelledby="saved-title"><div class="dialog-heading"><h2 id="saved-title">Your little shortlist.</h2><button class="close-dialog" aria-label="Close saved pieces" autofocus>×</button></div><p class="dialog-description">Pieces you love, kept together on this device.</p><div id="saved-pieces" class="saved-pieces"></div><p class="storage-notice" id="storage-notice" hidden>Saving is available for this visit. Your browser is not allowing storage between visits.</p></dialog>
<div class="sr-only" id="save-status" role="status"></div><script type="application/json" id="homepage-data">${config}</script>
</body></html>`;
}
