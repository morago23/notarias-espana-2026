/* ===================================================
   NOTARÍAS ES — app.js
   Main application logic
   =================================================== */

// ===== COLEGIO METADATA =====
const COLEGIO_META = {
  'Colegio Notarial de Andalucía': { flag: '🏖️', region: 'Andalucía' },
  'Colegio Notarial de Aragón': { flag: '🏰', region: 'Aragón' },
  'Colegio Notarial de Asturias': { flag: '🌿', region: 'Asturias' },
  'Colegio Notarial de Cantabria': { flag: '🌊', region: 'Cantabria' },
  'Colegio Notarial de Castilla-La Mancha': { flag: '🌾', region: 'Castilla-La Mancha' },
  'Colegio Notarial de Castilla y León': { flag: '🏯', region: 'Castilla y León' },
  'Colegio Notarial de Cataluña': { flag: '🦅', region: 'Cataluña' },
  'Colegio Notarial de Extremadura': { flag: '🦌', region: 'Extremadura' },
  'Colegio Notarial de Galicia': { flag: '🐚', region: 'Galicia' },
  'Colegio Notarial de La Rioja': { flag: '🍇', region: 'La Rioja' },
  'Colegio Notarial de las Illes Balears': { flag: '🏝️', region: 'Illes Balears' },
  'Colegio Notarial de las Islas Canarias': { flag: '🌋', region: 'Islas Canarias' },
  'Colegio Notarial de Madrid': { flag: '🏙️', region: 'Comunidad de Madrid' },
  'Colegio Notarial de Murcia': { flag: '🌞', region: 'Región de Murcia' },
  'Colegio Notarial de Navarra': { flag: '🐂', region: 'Comunidad Foral de Navarra' },
  'Colegio Notarial del País Vasco': { flag: '⛰️', region: 'País Vasco' },
  'Colegio Notarial de Valencia': { flag: '🍊', region: 'Comunitat Valenciana' },
};

// ===== STATE =====
const state = {
  notariasSorted: [...DATA_NOTARIAS],
  notariasFiltered: [...DATA_NOTARIAS],
  notariasPage: 1,
  notariasPerPage: 25,
  sortCol: null,
  sortDir: 'asc',

  vacantesFiltered: [...DATA_VACANTES],
};

// Build vacantes lookup for table
const vacantesSet = new Set();
DATA_VACANTES.forEach(v => {
  const key = normalize(v.localidad.replace(/\s*\(.*\)/, '').trim()) + '|' + normalize(v.provincia);
  vacantesSet.add(key);
});

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isVacante(notaria) {
  const keyLoc = normalize(notaria.localidad) + '|' + normalize(notaria.provincia);
  return vacantesSet.has(keyLoc);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initStats();
  initColegios();
  initNotariasTable();
  initVacantesSection();
  initScrollSpy();
});

// ===== NAVBAR =====
function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

// ===== SCROLL SPY =====
function initScrollSpy() {
  const sections = ['inicio', 'notarias', 'vacantes', 'colegios'];
  const links = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ===== STATS COUNTER =====
function initStats() {
  // Count vacantes by type
  const tipoCount = { Resulta: 0, Desierta: 0, Jubilación: 0 };
  DATA_VACANTES.forEach(v => {
    if (v.clase === 'Resulta') tipoCount.Resulta++;
    else if (v.clase === 'Desierta') tipoCount.Desierta++;
    else tipoCount.Jubilación++;
  });

  const total = DATA_VACANTES.length;
  const desierta = tipoCount.Desierta;

  document.getElementById('stat-vacantes-num').setAttribute('data-target', total);
  document.getElementById('stat-desierta-num').setAttribute('data-target', desierta);
  document.getElementById('nav-vacantes-count').textContent = total;
  document.getElementById('footer-vacantes').textContent = total;

  // Animate all counters
  document.querySelectorAll('.stat-number[data-target]').forEach(el => {
    const target = parseInt(el.getAttribute('data-target'));
    animateCounter(el, 0, target, 1800);
  });
}

function animateCounter(el, from, to, duration) {
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString('es-ES');
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ===== COLEGIOS GRID =====
function initColegios() {
  const grid = document.getElementById('colegios-grid');

  // Count vacantes per colegio region
  const vacantesPerRegion = {};
  DATA_VACANTES.forEach(v => {
    const r = v.comunidad;
    vacantesPerRegion[r] = (vacantesPerRegion[r] || 0) + 1;
  });

  grid.innerHTML = DATA_RESUMEN.map(item => {
    const shortName = item.colegio.replace('Colegio Notarial de ', '').replace('Colegio Notarial del ', '');
    const meta = COLEGIO_META[item.colegio] || { flag: '📋', region: shortName };
    const totalNotarias = parseInt(item.total);

    // Count notarías for this colegio in data
    const colegioNotarias = DATA_NOTARIAS.filter(n => n.colegio === item.colegio);
    const primeraCount = colegioNotarias.filter(n => n.clase === 'Primera').length;

    return `
      <div class="colegio-card">
        <div class="colegio-flag">${meta.flag}</div>
        <div class="colegio-name">${item.colegio.replace('Colegio Notarial ', '')}</div>
        <div class="colegio-region">${meta.region}</div>
        <div class="colegio-stats">
          <div class="colegio-stat">
            <span class="colegio-stat-num">${parseInt(item.total).toLocaleString('es-ES')}</span>
            <span class="colegio-stat-label">Notarías</span>
          </div>
          <div class="colegio-stat">
            <span class="colegio-stat-num">${primeraCount}</span>
            <span class="colegio-stat-label">De 1ª</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== NOTARÍAS TABLE =====
function initNotariasTable() {
  // Populate filters
  const colegios = [...new Set(DATA_NOTARIAS.map(n => n.colegio))].sort();
  const provincias = [...new Set(DATA_NOTARIAS.map(n => n.provincia))].sort();

  const filterColegio = document.getElementById('filter-colegio');
  colegios.forEach(c => {
    filterColegio.innerHTML += `<option value="${c}">${c.replace('Colegio Notarial ', '')}</option>`;
  });

  const filterProv = document.getElementById('filter-provincia');
  provincias.forEach(p => {
    filterProv.innerHTML += `<option value="${p}">${p}</option>`;
  });

  // Event listeners
  document.getElementById('search-notarias').addEventListener('input', debounce(filterNotarias, 250));
  document.getElementById('filter-colegio').addEventListener('change', filterNotarias);
  document.getElementById('filter-provincia').addEventListener('change', filterNotarias);
  document.getElementById('filter-clase').addEventListener('change', filterNotarias);

  // Sorting
  document.querySelectorAll('#notarias-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'asc';
      }
      document.querySelectorAll('#notarias-table th').forEach(t => {
        t.classList.remove('sorted-asc', 'sorted-desc');
      });
      th.classList.add(state.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      filterNotarias();
    });
  });

  filterNotarias();
}

function filterNotarias() {
  const search = normalize(document.getElementById('search-notarias').value);
  const colegioFilter = document.getElementById('filter-colegio').value;
  const provFilter = document.getElementById('filter-provincia').value;
  const claseFilter = document.getElementById('filter-clase').value;

  let filtered = DATA_NOTARIAS.filter(n => {
    if (colegioFilter && n.colegio !== colegioFilter) return false;
    if (provFilter && n.provincia !== provFilter) return false;
    if (claseFilter && n.clase !== claseFilter) return false;
    if (search) {
      const haystack = normalize([n.localidad, n.provincia, n.distrito, n.colegio].join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  // Sort
  if (state.sortCol) {
    filtered.sort((a, b) => {
      let aVal = a[state.sortCol] || '';
      let bVal = b[state.sortCol] || '';
      if (state.sortCol === 'numero') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
        return state.sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = aVal.localeCompare(bVal, 'es');
      return state.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  state.notariasFiltered = filtered;
  state.notariasPage = 1;
  document.getElementById('notarias-count').textContent = filtered.length.toLocaleString('es-ES');
  renderNotariasTable();
}

function renderNotariasTable() {
  const { notariasFiltered, notariasPage, notariasPerPage } = state;
  const search = document.getElementById('search-notarias').value;
  const tbody = document.getElementById('notarias-tbody');
  const start = (notariasPage - 1) * notariasPerPage;
  const page = notariasFiltered.slice(start, start + notariasPerPage);

  if (page.length === 0) {
    tbody.innerHTML = `<tr class="no-results-row"><td colspan="7">No se encontraron notarías con los filtros aplicados.</td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = page.map(n => {
    const isV = isVacante(n);
    const claseClass = {
      'Primera': 'clase-primera',
      'Segunda': 'clase-segunda',
      'Tercera': 'clase-tercera'
    }[n.clase] || '';

    const shortColegio = n.colegio
      .replace('Colegio Notarial de las ', '')
      .replace('Colegio Notarial de la ', '')
      .replace('Colegio Notarial del ', '')
      .replace('Colegio Notarial de ', '');

    const localidadHighlighted = search
      ? highlightText(n.localidad, search)
      : n.localidad;

    return `
      <tr>
        <td title="${n.colegio}">${shortColegio}</td>
        <td>${n.provincia}</td>
        <td>${n.distrito}</td>
        <td class="td-localidad">${localidadHighlighted}${n.notas ? `<span class="vacante-nota" title="${n.notas}"> ⓘ</span>` : ''}</td>
        <td class="td-center"><strong>${n.numero}</strong></td>
        <td class="td-center"><span class="clase-badge ${claseClass}">${n.clase}</span></td>
        <td class="td-center">${isV ? '<span class="vacante-indicator vacante-si" title="Plaza vacante">✓</span>' : ''}</td>
      </tr>
    `;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const { notariasFiltered, notariasPage, notariasPerPage } = state;
  const totalPages = Math.ceil(notariasFiltered.length / notariasPerPage);
  const container = document.getElementById('notarias-pagination');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let pages = [];
  const delta = 2;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= notariasPage - delta && i <= notariasPage + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  container.innerHTML = `
    <button class="page-btn" onclick="goToPage(${notariasPage - 1})" ${notariasPage === 1 ? 'disabled' : ''}>←</button>
    ${pages.map(p =>
      p === '…'
        ? `<span class="page-btn" style="cursor:default">…</span>`
        : `<button class="page-btn ${p === notariasPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`
    ).join('')}
    <button class="page-btn" onclick="goToPage(${notariasPage + 1})" ${notariasPage === totalPages ? 'disabled' : ''}>→</button>
  `;
}

function goToPage(page) {
  const totalPages = Math.ceil(state.notariasFiltered.length / state.notariasPerPage);
  if (page < 1 || page > totalPages) return;
  state.notariasPage = page;
  renderNotariasTable();
  document.getElementById('notarias').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function highlightText(text, query) {
  if (!query) return text;
  const q = normalize(query);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(re, match => `<mark>${match}</mark>`);
}

// ===== VACANTES SECTION =====
function initVacantesSection() {
  // Count by type
  const counts = {};
  DATA_VACANTES.forEach(v => {
    const tipo = v.clase;
    counts[tipo] = (counts[tipo] || 0) + 1;
  });

  const resulta = counts['Resulta'] || 0;
  const desierta = counts['Desierta'] || 0;
  const jubilacion = (counts['Jubilación'] || 0) + (counts['Jubilación voluntaria'] || 0);

  const summary = document.getElementById('vacantes-summary');
  summary.innerHTML = `
    <div class="summary-chip summary-chip-resulta" onclick="filterVacantesByTipo('Resulta')">
      📋 Resulta <span class="chip-count">${resulta}</span>
    </div>
    <div class="summary-chip summary-chip-desierta" onclick="filterVacantesByTipo('Desierta')">
      🔴 Desierta <span class="chip-count">${desierta}</span>
    </div>
    <div class="summary-chip summary-chip-jubilacion" onclick="filterVacantesByTipo('Jubilación')">
      👤 Jubilación <span class="chip-count">${jubilacion}</span>
    </div>
    <div class="summary-chip" style="background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text-secondary)" onclick="filterVacantesByTipo('')">
      🔍 Todas <span class="chip-count" style="background:rgba(255,255,255,0.1)">${DATA_VACANTES.length}</span>
    </div>
  `;

  // Populate communities filter
  const comunidades = [...new Set(DATA_VACANTES.map(v => v.comunidad))].sort();
  const filterCom = document.getElementById('filter-vacante-comunidad');
  comunidades.forEach(c => {
    filterCom.innerHTML += `<option value="${c}">${c}</option>`;
  });

  document.getElementById('search-vacantes').addEventListener('input', debounce(filterVacantes, 250));
  document.getElementById('filter-vacante-comunidad').addEventListener('change', filterVacantes);
  document.getElementById('filter-vacante-tipo').addEventListener('change', filterVacantes);

  renderVacantes(DATA_VACANTES);
}

function filterVacantesByTipo(tipo) {
  const select = document.getElementById('filter-vacante-tipo');
  select.value = tipo;
  filterVacantes();
  document.getElementById('vacantes').scrollIntoView({ behavior: 'smooth' });
}

function filterVacantes() {
  const search = normalize(document.getElementById('search-vacantes').value);
  const comunidadFilter = document.getElementById('filter-vacante-comunidad').value;
  const tipoFilter = document.getElementById('filter-vacante-tipo').value;

  let filtered = DATA_VACANTES.filter(v => {
    if (comunidadFilter && v.comunidad !== comunidadFilter) return false;
    if (tipoFilter) {
      if (tipoFilter === 'Jubilación') {
        if (!v.clase.startsWith('Jubilación')) return false;
      } else {
        if (v.clase !== tipoFilter) return false;
      }
    }
    if (search) {
      const haystack = normalize([v.localidad, v.provincia, v.comunidad, v.notas].join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  document.getElementById('vacantes-count').textContent = filtered.length;
  renderVacantes(filtered);
}

function renderVacantes(vacantes) {
  const grid = document.getElementById('vacantes-grid');
  const search = document.getElementById('search-vacantes').value;

  if (vacantes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No se encontraron vacantes</div>
        <div class="empty-state-text">Intenta modificar los filtros de búsqueda</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = vacantes.map(v => {
    const tipo = v.clase || 'Resulta';
    const tipoClass = tipo.toLowerCase().replace(/\s+/g, '-').replace('ó', 'o').replace('ú', 'u');
    const badgeClass = `tipo-${tipoClass}-badge`;

    // Clean localidad
    const localidadRaw = v.localidad;
    const notario = localidadRaw.match(/\((Don|Doña)\s[^)]+\)/);
    const localidadClean = localidadRaw.replace(/\s*\((Don|Doña)[^)]+\)/, '').trim();

    const localidadHL = search ? highlightText(localidadClean, search) : localidadClean;

    return `
      <div class="vacante-card tipo-${tipoClass}">
        <div class="vacante-header">
          <div class="vacante-localidad">${localidadHL}</div>
          <span class="tipo-badge ${badgeClass}">${tipo}</span>
        </div>
        <div class="vacante-meta">
          <div class="vacante-meta-item">
            <span class="vacante-meta-icon">📍</span>
            <span>${v.provincia}${v.comunidad ? ` · ${v.comunidad}` : ''}</span>
          </div>
          ${v.notas && v.notas !== 'Vacante' ? `
          <div class="vacante-meta-item">
            <span class="vacante-meta-icon">📄</span>
            <span>${v.notas}</span>
          </div>` : ''}
          ${notario ? `
          <div class="vacante-meta-item">
            <span class="vacante-meta-icon">👤</span>
            <span>${notario[0].replace('(', '').replace(')', '')}</span>
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== UTILITIES =====
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
