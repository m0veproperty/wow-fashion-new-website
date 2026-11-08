const escapeAttribute=value=>String(value).replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

/** Reuse the nominated image as a decorative colour field behind the hero. */
export function renderHeroTopBlend(src) {
  const cssUrl=String(src).replace(/["\\\n\r\f]/g,char=>({
    '"':'\\"','\\':'\\\\','\n':'\\a ','\r':'\\d ','\f':'\\c '
  }[char]));
  return `<div class="hero-top-blend" aria-hidden="true" style="${escapeAttribute(`--hero-image:url("${cssUrl}")`)}"></div>`;
}
