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
  vacantesOnlyFavs: false,
  userCoords: null
};

const favVacantes = new Set(JSON.parse(localStorage.getItem('favVacantes') || '[]'));

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

  // Cruzar datos para obtener la categoría (clase de la notaría)
  let nMatch = DATA_NOTARIAS.find(n => normalize(n.localidad) === normalize(locClean) && normalize(n.provincia) === normalize(v.provincia));
  
  if (!nMatch) {
    const provV = normalize(v.provincia);
    const locV = normalize(locClean).replace(/'/g, '').replace(/’/g, '').replace(/, el$/, '').replace(/, la$/, '').replace(/^el /, '').replace(/^la /, '').replace(/, l$/, '').replace(/^l /, '');
    
    // Diccionario para casos excepcionales (cambios de idioma oficial vs listado)
    const aliases = {
      'sant mateu': 'san mateo',
      'font de la figuera': 'fuente la higuera',
      'caniza, a.': 'a caniza',
      'areatza': 'villaro',
      'bergara': 'vergara',
      'sant joan de vilatorrada': 'sant joan de vilatorrada' // El error es de la provincia en vacantes (dice Lleida, es Barcelona)
    };
    
    const aliasLoc = aliases[locV] || locV;

    nMatch = DATA_NOTARIAS.find(n => {
      const provN = normalize(n.provincia);
      const locN = normalize(n.localidad).replace(/'/g, '').replace(/’/g, '').replace(/, el$/, '').replace(/, la$/, '').replace(/^el /, '').replace(/^la /, '').replace(/, l$/, '').replace(/^l /, '');
      
      const provMatch = provV.includes(provN) || provN.includes(provV) || 
                        (provV === 'almeria' && locV === 'ugijar' && provN === 'granada') ||
                        (provV === 'lleida' && locV === 'sant joan de vilatorrada' && provN === 'barcelona');
      
      let locMatch = aliasLoc === locN;
      if (!locMatch) {
         if (aliasLoc.includes('-')) locMatch = aliasLoc.split('-').some(part => part === locN || locN.includes(part));
         if (aliasLoc.includes('/')) locMatch = aliasLoc.split('/').some(part => part === locN || locN.includes(part));
         if (locN.includes('/')) locMatch = locMatch || locN.split('/').some(part => part === aliasLoc || aliasLoc.includes(part));
         if (aliasLoc.includes(locN) || locN.includes(aliasLoc)) locMatch = true;
      }
      return provMatch && locMatch;
    });
  }

  v.categoria = nMatch ? nMatch.clase : '-';
});

function isVacante(notaria) {
  const key = normalize(notaria.localidad) + '|' + normalize(notaria.provincia);
  return vacantesSet.has(key);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Update header stats dynamically
  document.getElementById('stat-notarias').textContent = DATA_NOTARIAS.length.toLocaleString('es-ES');
  document.getElementById('stat-vacantes').textContent = DATA_VACANTES.length.toLocaleString('es-ES');
  
  initTabs();
  initNotarias();
  initVacantes();
  initCharts();
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

  const btnFavs = document.getElementById('filter-favoritos');
  btnFavs.addEventListener('click', () => {
    state.vacantesOnlyFavs = !state.vacantesOnlyFavs;
    btnFavs.classList.toggle('active', state.vacantesOnlyFavs);
    filterVacantes();
  });

  document.getElementById('vacantes-table').addEventListener('click', e => {
    if (e.target.classList.contains('fav-btn')) {
      const id = e.target.getAttribute('data-id');
      if (favVacantes.has(id)) {
        favVacantes.delete(id);
        e.target.classList.remove('active');
        e.target.textContent = '☆';
      } else {
        favVacantes.add(id);
        e.target.classList.add('active');
        e.target.textContent = '⭐';
      }
      localStorage.setItem('favVacantes', JSON.stringify([...favVacantes]));
      if (state.vacantesOnlyFavs) filterVacantes();
    }
  });

  // Distances
  document.getElementById('distance-btn').addEventListener('click', calculateDistances);
  document.getElementById('distance-clear').addEventListener('click', () => {
    state.userCoords = null;
    document.getElementById('distance-input').value = '';
    document.getElementById('distance-status').textContent = '';
    document.getElementById('distance-clear').style.display = 'none';
    document.getElementById('th-distancia').style.display = 'none';
    DATA_VACANTES.forEach(v => v.distancia = null);
    if (state.vacantesSortCol === 'distancia') {
      state.vacantesSortCol = null;
    }
    filterVacantes();
  });

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
    const locClean = v.localidad.replace(/\s*\([^)]*\)/g, '').trim();
    const id = normalize(locClean) + '|' + normalize(v.provincia);
    v._id = id;

    if (state.vacantesOnlyFavs && !favVacantes.has(id)) return false;
    if (comF && v.comunidad !== comF) return false;
    if (tipoF) {
      if (tipoF === 'Jubilación' && !v.clase.startsWith('Jubilación')) return false;
      if (tipoF !== 'Jubilación' && v.clase !== tipoF) return false;
    }
    if (search) {
      const txt = normalize(`${v.localidad} ${v.provincia} ${v.comunidad} ${v.categoria}`);
      if (!txt.includes(search)) return false;
    }
    return true;
  });

  if (state.vacantesSortCol) {
    filtered.sort((a, b) => {
      if (state.vacantesSortCol === 'distancia') {
        let vA = a.distancia !== null ? a.distancia : 999999;
        let vB = b.distancia !== null ? b.distancia : 999999;
        return state.vacantesSortDir === 'asc' ? vA - vB : vB - vA;
      }
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
    tbody.innerHTML = `<tr><td colspan="${state.userCoords ? 7 : 6}" class="center">No hay vacantes encontradas.</td></tr>`;
    return;
  }

  const query = document.getElementById('search-vacantes').value;

  tbody.innerHTML = page.map(v => {
    const isJubilacion = v.clase.includes('Jubilación');
    const badgeClass = isJubilacion ? 'badge-jubilacion' : v.clase === 'Resulta' ? 'badge-resulta' : 'badge-desierta';
    const badgeCat = v.categoria === 'Primera' ? 'badge-primera' : v.categoria === 'Segunda' ? 'badge-segunda' : v.categoria === 'Tercera' ? 'badge-tercera' : '';
    
    // Extract notario if Jubilación or anteriorNotario is present
    let locHtml = `<strong>${highlightText(v.localidad.replace(/\s*\([^)]+\)/, '').trim(), query)}</strong>`;
    if (v.anteriorNotario) {
      locHtml += `<br><small style="color:#6c757d">Sustituye a: ${escapeHTML(v.anteriorNotario)}</small>`;
    } else {
      const notarioMatch = v.localidad.match(/\((Don|Doña)[^)]+\)/);
      if (notarioMatch) {
        locHtml += `<br><small style="color:#6c757d">Sustituye a: ${escapeHTML(notarioMatch[0].replace(/[()]/g, ''))}</small>`;
      }
    }

    const isFav = favVacantes.has(v._id);
    const favStar = isFav ? '⭐' : '☆';
    const favClass = isFav ? 'active' : '';

    return `
      <tr>
        <td class="center"><button class="fav-btn ${favClass}" data-id="${escapeHTML(v._id)}">${favStar}</button></td>
        <td>${escapeHTML(v.comunidad)}</td>
        <td>${escapeHTML(v.provincia)}</td>
        <td>${locHtml}</td>
        <td class="center"><span class="badge ${badgeClass}">${escapeHTML(v.clase)}</span></td>
        <td class="center"><span class="badge ${badgeCat}">${escapeHTML(v.categoria)}</span></td>
        ${state.userCoords ? `<td class="center">
          <strong>${v.distancia !== null ? v.distancia.toFixed(1) + ' km' : '-'}</strong>
          ${v.duration ? `<br><small style="color:#6c757d">🚗 ${formatDuration(v.duration)}</small>` : ''}
        </td>` : ''}
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

// Distance and driving time calculation
async function calculateDistances() {
  const query = document.getElementById('distance-input').value.trim();
  const status = document.getElementById('distance-status');
  if (!query) return;

  status.textContent = 'Buscando tu ubicación...';
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Spain&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || data.length === 0) {
      status.textContent = 'No se encontró la ubicación. Prueba escribiendo la provincia o "Madrid".';
      return;
    }

    state.userCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    status.textContent = `Ubicación encontrada: ${data[0].display_name}. Calculando rutas en coche...`;
    
    if (typeof DATA_COORDS === 'undefined') {
      status.textContent = 'Error: No se ha cargado la base de datos de coordenadas.';
      return;
    }

    if (!window.NORMALIZED_COORDS) {
      window.NORMALIZED_COORDS = {};
      for (const k in DATA_COORDS) {
        const parts = k.split('|');
        const normK = normalize(parts[0]) + '|' + normalize(parts[1]);
        window.NORMALIZED_COORDS[normK] = DATA_COORDS[k];
      }
    }

    // Preparar lista de vacantes válidas y sus coordenadas
    const validVacantes = [];
    DATA_VACANTES.forEach(v => {
      const locClean = v.localidad.replace(/\s*\([^)]*\)/g, '').trim();
      const key = normalize(locClean) + '|' + normalize(v.provincia);
      const c = window.NORMALIZED_COORDS[key];
      if (c) {
        validVacantes.push({ v: v, c: c });
      } else {
        v.distancia = null;
        v.duration = null;
      }
    });

    // OSRM permite 100 coordenadas maximo (1 origen + 99 destinos). Dividimos en lotes.
    const batchSize = 90;
    for (let i = 0; i < validVacantes.length; i += batchSize) {
      const batch = validVacantes.slice(i, i + batchSize);
      
      let coordStr = `${state.userCoords.lon},${state.userCoords.lat}`;
      batch.forEach(item => {
        coordStr += `;${item.c.lon},${item.c.lat}`;
      });
      
      const osrmUrl = `https://router.project-osrm.org/table/v1/driving/${coordStr}?sources=0&annotations=duration,distance`;
      
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();
      
      if (osrmData.code === 'Ok') {
        const distances = osrmData.distances[0]; // array of distances from source 0
        const durations = osrmData.durations[0]; // array of durations from source 0
        
        batch.forEach((item, index) => {
          // index + 1 porque el indice 0 es el propio origen
          item.v.distancia = distances[index + 1] / 1000; // km
          item.v.duration = durations[index + 1]; // seconds
        });
      } else {
        // Fallback a haversine si falla el enrutamiento para este lote
        batch.forEach(item => {
          item.v.distancia = haversine(state.userCoords.lat, state.userCoords.lon, item.c.lat, item.c.lon);
          item.v.duration = null;
        });
      }
      
      // Pequeña pausa para no saturar la API publica de OSRM
      await new Promise(r => setTimeout(r, 300));
    }

    status.textContent = `Rutas calculadas desde ${data[0].display_name.split(',')[0]}`;
    document.getElementById('distance-clear').style.display = 'inline-block';
    document.getElementById('th-distancia').style.display = 'table-cell';

    // Auto sort by distance
    state.vacantesSortCol = 'distancia';
    state.vacantesSortDir = 'asc';
    document.querySelectorAll('#vacantes-table th').forEach(t => t.className = t.className.replace(/sorted-(asc|desc)/, '').trim());
    document.getElementById('th-distancia').classList.add('sorted-asc');
    
    filterVacantes();
  } catch (err) {
    status.textContent = 'Error al conectar con los servidores de mapas/rutas.';
  }
}

function formatDuration(secs) {
  if (secs == null || isNaN(secs)) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Charts
function initCharts() {
  if (typeof Chart === 'undefined') return;

  const getColors = (count) => {
    const pal = ['#0056b3', '#dc3545', '#198754', '#ffc107', '#6f42c1', '#17a2b8', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'];
    return Array.from({length: count}, (_, i) => pal[i % pal.length]);
  };

  // Motivo
  const motivosCount = DATA_VACANTES.reduce((acc, v) => {
    const m = v.clase.includes('Jubilación') ? 'Jubilación' : v.clase;
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});
  
  new Chart(document.getElementById('chart-motivo'), {
    type: 'pie',
    data: {
      labels: Object.keys(motivosCount),
      datasets: [{
        data: Object.values(motivosCount),
        backgroundColor: ['#198754', '#dc3545', '#6f42c1']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Comunidades (Top 10)
  const comCount = DATA_VACANTES.reduce((acc, v) => {
    acc[v.comunidad] = (acc[v.comunidad] || 0) + 1;
    return acc;
  }, {});
  const sortedCom = Object.entries(comCount).sort((a,b) => b[1]-a[1]).slice(0, 10);

  new Chart(document.getElementById('chart-comunidades'), {
    type: 'bar',
    data: {
      labels: sortedCom.map(x => x[0]),
      datasets: [{
        label: 'Plazas',
        data: sortedCom.map(x => x[1]),
        backgroundColor: '#0056b3'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  // Categorías
  const catCount = DATA_VACANTES.reduce((acc, v) => {
    acc[v.categoria] = (acc[v.categoria] || 0) + 1;
    return acc;
  }, {});

  new Chart(document.getElementById('chart-categoria'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(catCount),
      datasets: [{
        data: Object.values(catCount),
        backgroundColor: ['#ffc107', '#0dcaf0', '#adb5bd']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
