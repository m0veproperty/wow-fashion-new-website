const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
document.documentElement.classList.add('js');

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
