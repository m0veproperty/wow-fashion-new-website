/* Decorative atmosphere can be paused independently of the shopping experience. */
document.querySelectorAll('.campaign-hero').forEach(hero => {
  const button = hero.querySelector('.hero-atmosphere-toggle');
  if (!button) return;

  let paused = false;
  try { paused = sessionStorage.getItem('wow-campaign-motion-paused') === 'true'; } catch {}

  const sync = () => {
    hero.dataset.motionPaused = String(paused);
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Resume atmospheric animation' : 'Pause atmospheric animation');
    button.querySelector('.hero-motion-label').textContent = paused ? 'Resume motion' : 'Pause motion';
  };

  button.addEventListener('click', () => {
    paused = !paused;
    sync();
    try { sessionStorage.setItem('wow-campaign-motion-paused', String(paused)); } catch {}
  });
  sync();
});
