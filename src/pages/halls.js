import { api, esc, rub, planSVG, plural } from '../lib.js';
import { sessionChip } from './catalog.js';

export async function halls({ view }) {
  view.innerHTML = `<section class="page"><div class="skeleton-list">${'<div class="sk"></div>'.repeat(3)}</div></section>`;
  const data = await api('/halls');
  const card = (h) => {
    const types = h.seat_types || {};
    const seatsLine = [
      types.sofa ? `${types.sofa} мест на диванах` : null,
      types.accessible ? `${types.accessible} для колясок` : null,
    ].filter(Boolean).join(', ');
    return `
    <article class="hall-card${h.category === 'vip' ? ' is-vip' : ''}" style="--hn:'${h.hall_number}'">
      <header class="hall-card-head">
        <span class="hall-num" aria-hidden="true">${h.hall_number}</span>
        <div>
          <h3 class="hall-name">${h.category === 'vip' ? esc(h.name) : 'Зал ' + h.hall_number}</h3>
          <p class="hall-sub">${esc(h.subtitle || '')}</p>
        </div>
      </header>
      <div class="hall-plan">${planSVG(h.plan)}</div>
      <dl class="hall-facts">
        <div><dt>Мест</dt><dd>${h.capacity}</dd></div>
        <div><dt>Рядов</dt><dd>${h.rows}</dd></div>
        <div><dt>Экран</dt><dd>${Number(h.screen_width_m).toLocaleString('ru-RU')} м</dd></div>
        <div><dt>Билет</dt><dd>от ${rub(h.price_from)}</dd></div>
      </dl>
      <p class="hall-tech">${esc(h.projection)}. ${esc(h.sound_system)}, ${h.speaker_layout.length} ${plural(h.speaker_layout.length, 'колонка', 'колонки', 'колонок')}.${seatsLine ? ' ' + seatsLine + '.' : ''}</p>
      <ul class="feature-list">${(h.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      ${h.next?.length ? `<div class="hall-next"><p class="mini-label">Ближайшие сеансы</p><div class="chips small">${h.next.map((s) => sessionChip(s, s.title)).join('')}</div></div>` : ''}
      <a class="btn btn-ghost hall-cta" href="/hall/${h.id}">Открыть зал в 3D и проверить звук</a>
    </article>`;
  };
  const std = data.halls.filter((h) => h.category === 'standard');
  const vip = data.halls.filter((h) => h.category === 'vip');
  view.innerHTML = `
  <section class="page">
    <h1 class="page-title">Залы</h1>
    <p class="lead">В Киностаре восемь залов. В каждом можно сесть в любое кресло, посмотреть на экран и прослушать колонки так, как они звучат с этого места.</p>
    <h2 class="section-title with-count">Стандартные залы <span>${std.length}</span></h2>
    <div class="hall-grid">${std.map(card).join('')}</div>
    <h2 class="section-title with-count vip">VIP-залы <span>${vip.length}</span></h2>
    <p class="section-note">Реклайнеры, лазерная проекция 4K и увеличенный шаг рядов. В Sphera экран от стены до стены и потолочные каналы звука.</p>
    <div class="hall-grid vip">${vip.map(card).join('')}</div>
  </section>`;
}
