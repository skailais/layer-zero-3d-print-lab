/* Showcase: filterable grid + spec modal */
(function () {
  'use strict';
  document.addEventListener('lz:ready', () => {
    const { $, $$, content, track, toast, modal, motion, esc } = window.LZ;
    let items = [];
    const card = (s, i) => `<div class="card rv corners ${i % 5 === 0 ? 'wide' : ''}" data-id="${esc(s.id)}" id="${esc(s.id)}" data-cursor><span class="c"></span>
      <div class="num">SC-${String(i + 1).padStart(2, '0')}</div>${s.featured ? '<div class="bl"><span class="tag red">FEATURED</span></div>' : ''}
      <div class="img"><img src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy"></div>
      <div class="body"><div><div class="meta"><span>${esc(s.category)}</span><span>${esc(s.material)}</span></div><h3>${esc(s.title)}</h3><p>${esc(s.description).slice(0, 96)}…</p></div><div class="hrs"><b>${esc(s.hours || 0)}h</b>PRINT TIME</div></div></div>`;

    function render(f) {
      const list = f === 'all' ? items : items.filter(s => s.category === f);
      $('#grid').innerHTML = list.map(card).join('') || '<div class="empty-note">Nothing here yet</div>';
      $('#count').textContent = `${list.length} / ${items.length} ENTRIES`;
      motion($('#grid'));
    }
    function open(s) {
      track('showcase_view', s.title);
      modal.open(`<div class="m-grid"><div class="m-img"><img src="${esc(s.image)}" alt="${esc(s.title)}"></div>
        <div class="m-body"><div class="eyebrow"><span class="n">${esc(s.category)}</span> ${s.featured ? 'FEATURED PIECE' : 'ARCHIVE'}</div>
        <h2 class="display h-m">${esc(s.title)}</h2><p class="lead mt-2" style="font-size:15px">${esc(s.description)}</p>
        <div class="spec"><div><b>Material</b><span>${esc(s.material)}</span></div><div><b>Process</b><span>${esc(s.tech)}</span></div><div><b>Dimensions</b><span>${esc(s.dims)}</span></div><div><b>Print time</b><span>${esc(s.hours)} h</span></div></div>
        <div class="m-tags">${(s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="mt-3 flex gap wrapf"><a href="quote.html" class="btn red" data-track="showcase:modal-quote">PRINT SOMETHING LIKE THIS <span class="arr"></span></a></div></div></div>`);
    }
    content().then(c => {
      items = c.showcase; $('#cnt').textContent = String(items.length).padStart(2, '0');
      const cats = Array.from(new Set(items.map(s => s.category)));
      const fl = $('#filters'); const sp = fl.querySelector('.sp');
      cats.forEach(cat => { const b = document.createElement('button'); b.dataset.f = cat; b.textContent = cat.toUpperCase(); fl.insertBefore(b, sp); });
      fl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', fl).forEach(x => x.classList.toggle('active', x === b)); track('filter', 'showcase:' + b.dataset.f); render(b.dataset.f); });
      render('all');
      $('#grid').addEventListener('click', e => { const c = e.target.closest('.card'); if (!c) return; const s = items.find(x => x.id === c.dataset.id); if (s) open(s); });
      if (location.hash) { const s = items.find(x => x.id === location.hash.slice(1)); if (s) setTimeout(() => open(s), 400); }
    }).catch(() => toast('Could not load showcase', true));
  });
})();
