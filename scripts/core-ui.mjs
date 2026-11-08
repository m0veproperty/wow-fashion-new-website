export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const arrow = '<span aria-hidden="true">↗</span>';
export const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#core-icon-${name}"></use></svg>`;
export function button(label, href, options = {}) {
  if (typeof options === 'string') options = {className:options};
  return `<a class="button ${esc(options.className || '')}" href="${esc(href)}">${esc(label)} ${arrow}</a>`;
}
export function breadcrumbs(items = []) {
  const list = [{label:'Home',href:'/'},...items];
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${list.map((item,index)=>`${index?'<span aria-hidden="true">/</span>':''}${item.href?`<a href="${esc(item.href)}">${esc(item.label)}</a>`:`<span aria-current="page">${esc(item.label)}</span>`}`).join('')}</nav>`;
}
export function pageIntro({title,description='',eyebrow='',image='',alt='',breadcrumbs:crumbs=[],className=''}) {
  return `<section class="core-intro section-wrap ${image?'core-intro-image ':''}${esc(className)}">${breadcrumbs(crumbs)}<div class="core-intro-layout"><div>${eyebrow?`<p class="eyebrow">${esc(eyebrow)}</p>`:''}<h1>${title}</h1>${description?`<p class="core-intro-description">${esc(description)}</p>`:''}</div>${image?`<div class="core-intro-photo"><img src="${esc(image)}" alt="${esc(alt)}" width="900" height="600" fetchpriority="high"></div>`:''}</div></section>`;
}
export function notice(title,text,kind='info') {
  return `<aside class="notice notice-${esc(kind)}"><strong>${esc(title)}</strong>${text?`<p>${esc(text)}</p>`:''}</aside>`;
}
export function relatedLinks(links,title='Explore more') {
  return `<section class="related-links"><h2>${esc(title)}</h2><div>${links.map(link=>`<a href="${esc(link.href)}"><span><strong>${esc(link.label)}</strong>${link.description?`<small>${esc(link.description)}</small>`:''}</span>${arrow}</a>`).join('')}</div></section>`;
}
export function productCard(product,{save=true}={}) {
  return `<article class="product-card" data-product-id="${esc(product.id)}"><div class="product-image"><a href="${esc(product.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(product.image)}" alt="${esc(product.name)}" width="800" height="800" loading="lazy" decoding="async"></a>${save?`<button class="product-save" type="button" data-save="${esc(product.id)}" aria-label="Save ${esc(product.name)}" aria-pressed="false">${icon('heart')}</button>`:''}</div><p class="product-category">${esc(product.category || product.department)}</p><h3><a href="${esc(product.href)}">${esc(product.name)}</a></h3><a class="product-link" href="${esc(product.href)}">View piece ${arrow}</a></article>`;
}
