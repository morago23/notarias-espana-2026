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

const favOrder = JSON.parse(localStorage.getItem('favVacantes') || '[]');
const favVacantes = new Set(favOrder);

// Utilities
function normalize(str) {
  if (!str) return '';
  return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Preferencias
function initPreferencias() {
  document.getElementById('export-prefs-btn').addEventListener('click', () => {
    window.print();
  });
  
  document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

  // Distances for Prefs tab
  document.getElementById('distance-btn-pref').addEventListener('click', () => {
    document.getElementById('distance-input').value = document.getElementById('distance-input-pref').value;
    haversines();
  });
  
  document.getElementById('distance-clear-pref').addEventListener('click', () => {
    document.getElementById('distance-clear').click();
  });
  
  renderPreferencias();
}

function renderPreferencias() {
  const listEl = document.getElementById('preferencias-list');
  if (!listEl) return;
  
  if (favOrder.length === 0) {
    listEl.innerHTML = '<tr><td colspan="9" class="empty-state">No tienes ninguna plaza guardada en favoritos. Ve a "Plazas Vacantes" y marca la estrella en las notarías que te interesen.</td></tr>';
    return;
  }
  
  let html = '';
  favOrder.forEach((id, index) => {
    // Buscar la vacante
    const v = DATA_VACANTES.find(vac => {
       const locClean = vac.localidad.replace(/\s*\([^)]*\)/g, '').trim();
       const vacId = normalize(locClean) + '|' + normalize(vac.provincia);
       return vacId === id;
    });
    
    if (v) {
      const badgeClass = v.clase.startsWith('Jubilación') ? 'badge-jubilacion' : v.clase === 'Resulta' ? 'badge-resulta' : 'badge-desierta';
      const badgeCat = v.categoria === 'Primera' ? 'badge-primera' : v.categoria === 'Segunda' ? 'badge-segunda' : v.categoria === 'Tercera' ? 'badge-tercera' : '';
      
      let notarioAnt = v.anteriorNotario || "";
      if (!notarioAnt) {
        const notarioMatch = v.localidad.match(/\((Don|Doña)[^)]+\)/);
        if (notarioMatch) notarioAnt = notarioMatch[0].replace(/[()]/g, '');
      }
      if (!notarioAnt) notarioAnt = "-";

       const noteText = typeof getNoteForId === 'function' ? getNoteForId(id) : '';
       const noteIndicator = noteText ? `<span title="${escapeHTML(noteText)}" style="cursor:help; font-size:11px; color:var(--color-primary);"> 📝</span>` : '';
       const numNot = v.numNotarias;

       html += `
        <tr data-id="${id}" class="pref-item">
          <td class="center pref-handle" style="font-weight:bold; color:var(--color-primary); font-size:1.1rem; cursor:grab;">
            ☰ ${index + 1}
          </td>
          <td class="col-comunidad" data-label="Comunidad">${escapeHTML(v.comunidad)}</td>
          <td class="col-provincia" data-label="Provincia">${escapeHTML(v.provincia)}</td>
          <td data-label="Localidad">
            <div class="loc-wrapper" style="display: flex; flex-direction: column; align-items: flex-start;">
              <div class="loc-main">${escapeHTML(v.localidad.replace(/\s*\([^)]+\)/, '').trim())}${noteIndicator}
                <button onclick="openTownModal('${escapeHTML(v.localidad.replace(/'/g, "\\'"))}', '${escapeHTML(v.provincia.replace(/'/g, "\\'"))}')" class="btn" style="padding: 2px 6px; font-size: 11px; margin-left: 6px; background-color: var(--color-surface); color: var(--color-primary); border: 1px solid var(--color-primary);" title="Ver ficha del pueblo">ℹ️</button>
              </div>
              ${noteText ? `<div style="font-size:11px; color:var(--color-primary); margin-top:2px; font-style:italic;">📝 ${escapeHTML(noteText.length > 50 ? noteText.substring(0, 50) + '...' : noteText)}</div>` : ''}
            </div>
          </td>
          <td data-label="Datos / Geo" style="white-space:nowrap;">
            <div class="geo-wrapper" style="display: flex; flex-direction: column; align-items: flex-end;">
              ${v.poblacion ? `<div style="font-size:13px;" title="Población total">👥 ${formatPoblacion(v.poblacion)}</div>` : '<div style="font-size:13px; color:#999;">-</div>'}
              ${typeof DATA_RENTA !== 'undefined' && DATA_RENTA[v.unnormId] ? `<div style="font-size:13px; margin-top:2px; color:#1b5e20;" title="Renta Media Neta por Persona">💰 ${DATA_RENTA[v.unnormId].toLocaleString('es-ES')} €</div>` : ''}
              <div style="font-size:12px; color:var(--color-text-muted);" title="Notarios en la localidad">🏛️ ${v.numNotarias} notario${v.numNotarias !== 1 ? 's' : ''}</div>
              ${v.poblacion ? `<div style="font-size:11px; color:var(--color-primary); margin-top:2px;" title="Ratio habitantes por notario">📊 ${formatPoblacion(v.ratioPobNot).replace(' hab.', '')}/not.</div>` : ''}
              ${v.distCosta !== null ? `<div style="font-size:11px; color:#0277bd; margin-top:2px;" title="Distancia a la playa">🏖️ ${v.distCosta} km</div>` : ''}
              ${v.distAero !== null ? `<div style="font-size:11px; color:#546e7a; margin-top:2px;" title="Distancia al aeropuerto">✈️ ${v.distAero} km</div>` : ''}
            </div>
          </td>
          <td data-label="Notario anterior"><small style="color:var(--color-text-muted)">${notarioAnt}</small></td>
          <td data-label="Motivo" class="center"><span class="badge ${badgeClass}">${escapeHTML(v.clase)}</span></td>
          <td data-label="Categoría" class="center"><span class="badge ${badgeCat}">${escapeHTML(v.categoria)}</span></td>
          ${state.userCoords ? `<td data-label="Tiempo y Distancia" class="center">
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
              <strong>${v.distancia !== null ? v.distancia.toFixed(1) + ' km' : '-'}</strong>
              ${v.duration ? `<small style="color:#6c757d; margin-top:2px;">🚗 ${formatDuration(v.duration)}</small>` : ''}
            </div>
          </td>` : '<td data-label="Tiempo y Distancia" class="center" style="display:none;"></td>'}
          <td data-label="Borrar" class="center">
            <button onclick="openNoteModal('${escapeHTML(id)}', '${escapeHTML(v.localidad.replace(/'/g, "\\'"))}')" style="background:none; border:none; cursor:pointer; font-size:14px; padding:2px;" title="Notas personales">${noteText ? '📝' : '🗒️'}</button>
            <button class="pref-remove" data-id="${id}">❌</button>
          </td>
        </tr>
      `;
    }
  });
  
  listEl.innerHTML = html;
  
  // Asignar evento borrar
  listEl.querySelectorAll('.pref-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      favVacantes.delete(id);
      const index = favOrder.indexOf(id);
      if (index > -1) favOrder.splice(index, 1);
      localStorage.setItem('favVacantes', JSON.stringify(favOrder));
      if (state.vacantesOnlyFavs) filterVacantes();
      renderPreferencias(); // Volver a pintar la lista
    });
  });
  
  // Sortable.js initialization
  if (window.Sortable) {
    if (state.sortableInstance) state.sortableInstance.destroy();
    
    state.sortableInstance = new Sortable(listEl, {
      handle: '.pref-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: function (evt) {
        // Reordenar array basado en DOM
        const items = Array.from(listEl.querySelectorAll('.pref-item'));
        const newOrder = items.map(el => el.getAttribute('data-id'));
        
        // Actualizar array y localStorage
        favOrder.length = 0;
        favOrder.push(...newOrder);
        localStorage.setItem('favVacantes', JSON.stringify(favOrder));
        
        // Refrescar para actualizar los números
        renderPreferencias();
      }
    });
  }
}

// Distance and driving time calculation
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
  v.numNotarias = nMatch ? parseInt(nMatch.numero) || 1 : 1;
  const pob = typeof getPoblacion === 'function' ? getPoblacion(v.localidad, v.provincia) : null;
  v.poblacion = pob;
  v.ratioPobNot = pob ? Math.round(pob / v.numNotarias) : 0;

  const unnormId = v.localidad.replace(/\s*\([^)]*\)/g, '').trim() + '|' + v.provincia;
  v.unnormId = unnormId;
  const coords = typeof DATA_COORDS !== 'undefined' ? DATA_COORDS[unnormId] : null;
  if (coords) {
    const lat = coords.lat;
    const lon = coords.lon;
    let minAero = Infinity;
    if (typeof AEROPUERTOS !== 'undefined') {
      AEROPUERTOS.forEach(a => {
        const d = haversine(lat, lon, a.lat, a.lon);
        if (d < minAero) minAero = d;
      });
    }
    let minCosta = Infinity;
    if (typeof PUNTOS_COSTA !== 'undefined') {
      PUNTOS_COSTA.forEach(c => {
        const d = haversine(lat, lon, c.lat, c.lon);
        if (d < minCosta) minCosta = d;
      });
    }
    v.distAero = minAero !== Infinity ? Math.round(minAero) : null;
    v.distCosta = minCosta !== Infinity ? Math.round(minCosta) : null;
  } else {
    v.distAero = null;
    v.distCosta = null;
  }

});

function isVacante(notaria) {
  const key = normalize(notaria.localidad) + '|' + normalize(notaria.provincia);
  return vacantesSet.has(key);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Update header stats dynamically
  const totalNotarias = DATA_NOTARIAS.reduce((sum, n) => sum + (parseInt(n.numero) || 0), 0);
  document.getElementById('stat-notarias').textContent = totalNotarias.toLocaleString('es-ES');
  document.getElementById('stat-vacantes').textContent = DATA_VACANTES.length.toLocaleString('es-ES');
  
  
  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.querySelector('.icon').textContent = '☀️';
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
      themeToggle.querySelector('.icon').textContent = '☀️';
    } else {
      localStorage.setItem('theme', 'light');
      themeToggle.querySelector('.icon').textContent = '🌙';
    }
  });

  initTabs();
  initNotarias();
  initVacantes();
  initPreferencias();
  initCharts();

  // Auto-load distance
  const savedDist = localStorage.getItem('userDistData');
  if (savedDist) {
    try {
      const parsed = JSON.parse(savedDist);
      if (parsed.coords && parsed.input) {
        document.getElementById('distance-input').value = parsed.input;
        document.getElementById('distance-input-pref').value = parsed.input;
        state.userCoords = parsed.coords;
        haversines(true); // pass true to skip geocode
      }
    } catch(e) {}
  }

});

// Tabs
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
      
      if (targetId === 'tab-mapa') {
        initMap();
      }
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
        <td class="col-comunidad" data-label="Comunidad">${escapeHTML(cName)}</td>
        <td class="col-provincia" data-label="Provincia">${escapeHTML(n.provincia)}</td>
        <td data-label="Distrito">${escapeHTML(n.distrito)}</td>
        <td data-label="Localidad">
          <div class="loc-main">${highlightText(n.localidad, query)}</div>
        </td>
        <td class="center" data-label="Número">${escapeHTML(n.numero)}</td>
        <td class="center" data-label="Clase"><span class="badge ${claseBadge}">${escapeHTML(n.clase)}</span></td>
        <td class="center" data-label="Vacante">${isV ? '<span class="vacante-si" title="Plaza vacante">✓</span>' : ''}</td>
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

  // Advanced filters toggle
  document.getElementById('toggle-advanced-filters').addEventListener('click', (e) => {
    const advFilters = document.getElementById('advanced-filters');
    if (advFilters.style.display === 'none') {
      advFilters.style.display = 'flex';
      e.target.style.backgroundColor = 'var(--color-surface-alt)';
    } else {
      advFilters.style.display = 'none';
      e.target.style.backgroundColor = 'var(--color-surface)';
    }
  });
  
  // Match panel toggle and logic
  const matchPanel = document.getElementById('match-panel');
  if (document.getElementById('toggle-match-panel')) {
    document.getElementById('toggle-match-panel').addEventListener('click', () => {
      matchPanel.style.display = matchPanel.style.display === 'none' ? 'block' : 'none';
      if(matchPanel.style.display === 'block') {
        const morrinaInput = document.getElementById('match-morrina');
        if (!state.userCoords) {
          morrinaInput.disabled = true;
          morrinaInput.title = "Introduce tu Código Postal en Preferencias para habilitar";
        } else {
          morrinaInput.disabled = false;
          morrinaInput.title = "";
        }
      }
    });
  }

  ['ambicion', 'costa', 'urba', 'morrina'].forEach(id => {
    const el = document.getElementById('match-' + id);
    if (el) {
      const valEl = document.getElementById('match-val-' + id);
      el.addEventListener('input', e => {
        valEl.textContent = e.target.value + '%';
      });
    }
  });

  if (document.getElementById('btn-calc-match')) {
    document.getElementById('btn-calc-match').addEventListener('click', calculateMatchScores);
  }

  
  // Advanced filters listeners
  document.getElementById('filter-vacante-categoria').addEventListener('change', filterVacantes);
  document.getElementById('filter-vacante-tiempo').addEventListener('change', filterVacantes);
  document.getElementById('filter-vacante-distancia').addEventListener('change', filterVacantes);
  document.getElementById('filter-vacante-aeropuerto').addEventListener('change', filterVacantes);
  document.getElementById('filter-vacante-costa').addEventListener('change', filterVacantes);

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
        const index = favOrder.indexOf(id);
        if (index > -1) favOrder.splice(index, 1);
        e.target.classList.remove('active');
        e.target.textContent = '☆';
      } else {
        favVacantes.add(id);
        favOrder.push(id);
        e.target.classList.add('active');
        e.target.textContent = '⭐';
      }
      localStorage.setItem('favVacantes', JSON.stringify(favOrder));
      if (state.vacantesOnlyFavs) filterVacantes();
      renderPreferencias();
    }
  });

  // Distances
  document.getElementById('distance-btn').addEventListener('click', haversines);
  document.getElementById('distance-clear').addEventListener('click', () => {
    state.userCoords = null;
    localStorage.removeItem('userDistData');
    document.getElementById('distance-input').value = '';
    document.getElementById('distance-status').textContent = '';
    document.getElementById('distance-clear').style.display = 'none';
    // removed th-distancia none;
    document.getElementById('filter-vacante-tiempo').disabled = true;
    document.getElementById('filter-vacante-distancia').disabled = true;
    document.getElementById('filter-vacante-tiempo').title = 'Introduce tu Código Postal en Mis Preferencias para usar este filtro';
    document.getElementById('filter-vacante-distancia').title = 'Introduce tu Código Postal en Mis Preferencias para usar este filtro';
    document.getElementById('filter-vacante-tiempo').value = '';
    document.getElementById('filter-vacante-distancia').value = '';
    
    // Also clear prefs
    document.getElementById('distance-input-pref').value = '';
    document.getElementById('distance-status-pref').textContent = '';
    document.getElementById('distance-clear-pref').style.display = 'none';
    if(document.getElementById('th-distancia-pref')) document.getElementById('th-distancia-pref').style.display = 'none';

    DATA_VACANTES.forEach(v => {
      v.distancia = null;
      v.duration = null;
    });
    
    if (state.vacantesSortCol === 'distancia') {
      state.vacantesSortCol = null;
    }
    filterVacantes();
    renderPreferencias(); // re-render to hide distance col
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
  const catF = document.getElementById('filter-vacante-categoria').value;
  const timeF = document.getElementById('filter-vacante-tiempo').value;
  const distF = document.getElementById('filter-vacante-distancia').value;
  const aeroF = document.getElementById('filter-vacante-aeropuerto').value;
  const costaF = document.getElementById('filter-vacante-costa').value;

  let filtered = DATA_VACANTES.filter(v => {
    const locClean = v.localidad.replace(/\s*\([^)]*\)/g, '').trim();
    const id = normalize(locClean) + '|' + normalize(v.provincia);
    v._id = id;

    if (state.vacantesOnlyFavs && !favVacantes.has(id)) return false;
    if (comF && v.comunidad !== comF) return false;
    if (catF && v.categoria !== catF) return false;
    if (tipoF) {
      if (tipoF === 'Jubilación' && !v.clase.startsWith('Jubilación')) return false;
      if (tipoF !== 'Jubilación' && v.clase !== tipoF) return false;
    }
    
    if (timeF) {
      if (v.duration === null || v.duration === undefined || v.duration > parseInt(timeF)) return false;
    }
    
    if (distF) {
      if (v.distancia === null || v.distancia === undefined || v.distancia > parseInt(distF)) return false;
    }
    if (aeroF) {
      if (v.distAero === null || v.distAero > parseInt(aeroF)) return false;
    }
    if (costaF) {
      if (v.distCosta === null || v.distCosta > parseInt(costaF)) return false;
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
        let vA = a.duration !== null && a.duration !== undefined ? a.duration : 99999999;
        let vB = b.duration !== null && b.duration !== undefined ? b.duration : 99999999;
        return state.vacantesSortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (state.vacantesSortCol === 'ratio') {
        let vA = a.ratioPobNot || 0;
        let vB = b.ratioPobNot || 0;
        return state.vacantesSortDir === 'asc' ? vA - vB : vB - vA;
      }
      if (state.vacantesSortCol === 'match') {
        let vA = a.matchScore || 0;
        let vB = b.matchScore || 0;
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
  if (typeof mapInstance !== 'undefined' && mapInstance) {
    renderMapMarkers();
  }
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
    const badgeCat = v.categoria === 'Primera' ? 'badge-primera' : v.categoria === 'Segunda' ? 'badge-segunda' : 'badge-tercera';
    
    let notarioAnt = v.anteriorNotario || "";
    if (!notarioAnt) {
      const notarioMatch = v.localidad.match(/\((Don|Doña)[^)]+\)/);
      if (notarioMatch) notarioAnt = notarioMatch[0].replace(/[()]/g, '');
    }
    if (!notarioAnt) notarioAnt = "-";

    const isFav = favVacantes.has(v._id);
    const favStar = isFav ? '⭐' : '☆';
    const favClass = isFav ? 'active' : '';

    const noteText = getNoteForId(v._id);
    const noteIndicator = noteText ? `<span title="${escapeHTML(noteText)}" style="cursor:help; font-size:11px; color:var(--color-primary);"> 📝</span>` : '';

    let matchDisplay = '';
    if (state.matchCalculated) {
      let matchColor = '#9ca3af'; // Gray
      let matchIcon = '';
      if (v.matchScore >= 90) { matchColor = '#10b981'; matchIcon = '🔥'; } // Green
      else if (v.matchScore >= 75) { matchColor = '#3b82f6'; } // Blue
      else if (v.matchScore >= 50) { matchColor = '#f59e0b'; } // Orange
      
      matchDisplay = `<td class="center" data-label="Match" style="color: ${matchColor}; font-weight: bold; font-size: 16px;">${v.matchScore}% ${matchIcon}</td>`;
    }

    return `
      <tr>
        <td class="center" data-label="Favorito">
          <div>
            <button class="fav-btn ${favClass}" data-id="${escapeHTML(v._id)}">${favStar}</button>
            <button onclick="openNoteModal('${escapeHTML(v._id)}', '${escapeHTML(v.localidad.replace(/'/g, "\\'"))}')" style="background:none; border:none; cursor:pointer; font-size:14px; padding:2px;" title="Notas personales">${noteText ? '📝' : '🗒️'}</button>
          </div>
        </td>
        ${matchDisplay}
        <td class="col-comunidad" data-label="Comunidad">${escapeHTML(v.comunidad)}</td>
        <td class="col-provincia" data-label="Provincia">${escapeHTML(v.provincia)}</td>
        <td data-label="Localidad">
          <div class="loc-wrapper" style="display: flex; flex-direction: column; align-items: flex-start;">
            <div class="loc-main">${highlightText(v.localidad.replace(/\s*\([^)]+\)/, '').trim(), query)}${noteIndicator}
              <button onclick="openTownModal('${escapeHTML(v.localidad.replace(/'/g, "\\'"))}', '${escapeHTML(v.provincia.replace(/'/g, "\\'"))}')" class="btn" style="padding: 2px 6px; font-size: 11px; margin-left: 6px; background-color: var(--color-surface); color: var(--color-primary); border: 1px solid var(--color-primary);" title="Ver ficha del pueblo">ℹ️</button>
            </div>
          </div>
        </td>
        <td data-label="Datos / Geo" style="white-space:nowrap;">
          <div class="geo-wrapper" style="display: flex; flex-direction: column; align-items: flex-end;">
            ${v.poblacion ? `<div style="font-size:13px;" title="Población total">👥 ${formatPoblacion(v.poblacion)}</div>` : '<div style="font-size:13px; color:#999;">-</div>'}
            ${typeof DATA_RENTA !== 'undefined' && DATA_RENTA[v.unnormId] ? `<div style="font-size:13px; margin-top:2px; color:#1b5e20;" title="Renta Media Neta por Persona">💰 ${DATA_RENTA[v.unnormId].toLocaleString('es-ES')} €</div>` : ''}
            <div style="font-size:12px; color:var(--color-text-muted);" title="Notarios en la localidad">🏛️ ${v.numNotarias} notario${v.numNotarias !== 1 ? 's' : ''}</div>
            ${v.poblacion ? `<div style="font-size:11px; color:var(--color-primary); margin-top:2px;" title="Ratio habitantes por notario">📊 ${formatPoblacion(v.ratioPobNot).replace(' hab.', '')}/not.</div>` : ''}
            ${v.distCosta !== null ? `<div style="font-size:11px; color:#0277bd; margin-top:2px;" title="Distancia a la playa">🏖️ ${v.distCosta} km</div>` : ''}
            ${v.distAero !== null ? `<div style="font-size:11px; color:#546e7a; margin-top:2px;" title="Distancia al aeropuerto">✈️ ${v.distAero} km</div>` : ''}
          </div>
        </td>
        <td data-label="Notario anterior"><small style="color:var(--color-text-muted)">${notarioAnt}</small></td>
        <td class="center" data-label="Motivo"><span class="badge ${badgeClass}">${escapeHTML(v.clase)}</span></td>
        <td class="center" data-label="Categoría"><span class="badge ${badgeCat}">${escapeHTML(v.categoria)}</span></td>
        ${state.userCoords ? `<td class="center" data-label="Tiempo y Distancia">
          <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <strong>${v.distancia !== null ? v.distancia.toFixed(1) + ' km' : '-'}</strong>
            ${v.duration ? `<small style="color:#6c757d; margin-top:2px;">🚗 ${formatDuration(v.duration)}</small>` : ''}
          </div>
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
async function haversines(skipGeocode = false) {
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
    // removed th-distancia display;

    // Also update prefs distance UI
    document.getElementById('distance-status-pref').textContent = status.textContent;
    document.getElementById('distance-clear-pref').style.display = 'inline-block';
    if(document.getElementById('th-distancia-pref')) document.getElementById('th-distancia-pref').style.display = 'table-cell';

    // Auto sort by distance
    
    // Save to localStorage
    if (state.userCoords) {
      localStorage.setItem('userDistData', JSON.stringify({
        input: document.getElementById('distance-input').value,
        coords: state.userCoords
      }));
    }

    document.getElementById('filter-vacante-tiempo').disabled = false;
    document.getElementById('filter-vacante-distancia').disabled = false;
    document.getElementById('filter-vacante-tiempo').title = '';
    document.getElementById('filter-vacante-distancia').title = '';
    state.vacantesSortCol = 'distancia';
    state.vacantesSortDir = 'asc';
    document.querySelectorAll('#vacantes-table th').forEach(t => t.className = t.className.replace(/sorted-(asc|desc)/, '').trim());
    document.getElementById('th-distancia').classList.add('sorted-asc');
    
    filterVacantes();
    renderPreferencias();
  } catch (err) {
    status.textContent = 'Error al conectar con los servidores de mapas/rutas.';
  }
}

function exportToCSV() {
  if (favOrder.length === 0) {
    alert("No tienes plazas en favoritos para exportar.");
    return;
  }
  
  let csvContent = "\uFEFF"; // BOM for Excel compatibility
  csvContent += "Orden;Comunidad;Provincia;Localidad / Plaza;Motivo;Categoría;Notario Anterior;Distancia (km);Tiempo (min)\n";
  
  favOrder.forEach((id, index) => {
    const v = DATA_VACANTES.find(vac => {
       const locClean = vac.localidad.replace(/\s*\([^)]*\)/g, '').trim();
       const vacId = normalize(locClean) + '|' + normalize(vac.provincia);
       return vacId === id;
    });
    if (v) {
      let notarioAnt = v.anteriorNotario || "";
      if (!notarioAnt) {
        const notarioMatch = v.localidad.match(/\((Don|Doña)[^)]+\)/);
        if (notarioMatch) notarioAnt = notarioMatch[0].replace(/[()]/g, '');
      }
      
      const loc = v.localidad.replace(/\s*\([^)]+\)/, '').trim();
      const dist = v.distancia !== null && v.distancia !== undefined ? v.distancia.toFixed(1).replace('.', ',') : "";
      const mins = v.duration !== null && v.duration !== undefined ? Math.round(v.duration / 60) : "";
      
      const row = [
        index + 1,
        `"${v.comunidad}"`,
        `"${v.provincia}"`,
        `"${loc}"`,
        `"${v.clase}"`,
        `"${v.categoria}"`,
        `"${notarioAnt}"`,
        `"${dist}"`,
        `"${mins}"`
      ];
      csvContent += row.join(";") + "\n";
    }
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "mis_preferencias_notarias.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

// ================= MAPA =================
let mapInstance = null;
let markersLayer = null;

function initMap() {
  if (!mapInstance) {
    mapInstance = L.map('map').setView([40.4168, -3.7038], 6); // Centro de España
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstance);
    
    markersLayer = L.layerGroup().addTo(mapInstance);
  } else {
    // Redimensionar al cambiar de pestaña
    setTimeout(() => mapInstance.invalidateSize(), 100);
  }
  
  renderMapMarkers();
}

function renderMapMarkers() {
  if (!mapInstance || !markersLayer) return;
  
  markersLayer.clearLayers();
  
  // Agrupar vacantes por Localidad|Provincia
  const grouped = {};
  let totalShown = 0;
  let totalMissing = 0;
  
  state.vacantesFiltered.forEach(v => {
    // Coordenadas key: "Localidad limpia|Provincia"
    const locClean = v.localidad.replace(/\s*\([^)]*\)/g, '').trim();
    const key = `${locClean}|${v.provincia}`;
    
    // Fallback: Si no existe, probamos solo con la localidad en DATA_COORDS
    let coords = DATA_COORDS[key];
    if (!coords) {
      // Intentar buscar alguna key que empiece por Loc|
      const altKey = Object.keys(DATA_COORDS).find(k => k.startsWith(locClean + '|'));
      if (altKey) coords = DATA_COORDS[altKey];
    }
    
    if (coords) {
      if (!grouped[key]) {
        grouped[key] = { coords, plazas: [] };
      }
      grouped[key].plazas.push(v);
      totalShown++;
    } else {
      totalMissing++;
    }
  });
  
  // Actualizar contadores
  document.getElementById('map-showing-count').textContent = totalShown;
  document.getElementById('map-missing-count').textContent = totalMissing;
  document.getElementById('map-warning').style.display = totalMissing > 0 ? 'block' : 'none';
  
  // Pintar marcadores
  Object.keys(grouped).forEach(key => {
    const group = grouped[key];
    const plazas = group.plazas;
    const isMultiple = plazas.length > 1;
    
    // Determinar color dominante
    const hasJubilacion = plazas.some(p => p.clase.includes('Jubilación'));
    const hasResulta = plazas.some(p => p.clase === 'Resulta');
    const hasDesierta = plazas.some(p => p.clase === 'Desierta');
    
    let colorClass = 'marker-mixed';
    if (hasJubilacion && !hasResulta && !hasDesierta) colorClass = 'marker-jubilacion';
    else if (!hasJubilacion && hasResulta && !hasDesierta) colorClass = 'marker-resulta';
    else if (!hasJubilacion && !hasResulta && hasDesierta) colorClass = 'marker-desierta';
    
    const iconHtml = `<div class="custom-marker ${colorClass}" style="width: 30px; height: 30px;">${isMultiple ? plazas.length : ''}</div>`;
    
    const customIcon = L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });
    
    const marker = L.marker([group.coords.lat, group.coords.lon], { icon: customIcon });
    
    // Construir contenido del popup
    const cleanLoc = plazas[0].localidad.replace(/\s*\([^)]*\)/g, '').trim();
    const header = `<div class="map-popup-header" style="display:flex; justify-content:space-between; align-items:center;">
      <div>${escapeHTML(cleanLoc)} <span style="font-size:12px; font-weight:normal; color:var(--color-text-muted)">(${plazas.length})</span></div>
      <button onclick="openTownModal('${escapeHTML(cleanLoc.replace(/'/g, "\'"))}', '${escapeHTML(plazas[0].provincia.replace(/'/g, "\'"))}')" class="btn" style="padding: 2px 6px; font-size: 11px; background-color: var(--color-surface); color: var(--color-primary); border: 1px solid var(--color-primary);">ℹ️ Info</button>
    </div>`;
    
    const listHtml = plazas.map(v => {
      const badgeClass = v.clase.includes('Jubilación') ? 'badge-jubilacion' : v.clase === 'Resulta' ? 'badge-resulta' : 'badge-desierta';
      const isFav = favVacantes.has(v._id);
      const favStar = isFav ? '⭐' : '☆';
      const favClass = isFav ? 'active' : '';
      
      let notarioAnt = v.anteriorNotario || "";
      if (!notarioAnt) {
        const notarioMatch = v.localidad.match(/\((Don|Doña)[^)]+\)/);
        if (notarioMatch) notarioAnt = notarioMatch[0].replace(/[()]/g, '');
      }
      if (!notarioAnt) notarioAnt = "-";
      
      return `
        <div class="map-popup-item">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span class="badge ${badgeClass}">${escapeHTML(v.clase)}</span>
            <strong>${v.categoria}</strong>
          </div>
          <div style="font-size:13px; margin-bottom:4px; color:var(--color-text-muted);">
            Notario ant: ${escapeHTML(notarioAnt)}
          </div>
          <div class="map-popup-actions">
            <div>
              ${state.userCoords && v.distancia !== null ? `<span style="font-size:12px;">🚗 ${v.distancia.toFixed(1)} km</span>` : ''}
            </div>
            <button class="fav-btn ${favClass}" data-id="${escapeHTML(v._id)}" onclick="toggleFavMap(this)">${favStar}</button>
          </div>
        </div>
      `;
    }).join('');
    
    const popupContent = `${header}<div class="map-popup-list">${listHtml}</div>`;
    marker.bindPopup(popupContent);
    marker.addTo(markersLayer);
  });
}

// Función global para que funcione el onclick dentro del popup
window.toggleFavMap = function(btn) {
  const id = btn.getAttribute('data-id');
  
  if (favVacantes.has(id)) {
    favVacantes.delete(id);
    const index = favOrder.indexOf(id);
    if (index > -1) favOrder.splice(index, 1);
    btn.textContent = '☆';
    btn.classList.remove('active');
  } else {
    favVacantes.add(id);
    favOrder.push(id);
    btn.textContent = '⭐';
    btn.classList.add('active');
  }
  
  localStorage.setItem('favVacantes', JSON.stringify(favOrder));
  if (state.vacantesOnlyFavs) filterVacantes();
  renderPreferencias();
  renderVacantes(); // Update table view if it's visible
};

// ================= TOWN MODAL (WIKIPEDIA) =================
document.getElementById('close-town-modal').addEventListener('click', () => {
  document.getElementById('town-modal').style.display = 'none';
});

// Close modal when clicking outside
document.getElementById('town-modal').addEventListener('click', (e) => {
  if (e.target.id === 'town-modal') {
    document.getElementById('town-modal').style.display = 'none';
  }
});

window.openTownModal = async function(localidad, provincia) {
  const modal = document.getElementById('town-modal');
  const title = document.getElementById('town-modal-title');
  const subtitle = document.getElementById('town-modal-subtitle');
  const titleAlt = document.getElementById('town-modal-title-alt');
  const subtitleAlt = document.getElementById('town-modal-subtitle-alt');
  const imgContainer = document.getElementById('town-modal-image-container');
  const img = document.getElementById('town-modal-image');
  const headerAlt = document.getElementById('town-modal-noimage-header');
  const loading = document.getElementById('town-modal-loading');
  const desc = document.getElementById('town-modal-description');
  const err = document.getElementById('town-modal-error');
  const mapsBtn = document.getElementById('town-modal-maps-btn');
  const mapIframe = document.getElementById('town-modal-map');
  const popBadge = document.getElementById('town-modal-pop');
  const rentaBadge = document.getElementById('town-modal-renta');
  const weatherBadge = document.getElementById('town-modal-weather');

  // Clean locality for better search (remove text in parentheses)
  const locClean = localidad.replace(/\s*\([^)]*\)/g, '').trim();
  const unnormId = locClean + '|' + provincia;

  title.textContent = locClean;
  subtitle.textContent = provincia;
  titleAlt.textContent = locClean;
  subtitleAlt.textContent = provincia;
  
  imgContainer.style.display = 'none';
  headerAlt.style.display = 'block';
  desc.style.display = 'none';
  err.style.display = 'none';
  loading.style.display = 'block';
  
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locClean + ', ' + provincia + ', España')}`;
  mapsBtn.href = gmapsUrl;

  const coord = typeof DATA_COORDS !== 'undefined' ? DATA_COORDS[unnormId] : null;
  let lat = null, lon = null;
  if (coord) {
    lat = coord.lat;
    lon = coord.lon;
    mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.03},${lat-0.03},${lon+0.03},${lat+0.03}&layer=mapnik&marker=${lat},${lon}`;
  } else {
    mapIframe.src = '';
  }

  const pob = typeof getPoblacion === 'function' ? getPoblacion(localidad, provincia) : null;
  popBadge.textContent = pob ? `👥 ${formatPoblacion(pob)}` : '👥 -- hab.';
  
  if (typeof DATA_RENTA !== 'undefined' && DATA_RENTA[unnormId]) {
    rentaBadge.textContent = `💰 ${DATA_RENTA[unnormId].toLocaleString('es-ES')} €`;
    rentaBadge.style.display = 'inline-block';
  } else {
    rentaBadge.style.display = 'none';
  }

  weatherBadge.textContent = '⛅ -- °C';

  modal.style.display = 'flex';

  if (lat !== null && lon !== null) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
      .then(res => res.json())
      .then(d => {
        if (d.current_weather) {
          const w = d.current_weather;
          let icon = '⛅';
          if (w.weathercode === 0) icon = '☀️';
          else if (w.weathercode <= 3) icon = '⛅';
          else if (w.weathercode <= 67) icon = '🌧️';
          else if (w.weathercode <= 77) icon = '❄️';
          else if (w.weathercode <= 99) icon = '⛈️';
          weatherBadge.textContent = `${icon} ${w.temperature}°C`;
        }
      }).catch(e => console.error(e));
  }

  try {
    let wikiTitle = encodeURIComponent(locClean);
    if (lat !== null && lon !== null) {
      const geoRes = await fetch(`https://es.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=1&format=json&origin=*`);
      const geoData = await geoRes.json();
      if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 0) {
        wikiTitle = encodeURIComponent(geoData.query.geosearch[0].title);
      }
    }
    
    const response = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`);
    if (!response.ok) throw new Error('Not found');

    const data = await response.json();

    loading.style.display = 'none';
    desc.innerHTML = data.extract_html || data.extract;
    desc.style.display = 'block';

    if (data.thumbnail && data.thumbnail.source) {
      img.src = data.thumbnail.source;
      imgContainer.style.display = 'block';
      headerAlt.style.display = 'none';
    }
  } catch (error) {
    loading.style.display = 'none';
    err.style.display = 'block';
  }
};

// ================= NOTAS PERSONALES =================
const userNotes = JSON.parse(localStorage.getItem('userNotes') || '{}');
let currentNoteId = null;

function getNoteForId(id) {
  return userNotes[id] || '';
}

window.openNoteModal = function(plazaId, localidad) {
  currentNoteId = plazaId;
  const locClean = localidad.replace(/\s*\([^)]*\)/g, '').trim();
  document.getElementById('note-modal-subtitle').textContent = locClean;
  document.getElementById('note-modal-textarea').value = getNoteForId(plazaId);
  document.getElementById('note-modal').style.display = 'flex';
  document.getElementById('note-modal-textarea').focus();
};

document.getElementById('close-note-modal').addEventListener('click', () => {
  document.getElementById('note-modal').style.display = 'none';
});
document.getElementById('note-modal').addEventListener('click', (e) => {
  if (e.target.id === 'note-modal') document.getElementById('note-modal').style.display = 'none';
});

document.getElementById('note-modal-save').addEventListener('click', () => {
  if (!currentNoteId) return;
  const text = document.getElementById('note-modal-textarea').value.trim();
  if (text) {
    userNotes[currentNoteId] = text;
  } else {
    delete userNotes[currentNoteId];
  }
  localStorage.setItem('userNotes', JSON.stringify(userNotes));
  document.getElementById('note-modal').style.display = 'none';
  renderVacantes();
  renderPreferencias();
});

document.getElementById('note-modal-delete').addEventListener('click', () => {
  if (!currentNoteId) return;
  delete userNotes[currentNoteId];
  localStorage.setItem('userNotes', JSON.stringify(userNotes));
  document.getElementById('note-modal').style.display = 'none';
  renderVacantes();
  renderPreferencias();
});

// ================= COMPARTIR PERFIL =================
document.getElementById('share-profile-btn').addEventListener('click', () => {
  const profileData = {
    f: favOrder, // favorites order
    n: userNotes  // notes
  };
  const json = JSON.stringify(profileData);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  const shareUrl = window.location.origin + window.location.pathname + '#profile=' + encoded;
  
  document.getElementById('share-url-output').value = shareUrl;
  document.getElementById('share-copy-status').textContent = '';
  document.getElementById('share-modal').style.display = 'flex';
});

document.getElementById('share-copy-btn').addEventListener('click', () => {
  const textarea = document.getElementById('share-url-output');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(() => {
    document.getElementById('share-copy-status').textContent = '✅ ¡Enlace copiado! Pégalo en tu otro dispositivo.';
  }).catch(() => {
    document.getElementById('share-copy-status').textContent = '⚠️ No se pudo copiar. Selecciona el texto manualmente.';
  });
});

document.getElementById('close-share-modal').addEventListener('click', () => {
  document.getElementById('share-modal').style.display = 'none';
});
document.getElementById('share-modal').addEventListener('click', (e) => {
  if (e.target.id === 'share-modal') document.getElementById('share-modal').style.display = 'none';
});

// Import profile from URL hash on page load
(function importProfileFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#profile=')) return;
  
  try {
    const encoded = hash.replace('#profile=', '');
    const json = decodeURIComponent(escape(atob(encoded)));
    const profileData = JSON.parse(json);
    
    if (profileData.f && Array.isArray(profileData.f)) {
      // Ask user before overwriting
      const count = profileData.f.length;
      const noteCount = profileData.n ? Object.keys(profileData.n).length : 0;
      if (confirm(`Se ha detectado un perfil compartido con ${count} plaza(s) favorita(s)${noteCount > 0 ? ` y ${noteCount} nota(s)` : ''}.\n\n¿Quieres importarlo? Esto reemplazará tus favoritos y notas actuales.`)) {
        // Import favorites
        favOrder.length = 0;
        favVacantes.clear();
        profileData.f.forEach(id => {
          favOrder.push(id);
          favVacantes.add(id);
        });
        localStorage.setItem('favVacantes', JSON.stringify(favOrder));
        
        // Import notes
        if (profileData.n) {
          Object.keys(userNotes).forEach(k => delete userNotes[k]);
          Object.assign(userNotes, profileData.n);
          localStorage.setItem('userNotes', JSON.stringify(userNotes));
        }
        
        // Clean URL
        history.replaceState(null, '', window.location.pathname);
        
        // Refresh UI
        if (typeof filterVacantes === 'function') filterVacantes();
        if (typeof renderPreferencias === 'function') renderPreferencias();
        
        alert('✅ Perfil importado correctamente. Tus favoritos y notas se han sincronizado.');
      }
    }
    
    // Clean URL regardless
    history.replaceState(null, '', window.location.pathname);
  } catch(e) {
    console.error('Error importing profile:', e);
  }
})();

// ================= POBLACIÓN =================
function getPoblacion(localidad, provincia) {
  if (typeof DATA_POBLACION === 'undefined') return null;
  const locClean = localidad.replace(/\s*\([^)]*\)/g, '').trim();
  const key = `${locClean}|${provincia}`;
  if (DATA_POBLACION[key]) return DATA_POBLACION[key];
  // Fallback: search by locality only
  const altKey = Object.keys(DATA_POBLACION).find(k => k.startsWith(locClean + '|'));
  return altKey ? DATA_POBLACION[altKey] : null;
}

function formatPoblacion(num) {
  if (!num) return '';
  return num.toLocaleString('es-ES') + ' hab.';
}

function calculateMatchScores() {
  const wAmbicion = parseInt(document.getElementById('match-ambicion').value) / 100;
  const wCosta = parseInt(document.getElementById('match-costa').value) / 100;
  const wUrba = parseInt(document.getElementById('match-urba').value) / 100;
  const wMorrina = parseInt(document.getElementById('match-morrina').value) / 100;

  // Find max values for normalization
  let maxRenta = 0, maxPob = 0, maxCosta = 0, maxDist = 0;
  
  DATA_VACANTES.forEach(v => {
    const renta = (typeof DATA_RENTA !== 'undefined' && DATA_RENTA[v.unnormId]) ? DATA_RENTA[v.unnormId] : 0;
    if (renta > maxRenta) maxRenta = renta;
    if (v.poblacion && v.poblacion > maxPob) maxPob = v.poblacion;
    if (v.distCosta && v.distCosta > maxCosta) maxCosta = v.distCosta;
    if (v.distancia && v.distancia > maxDist) maxDist = v.distancia;
  });

  // Calculate scores
  DATA_VACANTES.forEach(v => {
    const renta = (typeof DATA_RENTA !== 'undefined' && DATA_RENTA[v.unnormId]) ? DATA_RENTA[v.unnormId] : 0;
    
    const normRenta = maxRenta ? (renta / maxRenta) : 0;
    const normRatio = v.ratioPobNot ? Math.min(v.ratioPobNot / 10000, 1) : 0; 
    
    // Score Ambicion (High renta and High ratio)
    const sAmbicion = (normRenta + normRatio) / 2;
    
    // Score Costa (closer is better, up to maxCosta)
    const sCosta = (v.distCosta !== null && maxCosta > 0) ? (1 - (v.distCosta / maxCosta)) : 0.5;
    
    // Score Urbanita (user wants big city if 100%, small town if 0%)
    const normPob = maxPob ? Math.min(v.poblacion / 50000, 1) : 0; // Cap at 50k for normalization
    const sUrba = wUrba * normPob + (1 - wUrba) * (1 - normPob);
    
    // Score Morriña (closer is better)
    const sMorrina = (v.distancia !== null && maxDist > 0) ? (1 - (v.distancia / maxDist)) : 0;

    let totalScore = 0;
    let totalWeights = wAmbicion + wCosta + 1 + (state.userCoords ? wMorrina : 0); // Urba always counts as 1 weight
    
    totalScore += wAmbicion * sAmbicion;
    totalScore += wCosta * sCosta;
    totalScore += 1 * sUrba;
    if (state.userCoords) {
      totalScore += wMorrina * sMorrina;
    }

    const finalPercent = (totalWeights > 0) ? (totalScore / totalWeights) * 100 : 0;
    v.matchScore = Math.round(finalPercent);
  });

  state.matchCalculated = true;
  document.getElementById('th-match').style.display = 'table-cell';
  
  // Sort by match score automatically
  state.vacantesSortCol = 'match';
  state.vacantesSortDir = 'desc';
  
  filterVacantes();
  window.scrollTo({ top: document.querySelector('.table-vacantes').offsetTop - 20, behavior: 'smooth' });
}
