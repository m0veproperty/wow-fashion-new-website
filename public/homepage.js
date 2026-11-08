import {searchCatalog, readSaved, toggleSaved} from './homepage-state.js';

const data = JSON.parse(document.getElementById('homepage-data').textContent);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const validIds = data.products.map(product => product.id);
const savedKey = 'wow-homepage-saved-v1';
let saved = [];
let storageAvailable = true;
try { saved = readSaved(localStorage.getItem(savedKey), validIds); } catch { storageAvailable = false; }
document.documentElement.classList.add('js');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSearch() {
  const query = document.getElementById('search-input').value;
  const matches = searchCatalog(data.search, query);
  const results = document.getElementById('search-results');
  results.replaceChildren();
  document.getElementById('search-status').textContent = !query.trim() ? 'Choose a collection or search for something you love.' : matches.length ? `${matches.length}${matches.length === 24 ? '+' : ''} ${matches.length === 1 ? 'result' : 'results'} for “${query.trim()}”` : 'No matching collections or selected pieces.';
  if (!matches.length) {
    const empty = element('div', 'search-empty');
    empty.append(element('h3', '', 'Let’s try another way.'), element('p', '', 'Try a collection, a fabric or a style. “Cardigans”, “linen” and “dresses” are lovely places to start.'));
    results.append(empty);
    return;
  }
  for (const match of matches) {
    const link = element('a', 'search-result');
    link.href = match.href;
    const label = element('span');
    label.append(element('strong', '', match.name), element('small', '', match.type));
    const arrow = element('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(label, arrow);
    results.append(link);
  }
}
document.getElementById('search-input').addEventListener('input', renderSearch);
renderSearch();

const dialogs = [...document.querySelectorAll('dialog')];
for (const trigger of document.querySelectorAll('[data-open]')) {
  trigger.addEventListener('click', () => {
    const dialog = document.getElementById(trigger.dataset.open);
    document.body.classList.add('dialog-open');
    dialog.showModal();
    if (dialog.id === 'search-dialog') document.getElementById('search-input').focus();
  });
}
for (const dialog of dialogs) {
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (!dialogs.some(item => item.open)) document.body.classList.remove('dialog-open');
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

function renderSaved() {
  document.querySelectorAll('.saved-count').forEach(node => { node.textContent = saved.length ? String(saved.length) : ''; });
  document.querySelectorAll('[data-open="saved-dialog"]').forEach(node => node.setAttribute('aria-label', `Open saved pieces${saved.length ? `, ${saved.length} saved` : ''}`));
  document.querySelectorAll('[data-save]').forEach(button => {
    const active = saved.includes(button.dataset.save);
    const product = data.products.find(product => product.id === button.dataset.save);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', `${active ? 'Unsave' : 'Save'} ${product.name}`);
  });
  const list = document.getElementById('saved-pieces');
  list.replaceChildren();
  document.getElementById('storage-notice').hidden = storageAvailable;
  if (!saved.length) {
    const empty = element('div', 'saved-empty');
    const browse = element('a', 'button', 'Explore the selected edit ↗');
    browse.href = '#the-edit';
    browse.addEventListener('click', () => document.getElementById('saved-dialog').close());
    empty.append(element('h3', '', 'Something will catch your eye.'), element('p', '', 'Tap a heart in the selected edit to keep your favourite pieces here.'), browse);
    list.append(empty);
  }
  for (const id of saved) {
    const product = data.products.find(item => item.id === id);
    const row = element('article', 'saved-item');
    const photoLink = element('a'); photoLink.href = product.href; photoLink.tabIndex = -1; photoLink.setAttribute('aria-hidden', 'true');
    const photo = element('img'); photo.src = product.image; photo.alt = ''; photo.width = 92; photo.height = 92;
    photoLink.append(photo);
    const info = element('div');
    const title = element('h3');
    const productLink = element('a', '', product.name); productLink.href = product.href;
    title.append(productLink);
    const remove = element('button', '', 'Remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${product.name} from saved pieces`);
    remove.addEventListener('click', () => {
      const position = saved.indexOf(id);
      saveProduct(id);
      const remaining = document.querySelectorAll('#saved-pieces button');
      (remaining[Math.min(position, remaining.length - 1)] || document.querySelector('#saved-pieces a') || document.querySelector('#saved-dialog .close-dialog')).focus();
    });
    info.append(element('small', '', product.category), title, remove);
    row.append(photoLink, info); list.append(row);
  }
}
function saveProduct(id) {
  const wasSaved = saved.includes(id);
  saved = toggleSaved(saved, id, validIds);
  try { localStorage.setItem(savedKey, JSON.stringify(saved)); storageAvailable = true; } catch { storageAvailable = false; }
  renderSaved();
  const product = data.products.find(item => item.id === id);
  document.getElementById('save-status').textContent = `${product.name} ${wasSaved ? 'removed from' : 'added to'} your saved pieces.`;
}
for (const button of document.querySelectorAll('[data-save]')) button.addEventListener('click', () => saveProduct(button.dataset.save));
window.addEventListener('storage', event => {
  if (event.key === savedKey || event.key === null) {
    saved = readSaved(event.newValue, validIds);
    renderSaved();
  }
});
renderSaved();

const railUpdates = [];
for (const railId of ['collection-track', 'product-track']) {
  const rail = document.getElementById(railId);
  const previous = document.querySelector(`[data-rail="${railId}"][data-direction="-1"]`);
  const next = document.querySelector(`[data-rail="${railId}"][data-direction="1"]`);
  const update = () => {
    previous.disabled = rail.scrollLeft <= 3;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 3;
  };
  for (const button of [previous, next]) {
    button.addEventListener('click', () => rail.scrollBy({left:rail.clientWidth * .85 * Number(button.dataset.direction), behavior:reducedMotion.matches ? 'instant' : 'smooth'}));
  }
  rail.addEventListener('scroll', update, {passive:true});
  new ResizeObserver(update).observe(rail);
  railUpdates.push(update);
  update();
}
for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let count = 0;
    document.querySelectorAll('.piece').forEach(piece => {
      piece.hidden = filter !== 'all' && piece.dataset.group !== filter;
      if (!piece.hidden) count++;
    });
    document.getElementById('edit-count').textContent = `${count} pieces to explore`;
    document.getElementById('product-track').scrollTo({left:0, behavior:'instant'});
    railUpdates.forEach(update => update());
  });
}

const heroMotion = document.getElementById('hero-motion');
let heroPaused = reducedMotion.matches;
function updateHeroMotion() {
  heroMotion.hidden = reducedMotion.matches;
  document.documentElement.classList.toggle('motion-paused', heroPaused);
  heroMotion.setAttribute('aria-pressed', String(heroPaused));
  heroMotion.setAttribute('aria-label', heroPaused ? 'Play atmospheric animation' : 'Pause atmospheric animation');
  heroMotion.firstElementChild.className = heroPaused ? 'play-mark' : 'pause-mark';
  heroMotion.lastElementChild.textContent = heroPaused ? 'Play motion' : 'Pause motion';
}
heroMotion.addEventListener('click', () => { heroPaused = !heroPaused; updateHeroMotion(); });
updateHeroMotion();

const film = document.getElementById('night-film');
const filmButton = document.getElementById('night-motion');
let filmLoaded = false;
let filmInView = false;
let filmPausedByUser = false;
let explicitPlayback = false;
let filmError = false;
function updateFilmButton() {
  const playing = !film.paused;
  filmButton.firstElementChild.className = playing ? 'pause-mark' : 'play-mark';
  filmButton.lastElementChild.textContent = playing ? 'Pause film' : 'Play film';
  filmButton.setAttribute('aria-label', playing ? 'Pause evening campaign film' : 'Play evening campaign film');
  filmButton.setAttribute('aria-pressed', String(playing));
}
async function playFilm(explicit = false) {
  if (filmError || (!explicit && (filmPausedByUser || reducedMotion.matches))) return;
  if (!filmLoaded) {
    const source = film.querySelector('source');
    source.src = source.dataset.src;
    film.muted = true;
    film.load();
    filmLoaded = true;
  }
  try { await film.play(); } catch { updateFilmButton(); }
}
filmButton.addEventListener('click', () => {
  if (film.paused) { filmPausedByUser = false; explicitPlayback = true; playFilm(true); }
  else { filmPausedByUser = true; explicitPlayback = false; film.pause(); }
});
film.addEventListener('play', updateFilmButton);
film.addEventListener('pause', updateFilmButton);
film.addEventListener('error', () => {
  filmError = true;
  filmButton.hidden = true;
});
new IntersectionObserver(entries => {
  for (const entry of entries) {
    filmInView = entry.isIntersecting;
    if (filmInView && !document.hidden) playFilm(explicitPlayback);
    else film.pause();
  }
}, {threshold:.15}).observe(film);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) film.pause();
  else if (filmInView) playFilm(explicitPlayback);
});
updateFilmButton();

if (!reducedMotion.matches) {
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }, {threshold:.08, rootMargin:'0px 0px 30px 0px'});
  document.querySelectorAll('.reveal').forEach(node => revealObserver.observe(node));
  document.documentElement.classList.add('motion-ready');
}
reducedMotion.addEventListener('change', () => {
  heroPaused = reducedMotion.matches;
  updateHeroMotion();
  if (reducedMotion.matches) { explicitPlayback = false; film.pause(); document.documentElement.classList.remove('motion-ready'); }
});
