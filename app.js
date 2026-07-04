// State
const state = {
  notariasFiltered: [...DATA_NOTARIAS],
  notariasPage: 1,
  notariasPerPage: 50,
  notariasSortCol: null,
  notariasSortDir: 'asc',

  vacantesFiltered: [...DATA_VACANTES],
  vacantesSortCol: null,
  vacantesSortDir: 'asc',
};

// Utilities
function normalize(str) {
  if (!str) return '';
  return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function highlightText(text, query) {
  if (!query) return escapeHTML(text);
  const escapedText = escapeHTML(text);
  const q = normalize(query);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  // Simple highlight (might highlight inside words)
  // To be safe with html entities, better to highlight before escape or just be careful.
  // Given simplicity, we apply regex carefully.
  return escapedText.replace(new RegExp(q, 'gi'), match => `<mark>${match}</mark>`);
}

// Vacantes matching
const vacantesSet = new Set();
DATA_VACANTES.forEach(v => {
  const locRaw = v.localidad || '';
  const locClean = locRaw.replace(/\s*\([^)]*\)/g, '').trim();
  const key = normalize(locClean) + '|' + normalize(v.provincia);
  vacantesSet.add(key);
});

function isVacante(notaria) {
  const key = normalize(notaria.localidad) + '|' + normalize(notaria.provincia);
  return vacantesSet.has(key);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initNotarias();
  initVacantes();
});

// Tabs
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(btn.getAttribute('data-target')).classList.add('active');
    });
  });
}

// Notarias
function initNotarias() {
  // Populate filters
  const colegios = [...new Set(DATA_NOTARIAS.map(n => n.colegio))].sort();
  const filterColegio = document.getElementById('filter-colegio');
  colegios.forEach(c => filterColegio.innerHTML += `<option value="${escapeHTML(c)}">${escapeHTML(c.replace('Colegio Notarial ', ''))}</option>`);

  const provincias = [...new Set(DATA_NOTARIAS.map(n => n.provincia))].sort();
  const filterProvincia = document.getElementById('filter-provincia');
  provincias.forEach(p => filterProvincia.innerHTML += `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`);

  // Events
  document.getElementById('search-notarias').addEventListener('input', debounce(filterNotarias, 300));
  document.getElementById('filter-colegio').addEventListener('change', filterNotarias);
  document.getElementById('filter-provincia').addEventListener('change', filterNotarias);
  document.getElementById('filter-clase').addEventListener('change', filterNotarias);

  document.querySelectorAll('#notarias-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      if (state.notariasSortCol === col) {
        state.notariasSortDir = state.notariasSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.notariasSortCol = col;
        state.notariasSortDir = 'asc';
      }
      document.querySelectorAll('#notarias-table th').forEach(t => t.className = t.className.replace(/sorted-(asc|desc)/, '').trim());
      th.classList.add(`sorted-${state.notariasSortDir}`);
      filterNotarias();
    });
  });

  filterNotarias();
}

function filterNotarias() {
  const search = normalize(document.getElementById('search-notarias').value);
  const colF = document.getElementById('filter-colegio').value;
  const provF = document.getElementById('filter-provincia').value;
  const clasF = document.getElementById('filter-clase').value;

  let filtered = DATA_NOTARIAS.filter(n => {
    if (colF && n.colegio !== colF) return false;
    if (provF && n.provincia !== provF) return false;
    if (clasF && n.clase !== clasF) return false;
    if (search) {
      const txt = normalize(`${n.localidad} ${n.provincia} ${n.distrito} ${n.colegio}`);
      if (!txt.includes(search)) return false;
    }
    return true;
  });

  if (state.notariasSortCol) {
    filtered.sort((a, b) => {
      let vA = a[state.notariasSortCol] || '';
      let vB = b[state.notariasSortCol] || '';
      if (state.notariasSortCol === 'numero') {
        vA = parseInt(vA) || 0;
        vB = parseInt(vB) || 0;
        return state.notariasSortDir === 'asc' ? vA - vB : vB - vA;
      }
      const cmp = String(vA).localeCompare(String(vB), 'es');
      return state.notariasSortDir === 'asc' ? cmp : -cmp;
    });
  }

  state.notariasFiltered = filtered;
  state.notariasPage = 1;
  document.getElementById('notarias-count').textContent = filtered.length.toLocaleString('es-ES');
  renderNotarias();
}

function renderNotarias() {
  const tbody = document.getElementById('notarias-tbody');
  const start = (state.notariasPage - 1) * state.notariasPerPage;
  const page = state.notariasFiltered.slice(start, start + state.notariasPerPage);

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="center">No hay resultados.</td></tr>`;
    document.getElementById('notarias-pagination').innerHTML = '';
    return;
  }

  const query = document.getElementById('search-notarias').value;

  tbody.innerHTML = page.map(n => {
    const isV = isVacante(n);
    const claseBadge = n.clase === 'Primera' ? 'badge-primera' : n.clase === 'Segunda' ? 'badge-segunda' : 'badge-tercera';
    const cName = n.colegio.replace('Colegio Notarial de las ', '').replace('Colegio Notarial de la ', '').replace('Colegio Notarial del ', '').replace('Colegio Notarial de ', '');

    return `
      <tr>
        <td>${escapeHTML(cName)}</td>
        <td>${escapeHTML(n.provincia)}</td>
        <td>${escapeHTML(n.distrito)}</td>
        <td>
          <strong>${highlightText(n.localidad, query)}</strong>
          ${n.notas ? `<br><small style="color:#6c757d">${escapeHTML(n.notas)}</small>` : ''}
        </td>
        <td class="center">${escapeHTML(n.numero)}</td>
        <td class="center"><span class="badge ${claseBadge}">${escapeHTML(n.clase)}</span></td>
        <td class="center">${isV ? '<span class="vacante-si" title="Plaza vacante">✓</span>' : ''}</td>
      </tr>
    `;
  }).join('');

  renderPagination('notarias-pagination', state.notariasFiltered.length, state.notariasPerPage, state.notariasPage, (p) => {
    state.notariasPage = p;
    renderNotarias();
    document.getElementById('tab-notarias').scrollIntoView({ behavior: 'smooth' });
  });
}

// Vacantes
function initVacantes() {
  const coms = [...new Set(DATA_VACANTES.map(v => v.comunidad).filter(Boolean))].sort();
  const filterCom = document.getElementById('filter-vacante-comunidad');
  coms.forEach(c => filterCom.innerHTML += `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`);

  document.getElementById('search-vacantes').addEventListener('input', debounce(filterVacantes, 300));
  document.getElementById('filter-vacante-comunidad').addEventListener('change', filterVacantes);
  document.getElementById('filter-vacante-tipo').addEventListener('change', filterVacantes);

  document.querySelectorAll('#vacantes-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      if (state.vacantesSortCol === col) {
        state.vacantesSortDir = state.vacantesSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.vacantesSortCol = col;
        state.vacantesSortDir = 'asc';
      }
      document.querySelectorAll('#vacantes-table th').forEach(t => t.className = t.className.replace(/sorted-(asc|desc)/, '').trim());
      th.classList.add(`sorted-${state.vacantesSortDir}`);
      filterVacantes();
    });
  });

  filterVacantes();
}

function filterVacantes() {
  const search = normalize(document.getElementById('search-vacantes').value);
  const comF = document.getElementById('filter-vacante-comunidad').value;
  const tipoF = document.getElementById('filter-vacante-tipo').value;

  let filtered = DATA_VACANTES.filter(v => {
    if (comF && v.comunidad !== comF) return false;
    if (tipoF) {
      if (tipoF === 'Jubilación' && !v.clase.startsWith('Jubilación')) return false;
      if (tipoF !== 'Jubilación' && v.clase !== tipoF) return false;
    }
    if (search) {
      const txt = normalize(`${v.localidad} ${v.provincia} ${v.comunidad} ${v.notas}`);
      if (!txt.includes(search)) return false;
    }
    return true;
  });

  if (state.vacantesSortCol) {
    filtered.sort((a, b) => {
      let vA = a[state.vacantesSortCol] || '';
      let vB = b[state.vacantesSortCol] || '';
      const cmp = String(vA).localeCompare(String(vB), 'es');
      return state.vacantesSortDir === 'asc' ? cmp : -cmp;
    });
  }

  state.vacantesFiltered = filtered;
  document.getElementById('vacantes-count-text').textContent = filtered.length;
  renderVacantes();
}

function renderVacantes() {
  const tbody = document.getElementById('vacantes-tbody');
  const page = state.vacantesFiltered; // Show all vacantes, it's max 141

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="center">No hay vacantes encontradas.</td></tr>`;
    return;
  }

  const query = document.getElementById('search-vacantes').value;

  tbody.innerHTML = page.map(v => {
    const isJubilacion = v.clase.includes('Jubilación');
    const badgeClass = isJubilacion ? 'badge-jubilacion' : v.clase === 'Resulta' ? 'badge-resulta' : 'badge-desierta';
    
    // Extract notario if Jubilación
    let locHtml = `<strong>${highlightText(v.localidad.replace(/\s*\([^)]+\)/, '').trim(), query)}</strong>`;
    const notarioMatch = v.localidad.match(/\((Don|Doña)[^)]+\)/);
    if (notarioMatch) {
      locHtml += `<br><small style="color:#6c757d">Sustituye a: ${escapeHTML(notarioMatch[0].replace(/[()]/g, ''))}</small>`;
    }

    return `
      <tr>
        <td>${escapeHTML(v.comunidad)}</td>
        <td>${escapeHTML(v.provincia)}</td>
        <td>${locHtml}</td>
        <td><span class="badge ${badgeClass}">${escapeHTML(v.clase)}</span></td>
        <td>${escapeHTML(v.notas)}</td>
      </tr>
    `;
  }).join('');
}

// Pagination Builder
function renderPagination(containerId, totalItems, perPage, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  const totalPages = Math.ceil(totalItems / perPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Anterior</button>`;
  
  let pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  pages.forEach(p => {
    if (p === '…') {
      html += `<button class="page-btn" disabled>…</button>`;
    } else {
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
  });

  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Siguiente</button>`;
  
  container.innerHTML = html;

  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    if (btn.textContent !== '…' && !btn.classList.contains('active')) {
      btn.addEventListener('click', () => onPageChange(parseInt(btn.getAttribute('data-page'))));
    }
  });
}
