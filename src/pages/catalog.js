import { api, esc, rub, time, dayKey, dayLabel, duration, poster } from '../lib.js';
import { motifSVG } from '../ornament.js';

const FILTERS = [['all', 'Все залы'], ['standard', 'Стандартные'], ['vip', 'VIP']];

function dateStrip(keys, current) {
  return `<div class="date-strip" role="tablist" aria-label="Дата сеанса">${keys.map((k) => {
    const l = dayLabel(k);
    return `<button role="tab" class="date-btn${k === current ? ' is-active' : ''}" aria-selected="${k === current}" data-day="${k}"><span>${l.top}</span><small>${l.bottom}</small></button>`;
  }).join('')}</div>`;
}
function filterBar(current) {
  return `<div class="seg" role="radiogroup" aria-label="Тип зала">${FILTERS.map(([k, t]) =>
    `<button role="radio" class="seg-btn${k === current ? ' is-active' : ''}" aria-checked="${k === current}" data-cat="${k}">${t}</button>`).join('')}</div>`;
}
export function sessionChip(s, sub = null) {
  const few = s.free > 0 && s.free / s.total < 0.15;
  const label = sub || (s.category === 'vip' ? s.hall_name : `Зал ${s.hall_number}`);
  return `<a class="chip-session${s.category === 'vip' ? ' is-vip' : ''}${s.free === 0 ? ' is-full' : ''}" href="/session/${s.id}"
    aria-label="${time(s.starts_at)}, ${esc(label)}, от ${rub(s.min_price ?? 0)}${few ? ', мало мест' : ''}">
    <strong>${time(s.starts_at)}</strong>
    <span class="cs-hall">${esc(label)}</span>
    <span class="cs-price">${s.free === 0 ? 'мест нет' : 'от ' + rub(s.min_price)}</span>
    ${few ? '<span class="cs-few">мало мест</span>' : ''}
  </a>`;
}
const days = (sessions) => [...new Set(sessions.map((s) => dayKey(s.starts_at)))].sort().slice(0, 7);

// ---------- Афиша ----------
export async function home({ view, query }) {
  view.innerHTML = `
  <section class="hero">
    <div class="hero-mark" aria-hidden="true">${motifSVG({ stroke: '#c9a04a', accent: '#9e2236', width: 1.6, draw: true })}</div>
    <div class="hero-copy">
      <p class="hero-place">Киностар, Грозный Молл</p>
      <h1 class="hero-title">Сядьте в кресло до того, как купите билет</h1>
      <p class="lead">Восемь залов, от камерного VIP Lounge до флагманской Sphera. Откройте зал в 3D, посмотрите на экран с любого места и проверьте, как звучат колонки именно там.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#afisha" data-scroll>Выбрать сеанс</a>
        <a class="btn btn-ghost" href="/halls">Посмотреть залы</a>
      </div>
    </div>
  </section>
  <section class="page" id="afisha">
    <div class="afisha-head">
      <h2 class="section-title">Афиша</h2>
      <div id="filters"></div>
    </div>
    <div id="dates"></div>
    <div id="movies" class="movie-list" aria-live="polite"><div class="skeleton-list">${'<div class="sk"></div>'.repeat(3)}</div></div>
  </section>`;
  view.querySelector('[data-scroll]').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('afisha').scrollIntoView({ behavior: 'smooth' }); });

  const data = await api('/catalog');
  const keys = days(data.sessions);
  let day = keys.includes(query.get('day')) ? query.get('day') : keys[0];
  let cat = ['all', 'standard', 'vip'].includes(query.get('halls')) ? query.get('halls') : 'all';

  const draw = () => {
    view.querySelector('#filters').innerHTML = filterBar(cat);
    view.querySelector('#dates').innerHTML = dateStrip(keys, day);
    const list = data.movies.map((m) => ({
      m, s: data.sessions.filter((s) => s.movie_id === m.id && dayKey(s.starts_at) === day && (cat === 'all' || s.category === cat)),
    })).filter((x) => x.s.length);
    view.querySelector('#movies').innerHTML = list.length ? list.map(({ m, s }) => `
      <article class="movie-row">
        <a class="movie-poster" href="/movie/${m.id}" aria-label="${esc(m.title)}">${poster(m)}<span class="age-badge">${esc(m.age_rating)}</span></a>
        <div class="movie-info">
          <h3 class="movie-title"><a href="/movie/${m.id}">${esc(m.title)}</a></h3>
          <p class="movie-meta">${esc(m.genre)}, ${duration(m.duration_minutes)}</p>
          <p class="movie-tagline">${esc(m.tagline || '')}</p>
          <div class="chips">${s.map((x) => sessionChip(x)).join('')}</div>
        </div>
      </article>`).join('') : `<div class="empty"><p>На этот день в выбранных залах сеансов нет.</p><button class="btn btn-ghost" data-cat="all">Показать все залы</button></div>`;
    const q = new URLSearchParams({ day, halls: cat });
    history.replaceState(null, '', `/?${q}` + (location.hash || ''));
  };
  view.addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]'); const c = e.target.closest('[data-cat]');
    if (d) { day = d.dataset.day; draw(); }
    if (c) { cat = c.dataset.cat; draw(); }
  });
  draw();
  if (location.hash === '#afisha') document.getElementById('afisha').scrollIntoView();
}

// ---------- Фильм ----------
export async function movie({ view, params }) {
  const data = await api('/movies/' + params[0]);
  const m = data.movie;
  const keys = days(data.sessions);
  let day = keys[0];
  view.innerHTML = `
  <section class="movie-hero" style="--c1:${m.palette?.[0] || '#c9a04a'};--c2:${m.palette?.[1] || '#3a1420'}">
    <div class="movie-hero-poster">${poster(m, 'poster-svg big')}</div>
    <div class="movie-hero-copy">
      <a class="back-link" href="/">Афиша</a>
      <h1 class="page-title">${esc(m.title)}</h1>
      <p class="movie-tagline big">${esc(m.tagline || '')}</p>
      <dl class="facts">
        <div><dt>Жанр</dt><dd>${esc(m.genre)}</dd></div>
        <div><dt>Длительность</dt><dd>${duration(m.duration_minutes)}</dd></div>
        <div><dt>Возраст</dt><dd>${esc(m.age_rating)}</dd></div>
        <div><dt>Страна, год</dt><dd>${esc(m.country || 'Россия')}, ${m.release_year || ''}</dd></div>
      </dl>
      <p class="lead">${esc(m.synopsis || '')}</p>
    </div>
  </section>
  <section class="page">
    <h2 class="section-title">Сеансы</h2>
    <div id="dates"></div>
    <div id="sessions"></div>
  </section>`;
  const draw = () => {
    view.querySelector('#dates').innerHTML = keys.length ? dateStrip(keys, day) : '';
    const s = data.sessions.filter((x) => dayKey(x.starts_at) === day);
    const groups = [['standard', 'Стандартные залы'], ['vip', 'VIP-залы']].map(([k, t]) => [t, s.filter((x) => x.category === k)]).filter(([, l]) => l.length);
    view.querySelector('#sessions').innerHTML = keys.length ? groups.map(([t, l]) => `<h3 class="sub-head">${t}</h3><div class="chips">${l.map((x) => sessionChip(x)).join('')}</div>`).join('')
      : '<div class="empty"><p>Сеансов на ближайшую неделю пока нет.</p></div>';
  };
  view.addEventListener('click', (e) => { const d = e.target.closest('[data-day]'); if (d) { day = d.dataset.day; draw(); } });
  draw();
}
