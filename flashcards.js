// ================= ASISTENTE FLASHCARDS =================

const FC_GROUPS = [
  { id: 1, name: 'Top', label: '1 - Top 🌟', shortLabel: 'Top', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981' },
  { id: 2, name: 'Muy buena', label: '2 - Muy buena 👍', shortLabel: 'Muy buena', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: '#3b82f6' },
  { id: 3, name: 'Buena', label: '3 - Buena 👌', shortLabel: 'Buena', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', border: '#6366f1' },
  { id: 4, name: 'Mala', label: '4 - Mala ⚠️', shortLabel: 'Mala', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: '#f59e0b' },
  { id: 5, name: 'Muy mala', label: '5 - Muy mala ❌', shortLabel: 'Muy mala', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: '#ef4444' }
];

const fcState = {
  unlocked: false,
  screen: 'welcome', // 'welcome' | 'flashcards' | 'ordering' | 'final'
  userName: '',
  postalCode: '',
  userCoords: null,
  locationName: '',
  currentIndex: 0,
  ratings: {}, // { [fcId]: 1|2|3|4|5 }
  groupOrders: {
    1: [],
    2: [],
    3: [],
    4: [],
    5: []
  },
  currentOrderGroup: 1, // 1..5
  plazas: [], // Enriched and sorted array of 210 items from DATA_GALO
  sortableInstance: null,
  galoExpanded: false,
  autoSortApplied: { 4: null, 5: null }
};

function initFlashcardsApp() {
  if (typeof DATA_GALO === 'undefined') return;

  // Enrich and sort DATA_GALO alphabetically by Comunidad -> Provincia -> Localidad / Plaza
  const items = DATA_GALO.map((raw, idx) => {
    const comunidad = (raw['Comunidad'] || '').trim();
    const provincia = (raw['Provincia'] || '').trim();
    const localidad = (raw['Localidad / Plaza'] || '').trim();
    const motivo = (raw['Motivo'] || '').trim();
    let categoria = (raw['Categoría'] || '').trim();
    const notarioAnterior = (raw['Notario Anterior'] || '').trim() || '-';
    const informeGalo = (raw['Informe Galo'] || '').trim();

    const rawProt = raw['Instrumentos públicos (escrituras, actas y protestos)'];
    const rawPolA = raw['Pólizas Sección A'];

    const protocolos2025 = rawProt !== '' && rawProt !== undefined && !isNaN(parseFloat(rawProt))
      ? Math.round(parseFloat(rawProt))
      : null;
    const polizas2025 = rawPolA !== '' && rawPolA !== undefined && !isNaN(parseFloat(rawPolA))
      ? Math.round(parseFloat(rawPolA))
      : null;

    // Cross-reference with DATA_NOTARIAS to get numNotarias and fallback categoria
    const nMatch = findNotariaMatchForGalo(localidad, provincia);
    const numNotarias = nMatch ? (parseInt(nMatch.numero) || 1) : 1;
    if (!categoria || categoria === '-') {
      categoria = nMatch ? nMatch.clase : '-';
    }

    // Coordinates
    const coords = getCoordsForGalo(localidad, provincia);

    // Unique stable ID
    const fcId = `fc_${idx}_${normalize(localidad)}_${normalize(provincia)}`;

    return {
      fcId,
      originalIndex: idx,
      comunidad,
      provincia,
      localidad,
      motivo,
      categoria,
      notarioAnterior,
      numNotarias,
      protocolos2025,
      polizas2025,
      informeGalo,
      coords,
      distancia: null,
      duration: null,
      raw
    };
  });

  // Sort alphabetically by Comunidad -> Provincia -> Localidad -> Notario Anterior
  items.sort((a, b) => {
    const cCmp = a.comunidad.localeCompare(b.comunidad, 'es', { sensitivity: 'base' });
    if (cCmp !== 0) return cCmp;
    const pCmp = a.provincia.localeCompare(b.provincia, 'es', { sensitivity: 'base' });
    if (pCmp !== 0) return pCmp;
    const lCmp = a.localidad.localeCompare(b.localidad, 'es', { sensitivity: 'base' });
    if (lCmp !== 0) return lCmp;
    return a.notarioAnterior.localeCompare(b.notarioAnterior, 'es', { sensitivity: 'base' });
  });

  fcState.plazas = items;

  // Load saved state from localStorage if available
  loadFcStateFromStorage();

  // If we already have userCoords in fcState (or global state), compute distances
  if (fcState.userCoords) {
    calculateFcDistancesFromCoords(fcState.userCoords);
  } else if (state && state.userCoords) {
    const savedDist = localStorage.getItem('userDistData');
    if (savedDist) {
      try {
        const parsed = JSON.parse(savedDist);
        if (parsed.coords && parsed.input && !fcState.postalCode) {
          fcState.postalCode = parsed.input;
          fcState.userCoords = parsed.coords;
          calculateFcDistancesFromCoords(fcState.userCoords);
        }
      } catch (e) {}
    }
  }

  // Modal close listeners for Informe Galo modal
  const closeGaloModal = document.getElementById('close-galo-modal');
  const galoModal = document.getElementById('galo-modal');
  if (closeGaloModal && galoModal) {
    closeGaloModal.addEventListener('click', () => {
      galoModal.style.display = 'none';
    });
    galoModal.addEventListener('click', (e) => {
      if (e.target.id === 'galo-modal') galoModal.style.display = 'none';
    });
  }

  // Keyboard shortcuts when on flashcards tab & flashcards screen
  document.addEventListener('keydown', (e) => {
    const tabEl = document.getElementById('tab-flashcards');
    if (!tabEl || !tabEl.classList.contains('active')) return;
    if (!fcState.unlocked) return;
    if (fcState.screen !== 'flashcards') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      rateCurrentCard(parseInt(e.key));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevFlashcard();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextFlashcard();
    }
  });

  renderFcApp();
}

function findNotariaMatchForGalo(localidad, provincia) {
  const locClean = (localidad || '').replace(/\s*\([^)]*\)/g, '').trim();
  let nMatch = DATA_NOTARIAS.find(n => normalize(n.localidad) === normalize(locClean) && normalize(n.provincia) === normalize(provincia));
  if (!nMatch) {
    const provV = normalize(provincia);
    const locV = normalize(locClean).replace(/'/g, '').replace(/’/g, '').replace(/, el$/, '').replace(/, la$/, '').replace(/^el /, '').replace(/^la /, '').replace(/, l$/, '').replace(/^l /, '');
    const aliases = {
      'sant mateu': 'san mateo',
      'font de la figuera': 'fuente la higuera',
      'caniza, a.': 'a caniza',
      'areatza': 'villaro',
      'bergara': 'vergara',
      'sant joan de vilatorrada': 'sant joan de vilatorrada'
    };
    const aliasLoc = aliases[locV] || locV;
    nMatch = DATA_NOTARIAS.find(n => {
      const provN = normalize(n.provincia);
      const locN = normalize(n.localidad).replace(/'/g, '').replace(/’/g, '').replace(/, el$/, '').replace(/, la$/, '').replace(/^el /, '').replace(/^la /, '').replace(/, l$/, '').replace(/^l /, '');
      const provMatch = provV.includes(provN) || provN.includes(provV) ||
                        (provV === 'almeria' && locV === 'ugijar' && provN === 'granada') ||
                        (provV === 'lleida' && locV === 'sant joan de vilatorrada' && provN === 'barcelona') ||
                        (provV === 'badajoz' && locV === 'nava' && provN === 'asturias') ||
                        (provV === 'soria' && locV === 'berlanga de duero');
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
  return nMatch;
}

function getCoordsForGalo(localidad, provincia) {
  if (typeof getCoords === 'function') {
    const c = getCoords(localidad, provincia);
    if (c) return c;
  }
  if (typeof DATA_COORDS === 'undefined') return null;
  const locClean = (localidad || '').replace(/\s*\([^)]*\)/g, '').trim();
  const normLoc = normalize(locClean);
  const normProv = normalize(provincia);
  for (const k in DATA_COORDS) {
    const parts = k.split('|');
    if (normalize(parts[0]) === normLoc && normalize(parts[1]) === normProv) {
      return DATA_COORDS[k];
    }
  }
  for (const k in DATA_COORDS) {
    const parts = k.split('|');
    if (normalize(parts[0]) === normLoc) {
      return DATA_COORDS[k];
    }
  }
  return null;
}

function saveFcStateToStorage() {
  try {
    const payload = {
      version: 1,
      screen: fcState.screen,
      userName: fcState.userName,
      postalCode: fcState.postalCode,
      userCoords: fcState.userCoords,
      locationName: fcState.locationName,
      currentIndex: fcState.currentIndex,
      ratings: fcState.ratings,
      groupOrders: fcState.groupOrders,
      currentOrderGroup: fcState.currentOrderGroup,
      autoSortApplied: fcState.autoSortApplied,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('fcProgressState', JSON.stringify(payload));
  } catch (e) {
    console.error('Error guardando estado de flashcards:', e);
  }
}

function loadFcStateFromStorage() {
  try {
    const raw = localStorage.getItem('fcProgressState');
    if (!raw) return;
    const data = JSON.parse(raw);
    applyImportedFcData(data, false);
  } catch (e) {
    console.error('Error cargando estado de flashcards:', e);
  }
}

function applyImportedFcData(data, showNotification = true) {
  if (!data || typeof data !== 'object') return false;

  fcState.userName = data.userName || '';
  fcState.postalCode = data.postalCode || '';
  fcState.userCoords = data.userCoords || null;
  fcState.locationName = data.locationName || '';
  fcState.currentIndex = typeof data.currentIndex === 'number' ? Math.max(0, Math.min(data.currentIndex, fcState.plazas.length - 1)) : 0;
  fcState.ratings = data.ratings && typeof data.ratings === 'object' ? data.ratings : {};
  fcState.groupOrders = data.groupOrders && typeof data.groupOrders === 'object'
    ? { 1: data.groupOrders[1] || [], 2: data.groupOrders[2] || [], 3: data.groupOrders[3] || [], 4: data.groupOrders[4] || [], 5: data.groupOrders[5] || [] }
    : { 1: [], 2: [], 3: [], 4: [], 5: [] };
  fcState.currentOrderGroup = data.currentOrderGroup || 1;
  fcState.autoSortApplied = data.autoSortApplied || { 4: null, 5: null };
  fcState.screen = data.screen || 'welcome';

  saveFcStateToStorage();

  if (fcState.userCoords) {
    calculateFcDistancesFromCoords(fcState.userCoords);
  } else if (fcState.postalCode) {
    geocodeAndCalculateFcDistances(fcState.postalCode, true);
  }

  if (showNotification) {
    renderFcApp();
  }
  return true;
}

// Distance calculation for Flashcards
async function geocodeAndCalculateFcDistances(queryStr, silent = false) {
  const query = (queryStr || '').trim();
  if (!query) return false;

  const statusEl = document.getElementById('fc-dist-status');
  if (statusEl) {
    statusEl.textContent = '⏳ Buscando código postal / localidad y calculando rutas en coche...';
    statusEl.style.color = 'var(--color-accent)';
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Spain&format=json&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || data.length === 0) {
      if (statusEl) {
        statusEl.textContent = '⚠️ No se encontró la ubicación. Prueba indicando código postal o ciudad (ej: 28001 o Madrid).';
        statusEl.style.color = '#ef4444';
      }
      return false;
    }

    const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    fcState.userCoords = coords;
    fcState.locationName = data[0].display_name.split(',')[0];

    await calculateFcDistancesFromCoords(coords);
    saveFcStateToStorage();

    if (statusEl) {
      statusEl.textContent = `✅ Distancias calculadas desde ${fcState.locationName}`;
      statusEl.style.color = '#10b981';
    }
    return true;
  } catch (err) {
    console.error('Error calculando distancias en flashcards:', err);
    if (statusEl) {
      statusEl.textContent = '⚠️ Error al conectar con el servidor de rutas. Se usará distancia en línea recta si está disponible.';
      statusEl.style.color = '#f59e0b';
    }
    return false;
  }
}

async function calculateFcDistancesFromCoords(userCoords) {
  if (!userCoords) return;

  // First, set quick Haversine fallback immediately so UI never shows empty while OSRM loads
  fcState.plazas.forEach(p => {
    if (p.coords) {
      const havDist = haversine(userCoords.lat, userCoords.lon, p.coords.lat, p.coords.lon);
      if (p.distancia === null) p.distancia = havDist;
    }
  });

  // Batch OSRM requests
  const validItems = fcState.plazas.filter(p => p.coords);
  const batchSize = 85;

  for (let i = 0; i < validItems.length; i += batchSize) {
    const batch = validItems.slice(i, i + batchSize);
    let coordStr = `${userCoords.lon},${userCoords.lat}`;
    batch.forEach(item => {
      coordStr += `;${item.coords.lon},${item.coords.lat}`;
    });

    try {
      const osrmUrl = `https://router.project-osrm.org/table/v1/driving/${coordStr}?sources=0&annotations=duration,distance`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();

      if (osrmData.code === 'Ok') {
        const distances = osrmData.distances[0];
        const durations = osrmData.durations[0];

        batch.forEach((item, index) => {
          const osrmDist = distances[index + 1] ? distances[index + 1] / 1000 : 0;
          const osrmDur = durations[index + 1] || 0;
          const havDist = haversine(userCoords.lat, userCoords.lon, item.coords.lat, item.coords.lon);

          const destIsOffMainland = (item.comunidad && (item.comunidad.includes('Canarias') || item.comunidad.includes('Balears'))) ||
            (item.provincia && (item.provincia === 'Ceuta' || item.provincia === 'Melilla'));

          const isFerryOrFarIsland = osrmDur === 0 || osrmDur > 50400 || (destIsOffMainland && havDist > 150);

          if (isFerryOrFarIsland) {
            item.distancia = havDist;
            item.duration = null;
          } else {
            item.distancia = osrmDist;
            item.duration = osrmDur;
          }
        });
      }
    } catch (e) {
      // Keep haversine fallback
    }
    if (i + batchSize < validItems.length) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  // Re-render if currently viewing flashcards or ordering
  if (fcState.screen === 'flashcards' || fcState.screen === 'ordering' || fcState.screen === 'final') {
    renderFcApp();
  }
}

// Export / Import Progress (JSON or CSV)
function exportFcProgressJSON() {
  const payload = {
    version: 1,
    app: 'NotariasFlashcards',
    screen: fcState.screen,
    userName: fcState.userName,
    postalCode: fcState.postalCode,
    userCoords: fcState.userCoords,
    locationName: fcState.locationName,
    currentIndex: fcState.currentIndex,
    ratings: fcState.ratings,
    groupOrders: fcState.groupOrders,
    currentOrderGroup: fcState.currentOrderGroup,
    autoSortApplied: fcState.autoSortApplied,
    savedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (fcState.userName || 'opositor').replace(/[^a-z0-9_-]/gi, '_');
  const ratedCount = Object.keys(fcState.ratings).length;
  a.href = url;
  a.download = `progreso_flashcards_${safeName}_${ratedCount}de${fcState.plazas.length}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    try {
      // Check if JSON
      if (file.name.endsWith('.json') || content.trim().startsWith('{')) {
        const data = JSON.parse(content);
        if (data && (data.ratings || data.groupOrders)) {
          applyImportedFcData(data, true);
          // If imported on welcome screen and has progress, take user directly to where they were
          if (fcState.screen === 'welcome') {
            const ratedCount = Object.keys(fcState.ratings).length;
            if (ratedCount >= fcState.plazas.length) {
              fcState.screen = 'ordering';
            } else {
              fcState.screen = 'flashcards';
            }
            saveFcStateToStorage();
            renderFcApp();
          }
          alert(`✅ Progreso importado correctamente (${Object.keys(fcState.ratings).length}/${fcState.plazas.length} notarías clasificadas).`);
          return;
        }
      }

      // Otherwise try parsing as CSV exported by this tool
      const importedFromCsv = parseImportedCsv(content);
      if (importedFromCsv) {
        alert(`✅ Orden y clasificación importados desde CSV (${Object.keys(fcState.ratings).length} notarías).`);
        renderFcApp();
      } else {
        alert('⚠️ El archivo seleccionado no tiene un formato válido de progreso o CSV de notarías.');
      }
    } catch (err) {
      console.error('Error importando archivo:', err);
      alert('⚠️ Error al leer el archivo. Asegúrate de subir un archivo .json de progreso o .csv exportado por la herramienta.');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function parseImportedCsv(csvText) {
  try {
    if (typeof XLSX === 'undefined') return false;
    const wb = XLSX.read(csvText, { type: 'string' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    if (!rows || rows.length === 0) return false;

    const newRatings = {};
    const newGroupOrders = { 1: [], 2: [], 3: [], 4: [], 5: [] };

    rows.forEach(r => {
      const loc = (r['Localidad / Plaza'] || r['Localidad'] || '').toString().trim();
      const prov = (r['Provincia'] || '').toString().trim();
      const ant = (r['Notario Anterior'] || '').toString().trim();
      const catGroupStr = (r['Valoración'] || r['Grupo'] || r['Clasificación'] || '').toString().trim();

      const match = fcState.plazas.find(p =>
        normalize(p.localidad) === normalize(loc) &&
        normalize(p.provincia) === normalize(prov) &&
        (!ant || normalize(p.notarioAnterior) === normalize(ant))
      ) || fcState.plazas.find(p =>
        normalize(p.localidad) === normalize(loc) &&
        normalize(p.provincia) === normalize(prov)
      );

      if (match) {
        let gId = 3;
        const normG = normalize(catGroupStr);
        if (normG.includes('top') || normG === '1') gId = 1;
        else if (normG.includes('muy buena') || normG === '2') gId = 2;
        else if (normG.includes('buena') || normG === '3') gId = 3;
        else if (normG.includes('muy mala') || normG === '5') gId = 5;
        else if (normG.includes('mala') || normG === '4') gId = 4;

        newRatings[match.fcId] = gId;
        if (!newGroupOrders[gId].includes(match.fcId)) {
          newGroupOrders[gId].push(match.fcId);
        }
      }
    });

    if (Object.keys(newRatings).length === 0) return false;

    fcState.ratings = newRatings;
    fcState.groupOrders = newGroupOrders;
    if (rows[0]['Nombre Usuario']) fcState.userName = rows[0]['Nombre Usuario'];
    if (rows[0]['Código Postal Origen']) fcState.postalCode = rows[0]['Código Postal Origen'].toString();

    const ratedCount = Object.keys(newRatings).length;
    if (ratedCount >= fcState.plazas.length) {
      fcState.screen = 'final';
    } else {
      fcState.screen = 'flashcards';
      const firstUnrated = fcState.plazas.findIndex(p => !fcState.ratings[p.fcId]);
      fcState.currentIndex = firstUnrated !== -1 ? firstUnrated : 0;
    }

    saveFcStateToStorage();
    if (fcState.postalCode) geocodeAndCalculateFcDistances(fcState.postalCode, true);
    return true;
  } catch (e) {
    return false;
  }
}

// Sync groupOrders with current ratings
function syncGroupOrders() {
  for (let g = 1; g <= 5; g++) {
    const validIdsForGroup = fcState.plazas
      .filter(p => fcState.ratings[p.fcId] === g)
      .map(p => p.fcId);

    // Keep existing order for items still in this group
    const existingOrdered = (fcState.groupOrders[g] || []).filter(id => validIdsForGroup.includes(id));
    // Append any newly rated items in this group
    const missing = validIdsForGroup.filter(id => !existingOrdered.includes(id));
    fcState.groupOrders[g] = [...existingOrdered, ...missing];
  }
}

// Navigation & Actions
function rateCurrentCard(groupId) {
  const plaza = fcState.plazas[fcState.currentIndex];
  if (!plaza) return;

  fcState.ratings[plaza.fcId] = groupId;
  syncGroupOrders();

  // Find if there are remaining unrated cards or move to next
  if (fcState.currentIndex < fcState.plazas.length - 1) {
    fcState.currentIndex++;
    fcState.galoExpanded = false;
    saveFcStateToStorage();
    renderFcApp();
  } else {
    // Check if any card was left unrated earlier
    const firstUnrated = fcState.plazas.findIndex(p => !fcState.ratings[p.fcId]);
    if (firstUnrated !== -1) {
      fcState.currentIndex = firstUnrated;
      fcState.galoExpanded = false;
      saveFcStateToStorage();
      renderFcApp();
    } else {
      // All cards rated! Go to Screen 3 (Ordering)
      goToOrderingScreen(1);
    }
  }
}

function prevFlashcard() {
  if (fcState.currentIndex > 0) {
    fcState.currentIndex--;
    fcState.galoExpanded = false;
    saveFcStateToStorage();
    renderFcApp();
  }
}

function nextFlashcard() {
  if (fcState.currentIndex < fcState.plazas.length - 1) {
    fcState.currentIndex++;
    fcState.galoExpanded = false;
    saveFcStateToStorage();
    renderFcApp();
  }
}

function goToOrderingScreen(groupNum = 1) {
  syncGroupOrders();
  fcState.screen = 'ordering';
  fcState.currentOrderGroup = groupNum;
  saveFcStateToStorage();
  renderFcApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sortCurrentGroupBy(criterion, direction = 'desc') {
  const g = fcState.currentOrderGroup;
  const ids = [...(fcState.groupOrders[g] || [])];
  const mapPlaza = {};
  fcState.plazas.forEach(p => { mapPlaza[p.fcId] = p; });

  ids.sort((idA, idB) => {
    const a = mapPlaza[idA];
    const b = mapPlaza[idB];
    if (!a || !b) return 0;

    if (criterion === 'protocolos') {
      const vA = a.protocolos2025 !== null ? a.protocolos2025 : -1;
      const vB = b.protocolos2025 !== null ? b.protocolos2025 : -1;
      return direction === 'desc' ? vB - vA : vA - vB;
    }
    if (criterion === 'distancia') {
      const vA = a.distancia !== null ? a.distancia : 999999;
      const vB = b.distancia !== null ? b.distancia : 999999;
      return direction === 'asc' ? vA - vB : vB - vA;
    }
    if (criterion === 'polizas') {
      const vA = a.polizas2025 !== null ? a.polizas2025 : -1;
      const vB = b.polizas2025 !== null ? b.polizas2025 : -1;
      return direction === 'desc' ? vB - vA : vA - vB;
    }
    return 0;
  });

  fcState.groupOrders[g] = ids;
  if (g === 4 || g === 5) {
    fcState.autoSortApplied[g] = `${criterion}_${direction}`;
  }
  saveFcStateToStorage();
  renderFcApp();
}

function moveItemInCurrentGroup(index, delta) {
  const g = fcState.currentOrderGroup;
  const arr = fcState.groupOrders[g];
  const target = index + delta;
  if (target < 0 || target >= arr.length) return;
  const temp = arr[index];
  arr[index] = arr[target];
  arr[target] = temp;
  saveFcStateToStorage();
  renderFcApp();
}

function openFullGaloModal(plaza) {
  const modal = document.getElementById('galo-modal');
  if (!modal || !plaza) return;
  document.getElementById('galo-modal-title').textContent = `📋 Informe Galo: ${plaza.localidad}`;
  document.getElementById('galo-modal-subtitle').textContent = `${plaza.provincia} (${plaza.comunidad}) — Notario ant.: ${plaza.notarioAnterior}`;
  const contentEl = document.getElementById('galo-modal-content');
  contentEl.innerHTML = formatInformeGaloHtml(plaza.informeGalo);
  modal.style.display = 'flex';
}

function formatInformeGaloHtml(text) {
  if (!text) {
    return `<div class="fc-galo-empty">Sin información en el Informe Galo para esta plaza.</div>`;
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  return lines.map(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 35) {
      const key = escapeHTML(line.slice(0, colonIdx + 1));
      const val = escapeHTML(line.slice(colonIdx + 1).trim());
      return `<div class="fc-galo-line"><strong>${key}</strong> <span>${val}</span></div>`;
    }
    return `<div class="fc-galo-line">${escapeHTML(line)}</div>`;
  }).join('');
}

// Export Final CSV with all columns in order of election
function downloadFinalOrderedCSV() {
  syncGroupOrders();
  const mapPlaza = {};
  fcState.plazas.forEach(p => { mapPlaza[p.fcId] = p; });

  const finalOrderedPlazas = [];
  for (let g = 1; g <= 5; g++) {
    (fcState.groupOrders[g] || []).forEach(id => {
      if (mapPlaza[id]) {
        finalOrderedPlazas.push({ plaza: mapPlaza[id], groupId: g });
      }
    });
  }

  // Also include any unrated plazas at the end just in case
  fcState.plazas.forEach(p => {
    if (!fcState.ratings[p.fcId]) {
      finalOrderedPlazas.push({ plaza: p, groupId: null });
    }
  });

  // Headers: Orden Elección, Valoración, Núm. Notarios Localidad, Distancia (km), Tiempo Coche, plus all original CSV headers
  const extraLeadHeaders = [
    'Orden Elección',
    'Valoración',
    'Nombre Usuario',
    'Código Postal Origen',
    'Núm. Notarios Localidad',
    'Distancia (km)',
    'Tiempo en Coche'
  ];

  const baseHeaders = typeof DATA_GALO_HEADERS !== 'undefined' ? DATA_GALO_HEADERS : Object.keys(fcState.plazas[0]?.raw || {});
  const allHeaders = [...extraLeadHeaders, ...baseHeaders];

  const csvRows = [];
  csvRows.push(allHeaders.map(escapeCsvCell).join(','));

  finalOrderedPlazas.forEach((item, idx) => {
    const p = item.plaza;
    const gObj = FC_GROUPS.find(g => g.id === item.groupId);
    const groupLabel = gObj ? `${gObj.id} - ${gObj.name}` : 'Sin clasificar';
    const distStr = p.distancia !== null && p.distancia !== undefined ? p.distancia.toFixed(1) : '';
    const timeStr = p.duration ? formatDuration(p.duration) : '';

    const leadVals = [
      idx + 1,
      groupLabel,
      fcState.userName || '',
      fcState.postalCode || '',
      p.numNotarias,
      distStr,
      timeStr
    ];

    const rawVals = baseHeaders.map(h => p.raw[h] !== undefined && p.raw[h] !== null ? p.raw[h] : '');
    const row = [...leadVals, ...rawVals];
    csvRows.push(row.map(escapeCsvCell).join(','));
  });

  // Add UTF-8 BOM so Excel opens Spanish characters cleanly
  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (fcState.userName || 'notarias').replace(/[^a-z0-9_-]/gi, '_');
  a.href = url;
  a.download = `listado_eleccion_notarias_${safeName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ================= RENDERING =================

function renderFcApp() {
  const container = document.getElementById('fc-app-container');
  if (!container) return;

  if (!fcState.unlocked && sessionStorage.getItem('fcUnlocked') !== 'true') {
    container.innerHTML = renderPasswordScreen();
    attachPasswordEvents();
    return;
  }
  fcState.unlocked = true;

  const ratedCount = Object.keys(fcState.ratings).length;
  const totalCount = fcState.plazas.length;

  // Persistent Top Bar (Always available to save/import progress or switch stages)
  const topBarHtml = `
    <div class="fc-topbar">
      <div class="fc-topbar-left">
        <div class="fc-steps-nav">
          <button class="fc-step-pill ${fcState.screen === 'welcome' ? 'active' : ''}" id="fc-nav-welcome">
            1. Inicio ${fcState.postalCode ? `(${escapeHTML(fcState.postalCode)})` : ''}
          </button>
          <button class="fc-step-pill ${fcState.screen === 'flashcards' ? 'active' : ''}" id="fc-nav-flashcards">
            2. Flashcards (${ratedCount}/${totalCount})
          </button>
          <button class="fc-step-pill ${fcState.screen === 'ordering' ? 'active' : ''}" id="fc-nav-ordering" ${ratedCount === 0 ? 'disabled title="Clasifica al menos una plaza primero"' : ''}>
            3. Ordenar Grupos
          </button>
          <button class="fc-step-pill ${fcState.screen === 'final' ? 'active' : ''}" id="fc-nav-final" ${ratedCount === 0 ? 'disabled title="Clasifica al menos una plaza primero"' : ''}>
            4. Descargar CSV
          </button>
        </div>
      </div>
      <div class="fc-topbar-right">
        <button class="action-btn-secondary fc-btn-sm" id="fc-btn-save-progress" title="Descargar el progreso actual para continuar en otro momento o dispositivo">
          💾 Guardar Progreso
        </button>
        <label class="action-btn-secondary fc-btn-sm" style="cursor:pointer; margin:0;" title="Importar un archivo de progreso guardado (.json o .csv)">
          📂 Importar Progreso
          <input type="file" id="fc-input-import-top" accept=".json,.csv" style="display:none;">
        </label>
      </div>
    </div>
  `;

  let bodyHtml = '';
  if (fcState.screen === 'welcome') {
    bodyHtml = renderWelcomeScreen(ratedCount, totalCount);
  } else if (fcState.screen === 'flashcards') {
    bodyHtml = renderFlashcardScreen(ratedCount, totalCount);
  } else if (fcState.screen === 'ordering') {
    bodyHtml = renderOrderingScreen();
  } else if (fcState.screen === 'final') {
    bodyHtml = renderFinalScreen();
  }

  container.innerHTML = topBarHtml + bodyHtml;
  attachFcEvents();
}

function renderPasswordScreen() {
  return `
    <div class="fc-welcome-wrapper">
      <div class="fc-welcome-card" style="max-width: 440px; text-align: center;">
        <div class="fc-welcome-badge">🔒 Acceso Restringido</div>
        <h2 class="fc-welcome-title">Asistente Flashcards</h2>
        <p class="fc-welcome-desc" style="margin-bottom: 20px;">
          Introduce la contraseña para acceder a la herramienta de valoración e Informe Galo.
        </p>
        <form id="fc-password-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="password" id="fc-password-input" class="search-input" style="min-width: unset; text-align: center; font-size: 16px;" placeholder="Contraseña..." autocomplete="current-password" required>
          <div id="fc-password-error" style="display: none; color: #ef4444; font-size: 13px; font-weight: 600;">
            ❌ Contraseña incorrecta. Inténtalo de nuevo.
          </div>
          <button type="submit" class="action-btn fc-btn-lg" style="width: 100%;">
            🔓 Entrar
          </button>
        </form>
      </div>
    </div>
  `;
}

function attachPasswordEvents() {
  const form = document.getElementById('fc-password-form');
  const input = document.getElementById('fc-password-input');
  const errEl = document.getElementById('fc-password-error');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value === 'C@pitan23') {
      fcState.unlocked = true;
      sessionStorage.setItem('fcUnlocked', 'true');
      renderFcApp();
    } else {
      if (errEl) errEl.style.display = 'block';
      input.value = '';
      input.focus();
    }
  });
}

function renderWelcomeScreen(ratedCount, totalCount) {
  const hasSavedProgress = ratedCount > 0;

  return `
    <div class="fc-welcome-wrapper">
      <div class="fc-welcome-card">
        <div class="fc-welcome-badge">🃏 Asistente de Elección de Vacantes</div>
        <h2 class="fc-welcome-title">Clasifica y ordena tus Notarías Vacantes</h2>
        <p class="fc-welcome-desc">
          Revisa una a una las <strong>${totalCount} plazas vacantes</strong> por orden alfabético con su <strong>Informe Galo</strong>, estadísticas de protocolos y pólizas de 2025, y tiempo en coche desde tu domicilio. Clasifícalas en 5 niveles y ordénalas fácilmente antes de descargar tu listado definitivo en CSV.
        </p>

        <div class="fc-form-grid">
          <div class="fc-form-group">
            <label for="fc-user-name">👤 Tu Nombre</label>
            <input type="text" id="fc-user-name" class="search-input" placeholder="Ej: Miguel" value="${escapeHTML(fcState.userName)}">
          </div>
          <div class="fc-form-group">
            <label for="fc-postal-code">📍 Código Postal o Localidad donde vives / deseas vivir</label>
            <input type="text" id="fc-postal-code" class="search-input" placeholder="Ej: 28001 o Madrid" value="${escapeHTML(fcState.postalCode)}">
            <small class="fc-field-hint">Se usará para calcular la distancia y tiempo en coche a cada notaría vacante.</small>
          </div>
        </div>

        <div id="fc-dist-status" class="fc-dist-status">
          ${fcState.locationName ? `✅ Ubicación configurada: ${escapeHTML(fcState.locationName)}` : ''}
        </div>

        <div class="fc-welcome-actions">
          <button id="fc-start-btn" class="action-btn fc-btn-lg">
            ${hasSavedProgress ? `▶️ Continuar donde lo dejé (${ratedCount}/${totalCount})` : '🚀 Empezar con las Flashcards'}
          </button>
          ${hasSavedProgress ? `
            <button id="fc-restart-btn" class="action-btn-secondary fc-btn-lg" style="color:#ef4444; border-color:rgba(239,68,68,0.4);">
              🔄 Reiniciar desde cero
            </button>
          ` : ''}
        </div>

        <div class="fc-import-box">
          <div class="fc-import-box-header">
            <strong>📂 ¿Tienes un progreso o listado guardado anteriormente?</strong>
            <p>Puedes importar tu archivo de progreso (<code>.json</code>) o un listado exportado (<code>.csv</code>) para retomar exactamente por donde ibas.</p>
          </div>
          <div class="fc-import-box-actions">
            <label class="action-btn-secondary" style="cursor:pointer;">
              ⬆️ Seleccionar archivo (.json / .csv)
              <input type="file" id="fc-welcome-import-input" accept=".json,.csv" style="display:none;">
            </label>
            ${hasSavedProgress ? `
              <button id="fc-welcome-export-btn" class="action-btn-secondary">
                💾 Descargar copia actual (${ratedCount}/${totalCount})
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFlashcardScreen(ratedCount, totalCount) {
  const p = fcState.plazas[fcState.currentIndex];
  if (!p) return `<div class="empty-state">No hay plazas disponibles.</div>`;

  const currentRating = fcState.ratings[p.fcId] || null;
  const pct = Math.round((ratedCount / totalCount) * 100);

  const badgeMotivo = p.motivo.includes('Jubilación')
    ? 'badge-jubilacion'
    : p.motivo === 'Resulta'
      ? 'badge-resulta'
      : p.motivo === 'Excedencia'
        ? 'badge-excedencia'
        : 'badge-desierta';

  const badgeCat = p.categoria === 'Primera'
    ? 'badge-primera'
    : p.categoria === 'Segunda'
      ? 'badge-segunda'
      : 'badge-tercera';

  const distText = p.distancia !== null && p.distancia !== undefined
    ? `${p.distancia.toFixed(1)} km`
    : (fcState.postalCode ? 'Calculando...' : 'Sin C.P.');

  const timeText = p.duration
    ? formatDuration(p.duration)
    : (p.distancia !== null && p.distancia !== undefined ? '✈️ / Ferry o s/d' : (fcState.postalCode ? 'Calculando...' : 'Sin C.P.'));

  const protText = p.protocolos2025 !== null ? p.protocolos2025.toLocaleString('es-ES') : 'Sin datos';
  const polText = p.polizas2025 !== null ? p.polizas2025.toLocaleString('es-ES') : 'Sin datos';

  const galoText = p.informeGalo || '';
  const isLongGalo = galoText.length > 260 || galoText.split('\n').length > 4;

  // Group counts summary
  const groupCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  Object.values(fcState.ratings).forEach(g => {
    if (groupCounts[g] !== undefined) groupCounts[g]++;
  });

  return `
    <div class="fc-stage-wrapper">
      <!-- Progress Header -->
      <div class="fc-progress-panel">
        <div class="fc-progress-info">
          <span>Tarjeta <strong>${fcState.currentIndex + 1}</strong> de <strong>${totalCount}</strong></span>
          <span class="fc-progress-Right">Clasificadas: <strong>${ratedCount} / ${totalCount}</strong> (${pct}%)</span>
        </div>
        <div class="fc-progress-bar-bg">
          <div class="fc-progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="fc-mini-counters">
          ${FC_GROUPS.map(g => `
            <span class="fc-mini-pill" style="background:${g.bg}; color:${g.color}; border:1px solid ${g.border};">
              ${g.shortLabel}: <strong>${groupCounts[g.id]}</strong>
            </span>
          `).join('')}
        </div>
      </div>

      <!-- Navigation Controls -->
      <div class="fc-card-nav-row">
        <button class="action-btn-secondary fc-nav-btn" id="fc-prev-btn" ${fcState.currentIndex === 0 ? 'disabled' : ''}>
          ⬅️ Anterior
        </button>
        <div class="fc-jump-selector">
          <select id="fc-card-jump" class="filter-select" style="max-width: 280px; padding: 6px 10px; font-size: 13px;">
            ${fcState.plazas.map((item, idx) => {
              const r = fcState.ratings[item.fcId];
              const mark = r ? `[${r}] ` : '• ';
              return `<option value="${idx}" ${idx === fcState.currentIndex ? 'selected' : ''}>${idx + 1}. ${mark}${escapeHTML(item.comunidad)} - ${escapeHTML(item.provincia)} - ${escapeHTML(item.localidad)}</option>`;
            }).join('')}
          </select>
        </div>
        <button class="action-btn-secondary fc-nav-btn" id="fc-next-btn" ${fcState.currentIndex === totalCount - 1 ? 'disabled' : ''}>
          Siguiente ➡️
        </button>
      </div>

      <!-- Main Flashcard -->
      <div class="fc-flashcard">
        <div class="fc-card-header">
          <div class="fc-card-location-hierarchy">
            <span class="fc-crumb">${escapeHTML(p.comunidad)}</span>
            <span class="fc-crumb-sep">›</span>
            <span class="fc-crumb">${escapeHTML(p.provincia)}</span>
          </div>
          <div class="fc-card-title-row">
            <h2 class="fc-card-locality">
              <a href="#" data-action="openTownModal" data-localidad="${escapeHTML(p.localidad)}" data-provincia="${escapeHTML(p.provincia)}" class="town-link" title="Ver ficha de la localidad">
                ${escapeHTML(p.localidad)}
              </a>
            </h2>
            <div class="fc-card-badges">
              <span class="badge ${badgeMotivo}">${escapeHTML(p.motivo)}</span>
              <span class="badge ${badgeCat}">Cat. ${escapeHTML(p.categoria)}</span>
            </div>
          </div>
        </div>

        <!-- Data Grid -->
        <div class="fc-data-grid">
          <div class="fc-data-item">
            <span class="fc-data-label">👤 Notario Anterior</span>
            <span class="fc-data-value">${escapeHTML(p.notarioAnterior)}</span>
          </div>
          <div class="fc-data-item">
            <span class="fc-data-label">🏛️ Notarios en Localidad</span>
            <span class="fc-data-value">${p.numNotarias} ${p.numNotarias === 1 ? 'notario (Única)' : 'notarios'}</span>
          </div>
          <div class="fc-data-item fc-data-highlight">
            <span class="fc-data-label">📜 Protocolos 2025</span>
            <span class="fc-data-value">${protText}</span>
          </div>
          <div class="fc-data-item fc-data-highlight">
            <span class="fc-data-label">📑 Pólizas 2025</span>
            <span class="fc-data-value">${polText}</span>
          </div>
          <div class="fc-data-item">
            <span class="fc-data-label">📍 Distancia ${fcState.postalCode ? `(${escapeHTML(fcState.postalCode)})` : ''}</span>
            <span class="fc-data-value">${distText}</span>
          </div>
          <div class="fc-data-item">
            <span class="fc-data-label">🚗 Tiempo estimado</span>
            <span class="fc-data-value">${timeText}</span>
          </div>
        </div>

        <!-- INFORME GALO (Destacado y desplegable) -->
        <div class="fc-galo-box">
          <div class="fc-galo-header">
            <div class="fc-galo-title">
              <span>📋 Informe Galo</span>
              <span class="fc-galo-important-tag">Destacado</span>
            </div>
            ${galoText ? `
              <div class="fc-galo-actions">
                ${isLongGalo ? `
                  <button type="button" class="fc-galo-toggle-btn" id="fc-toggle-galo-inline">
                    ${fcState.galoExpanded ? '🔼 Plegar' : '🔽 Desplegar todo'}
                  </button>
                ` : ''}
                <button type="button" class="fc-galo-modal-btn" id="fc-open-galo-modal">
                  🔍 Ver en pantalla completa
                </button>
              </div>
            ` : ''}
          </div>
          <div class="fc-galo-body ${!fcState.galoExpanded && isLongGalo ? 'fc-galo-collapsed' : ''}" id="fc-galo-body-content">
            ${formatInformeGaloHtml(galoText)}
          </div>
          ${!fcState.galoExpanded && isLongGalo ? `
            <div class="fc-galo-fade-overlay" id="fc-galo-expand-overlay">
              <span>👇 Toca para desplegar el Informe Galo completo</span>
            </div>
          ` : ''}
        </div>

        <!-- Rating Buttons (1 to 5) -->
        <div class="fc-rating-section">
          <div class="fc-rating-prompt">
            ¿Cómo valoras esta notaría?
            ${currentRating ? `<span class="fc-current-rating-note">(Actual: <strong>${FC_GROUPS.find(g => g.id === currentRating)?.name}</strong>)</span>` : ''}
          </div>
          <div class="fc-rating-buttons">
            ${FC_GROUPS.map(g => {
              const isSelected = currentRating === g.id;
              return `
                <button type="button" class="fc-rate-btn ${isSelected ? 'selected' : ''}" data-group="${g.id}" style="--btn-color:${g.color}; --btn-bg:${g.bg}; --btn-border:${g.border};">
                  <span class="fc-rate-num">${g.id}</span>
                  <span class="fc-rate-text">${g.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      ${ratedCount === totalCount ? `
        <div class="fc-all-rated-banner">
          <span>🎉 ¡Has clasificado las ${totalCount} notarías!</span>
          <button class="action-btn" id="fc-go-order-btn">Ir a ordenar mis listas ➡️</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderOrderingScreen() {
  syncGroupOrders();
  const gId = fcState.currentOrderGroup;
  const groupObj = FC_GROUPS.find(g => g.id === gId) || FC_GROUPS[0];
  const groupPlazaIds = fcState.groupOrders[gId] || [];

  const mapPlaza = {};
  fcState.plazas.forEach(p => { mapPlaza[p.fcId] = p; });

  // Compute global starting rank offset before this group
  let rankOffset = 0;
  for (let prevG = 1; prevG < gId; prevG++) {
    rankOffset += (fcState.groupOrders[prevG] || []).length;
  }

  const isMalaOrMuyMala = gId === 4 || gId === 5;

  return `
    <div class="fc-ordering-wrapper">
      <!-- Group Stepper Header -->
      <div class="fc-group-stepper">
        ${FC_GROUPS.map(g => {
          const count = (fcState.groupOrders[g.id] || []).length;
          const active = g.id === gId ? 'active' : '';
          const done = g.id < gId ? 'done' : '';
          return `
            <button type="button" class="fc-group-step-btn ${active} ${done}" data-step-group="${g.id}" style="--g-color:${g.color};">
              <span class="fc-gstep-title">${g.id}. ${g.name}</span>
              <span class="fc-gstep-count">${count} plaza${count !== 1 ? 's' : ''}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="fc-ordering-header-card" style="border-left: 5px solid ${groupObj.color};">
        <div>
          <h2 style="margin:0; font-size: 1.4rem; color: var(--color-text);">
            Ordenando grupo: <span style="color:${groupObj.color};">${groupObj.label}</span>
          </h2>
          <p style="margin: 4px 0 0; font-size: 13.5px; color: var(--color-text-muted);">
            ${isMalaOrMuyMala
              ? 'Elige cómo quieres colocar automáticamente estas plazas (por número de protocolos o por distancia) o ajústalas arrastrando.'
              : 'Arrastra las filas desde el icono (☰) o usa las flechas (⬆️⬇️) para definir tu orden de preferencia dentro de este bloque.'}
          </p>
        </div>
        <div class="fc-ordering-quick-actions">
          <button type="button" class="action-btn-secondary fc-btn-sm" id="fc-sort-prot-desc" title="Ordenar de mayor a menor número de protocolos 2025">
            📜 Más Protocolos
          </button>
          <button type="button" class="action-btn-secondary fc-btn-sm" id="fc-sort-dist-asc" title="Ordenar de menor a mayor distancia a tu Código Postal">
            🚗 Menor Distancia
          </button>
        </div>
      </div>

      ${isMalaOrMuyMala && groupPlazaIds.length > 0 ? `
        <div class="fc-mala-prompt-card">
          <div class="fc-mala-prompt-title">
            🤔 ¿Cómo prefieres colocar las notarías clasificadas como <strong>${groupObj.name}</strong>?
          </div>
          <div class="fc-mala-prompt-buttons">
            <button type="button" class="fc-mala-choice-btn ${fcState.autoSortApplied[gId] === 'protocolos_desc' ? 'active' : ''}" id="fc-mala-prot-desc">
              📜 Por número de protocolos (De mayor a menor)
            </button>
            <button type="button" class="fc-mala-choice-btn ${fcState.autoSortApplied[gId] === 'distancia_asc' ? 'active' : ''}" id="fc-mala-dist-asc">
              📍 Por distancia a mi C.P. (De más cerca a más lejos)
            </button>
            <button type="button" class="fc-mala-choice-btn ${fcState.autoSortApplied[gId] === 'protocolos_asc' ? 'active' : ''}" id="fc-mala-prot-asc">
              📉 Por número de protocolos (De menor a mayor)
            </button>
          </div>
        </div>
      ` : ''}

      ${groupPlazaIds.length === 0 ? `
        <div class="empty-state" style="margin: 24px 0;">
          No has clasificado ninguna notaría en el grupo <strong>${groupObj.name}</strong>. Puedes pasar directamente al siguiente grupo.
        </div>
      ` : `
        <div class="table-responsive fc-order-table-wrap">
          <table class="table fc-order-table" id="fc-sortable-table">
            <thead>
              <tr>
                <th class="center" style="width: 90px;">Orden</th>
                <th>Provincia</th>
                <th>Localidad</th>
                <th class="center">Categoría</th>
                <th class="center">Núm. Protocolos 2025</th>
                <th class="center">Núm. Pólizas 2025</th>
                <th class="center">Distancia / Tiempo</th>
                <th class="center">Informe / Mover</th>
              </tr>
            </thead>
            <tbody id="fc-order-tbody">
              ${groupPlazaIds.map((id, idx) => {
                const p = mapPlaza[id];
                if (!p) return '';
                const badgeCat = p.categoria === 'Primera' ? 'badge-primera' : p.categoria === 'Segunda' ? 'badge-segunda' : 'badge-tercera';
                const protStr = p.protocolos2025 !== null ? p.protocolos2025.toLocaleString('es-ES') : '-';
                const polStr = p.polizas2025 !== null ? p.polizas2025.toLocaleString('es-ES') : '-';
                const distStr = p.distancia !== null ? `${p.distancia.toFixed(1)} km` : '-';
                const timeStr = p.duration ? ` (${formatDuration(p.duration)})` : '';

                return `
                  <tr data-id="${escapeHTML(p.fcId)}" class="fc-sortable-row">
                    <td class="center fc-drag-handle" data-label="Orden">
                      <span class="fc-handle-icon">☰</span>
                      <span class="fc-rank-badge" style="background:${groupObj.bg}; color:${groupObj.color};">#${rankOffset + idx + 1}</span>
                    </td>
                    <td data-label="Provincia">${escapeHTML(p.provincia)}</td>
                    <td data-label="Localidad">
                      <strong>${escapeHTML(p.localidad)}</strong>
                      <div style="font-size:11px; color:var(--color-text-muted);">${escapeHTML(p.notarioAnterior)} (${escapeHTML(p.motivo)})</div>
                    </td>
                    <td class="center" data-label="Categoría"><span class="badge ${badgeCat}">${escapeHTML(p.categoria)}</span></td>
                    <td class="center" data-label="Protocolos 2025"><strong>${protStr}</strong></td>
                    <td class="center" data-label="Pólizas 2025">${polStr}</td>
                    <td class="center" data-label="Distancia">${distStr}<small style="color:var(--color-text-muted);">${timeStr}</small></td>
                    <td class="center" data-label="Acciones">
                      <div class="fc-row-actions">
                        <button type="button" class="fc-icon-action" data-view-galo="${escapeHTML(p.fcId)}" title="Ver Informe Galo">📋</button>
                        <button type="button" class="fc-icon-action" data-move-up="${idx}" ${idx === 0 ? 'disabled' : ''} title="Subir posición">⬆️</button>
                        <button type="button" class="fc-icon-action" data-move-down="${idx}" ${idx === groupPlazaIds.length - 1 ? 'disabled' : ''} title="Bajar posición">⬇️</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}

      <div class="fc-ordering-footer">
        <button type="button" class="action-btn-secondary fc-btn-lg" id="fc-order-prev-btn">
          ${gId === 1 ? '⬅️ Volver a las Flashcards' : `⬅️ Anterior (${FC_GROUPS[gId - 2].name})`}
        </button>
        <button type="button" class="action-btn fc-btn-lg" id="fc-order-next-btn">
          ${gId < 5 ? `Confirmar ${groupObj.name} y pasar a "${FC_GROUPS[gId].name}" ➡️` : '✅ Finalizar y ver listado completo'}
        </button>
      </div>
    </div>
  `;
}

function renderFinalScreen() {
  syncGroupOrders();
  const mapPlaza = {};
  fcState.plazas.forEach(p => { mapPlaza[p.fcId] = p; });

  const finalItems = [];
  for (let g = 1; g <= 5; g++) {
    const gObj = FC_GROUPS.find(x => x.id === g);
    (fcState.groupOrders[g] || []).forEach(id => {
      if (mapPlaza[id]) {
        finalItems.push({ p: mapPlaza[id], gObj });
      }
    });
  }

  return `
    <div class="fc-final-wrapper">
      <div class="fc-final-hero">
        <div class="fc-final-icon">🎉</div>
        <h2>¡Listado de Elección de Notarías Completado!</h2>
        <p>
          ${fcState.userName ? `Enhorabuena, <strong>${escapeHTML(fcState.userName)}</strong>. ` : ''}
          Has clasificado y ordenado <strong>${finalItems.length} notarías vacantes</strong>${fcState.postalCode ? ` calculando distancias desde <strong>${escapeHTML(fcState.postalCode)}</strong>` : ''}.
        </p>
        <div class="fc-final-actions">
          <button type="button" class="action-btn fc-btn-lg" id="fc-download-final-csv" style="background:#10b981; border-color:#10b981;">
            ⬇️ Descargar Listado Completo en CSV
          </button>
          <button type="button" class="action-btn-secondary fc-btn-lg" id="fc-final-save-json">
            💾 Descargar copia de seguridad (.json)
          </button>
          <button type="button" class="action-btn-secondary fc-btn-lg" id="fc-final-back-order">
            ✏️ Modificar el orden
          </button>
        </div>
      </div>

      <div class="fc-final-preview-header">
        <h3>Vista previa del orden final de elección (${finalItems.length} plazas)</h3>
      </div>

      <div class="table-responsive">
        <table class="table fc-order-table">
          <thead>
            <tr>
              <th class="center">Orden</th>
              <th class="center">Valoración</th>
              <th>Comunidad</th>
              <th>Provincia</th>
              <th>Localidad</th>
              <th class="center">Categoría</th>
              <th class="center">Protocolos 2025</th>
              <th class="center">Pólizas 2025</th>
              <th class="center">Distancia / Tiempo</th>
              <th class="center">Informe Galo</th>
            </tr>
          </thead>
          <tbody>
            ${finalItems.map((item, idx) => {
              const p = item.p;
              const g = item.gObj;
              const badgeCat = p.categoria === 'Primera' ? 'badge-primera' : p.categoria === 'Segunda' ? 'badge-segunda' : 'badge-tercera';
              const protStr = p.protocolos2025 !== null ? p.protocolos2025.toLocaleString('es-ES') : '-';
              const polStr = p.polizas2025 !== null ? p.polizas2025.toLocaleString('es-ES') : '-';
              const distStr = p.distancia !== null ? `${p.distancia.toFixed(1)} km` : '-';
              const timeStr = p.duration ? ` (${formatDuration(p.duration)})` : '';

              return `
                <tr>
                  <td class="center" data-label="Orden"><strong>#${idx + 1}</strong></td>
                  <td class="center" data-label="Valoración">
                    <span class="badge" style="background:${g.bg}; color:${g.color}; border:1px solid ${g.border};">${g.id} - ${g.name}</span>
                  </td>
                  <td data-label="Comunidad">${escapeHTML(p.comunidad)}</td>
                  <td data-label="Provincia">${escapeHTML(p.provincia)}</td>
                  <td data-label="Localidad">
                    <strong>${escapeHTML(p.localidad)}</strong>
                    <div style="font-size:11px; color:var(--color-text-muted);">${escapeHTML(p.notarioAnterior)}</div>
                  </td>
                  <td class="center" data-label="Categoría"><span class="badge ${badgeCat}">${escapeHTML(p.categoria)}</span></td>
                  <td class="center" data-label="Protocolos 2025"><strong>${protStr}</strong></td>
                  <td class="center" data-label="Pólizas 2025">${polStr}</td>
                  <td class="center" data-label="Distancia">${distStr}<small style="color:var(--color-text-muted);">${timeStr}</small></td>
                  <td class="center" data-label="Informe Galo">
                    <button type="button" class="fc-icon-action" data-view-galo="${escapeHTML(p.fcId)}" title="Ver Informe Galo">📋 Ver</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ================= EVENT BINDING =================

function attachFcEvents() {
  // Topbar navigation
  document.getElementById('fc-nav-welcome')?.addEventListener('click', () => {
    fcState.screen = 'welcome';
    saveFcStateToStorage();
    renderFcApp();
  });
  document.getElementById('fc-nav-flashcards')?.addEventListener('click', () => {
    fcState.screen = 'flashcards';
    saveFcStateToStorage();
    renderFcApp();
  });
  document.getElementById('fc-nav-ordering')?.addEventListener('click', () => {
    goToOrderingScreen(fcState.currentOrderGroup || 1);
  });
  document.getElementById('fc-nav-final')?.addEventListener('click', () => {
    fcState.screen = 'final';
    saveFcStateToStorage();
    renderFcApp();
  });

  // Topbar save/import
  document.getElementById('fc-btn-save-progress')?.addEventListener('click', exportFcProgressJSON);
  document.getElementById('fc-input-import-top')?.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleImportFile(e.target.files[0]);
  });

  // Welcome screen events
  if (fcState.screen === 'welcome') {
    const nameInput = document.getElementById('fc-user-name');
    const cpInput = document.getElementById('fc-postal-code');

    document.getElementById('fc-start-btn')?.addEventListener('click', async () => {
      const newName = nameInput ? nameInput.value.trim() : '';
      const newCp = cpInput ? cpInput.value.trim() : '';
      const cpChanged = newCp !== fcState.postalCode;

      fcState.userName = newName;
      fcState.postalCode = newCp;
      saveFcStateToStorage();

      if (newCp && (cpChanged || !fcState.userCoords)) {
        const btn = document.getElementById('fc-start-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '⏳ Calculando distancias...';
        }
        await geocodeAndCalculateFcDistances(newCp);
      }

      // Start or resume flashcards
      const ratedCount = Object.keys(fcState.ratings).length;
      if (ratedCount > 0 && ratedCount < fcState.plazas.length) {
        const firstUnrated = fcState.plazas.findIndex(p => !fcState.ratings[p.fcId]);
        if (firstUnrated !== -1) fcState.currentIndex = firstUnrated;
      }
      fcState.screen = 'flashcards';
      saveFcStateToStorage();
      renderFcApp();
    });

    document.getElementById('fc-restart-btn')?.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres borrar tu progreso actual y empezar desde la primera tarjeta?')) {
        fcState.ratings = {};
        fcState.groupOrders = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        fcState.currentIndex = 0;
        fcState.currentOrderGroup = 1;
        fcState.autoSortApplied = { 4: null, 5: null };
        saveFcStateToStorage();
        renderFcApp();
      }
    });

    document.getElementById('fc-welcome-import-input')?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleImportFile(e.target.files[0]);
    });

    document.getElementById('fc-welcome-export-btn')?.addEventListener('click', exportFcProgressJSON);
  }

  // Flashcards screen events
  if (fcState.screen === 'flashcards') {
    document.getElementById('fc-prev-btn')?.addEventListener('click', prevFlashcard);
    document.getElementById('fc-next-btn')?.addEventListener('click', nextFlashcard);

    document.getElementById('fc-card-jump')?.addEventListener('change', (e) => {
      fcState.currentIndex = parseInt(e.target.value) || 0;
      fcState.galoExpanded = false;
      saveFcStateToStorage();
      renderFcApp();
    });

    document.getElementById('fc-toggle-galo-inline')?.addEventListener('click', () => {
      fcState.galoExpanded = !fcState.galoExpanded;
      renderFcApp();
    });

    document.getElementById('fc-galo-expand-overlay')?.addEventListener('click', () => {
      fcState.galoExpanded = true;
      renderFcApp();
    });

    document.getElementById('fc-open-galo-modal')?.addEventListener('click', () => {
      openFullGaloModal(fcState.plazas[fcState.currentIndex]);
    });

    document.querySelectorAll('.fc-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = parseInt(btn.getAttribute('data-group'));
        rateCurrentCard(g);
      });
    });

    document.getElementById('fc-go-order-btn')?.addEventListener('click', () => {
      goToOrderingScreen(1);
    });
  }

  // Ordering screen events
  if (fcState.screen === 'ordering') {
    document.querySelectorAll('.fc-group-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = parseInt(btn.getAttribute('data-step-group'));
        goToOrderingScreen(g);
      });
    });

    document.getElementById('fc-sort-prot-desc')?.addEventListener('click', () => sortCurrentGroupBy('protocolos', 'desc'));
    document.getElementById('fc-sort-dist-asc')?.addEventListener('click', () => sortCurrentGroupBy('distancia', 'asc'));

    document.getElementById('fc-mala-prot-desc')?.addEventListener('click', () => sortCurrentGroupBy('protocolos', 'desc'));
    document.getElementById('fc-mala-dist-asc')?.addEventListener('click', () => sortCurrentGroupBy('distancia', 'asc'));
    document.getElementById('fc-mala-prot-asc')?.addEventListener('click', () => sortCurrentGroupBy('protocolos', 'asc'));

    document.querySelectorAll('[data-move-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-move-up'));
        moveItemInCurrentGroup(idx, -1);
      });
    });

    document.querySelectorAll('[data-move-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-move-down'));
        moveItemInCurrentGroup(idx, 1);
      });
    });

    document.getElementById('fc-order-prev-btn')?.addEventListener('click', () => {
      if (fcState.currentOrderGroup > 1) {
        goToOrderingScreen(fcState.currentOrderGroup - 1);
      } else {
        fcState.screen = 'flashcards';
        saveFcStateToStorage();
        renderFcApp();
      }
    });

    document.getElementById('fc-order-next-btn')?.addEventListener('click', () => {
      if (fcState.currentOrderGroup < 5) {
        goToOrderingScreen(fcState.currentOrderGroup + 1);
      } else {
        fcState.screen = 'final';
        saveFcStateToStorage();
        renderFcApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Initialize SortableJS on #fc-order-tbody
    const tbody = document.getElementById('fc-order-tbody');
    if (tbody && window.Sortable) {
      if (fcState.sortableInstance) {
        try { fcState.sortableInstance.destroy(); } catch (e) {}
      }
      fcState.sortableInstance = new Sortable(tbody, {
        handle: '.fc-drag-handle',
        animation: 150,
        ghostClass: 'fc-sortable-ghost',
        onEnd: function () {
          const rows = Array.from(tbody.querySelectorAll('.fc-sortable-row'));
          const newOrder = rows.map(r => r.getAttribute('data-id'));
          fcState.groupOrders[fcState.currentOrderGroup] = newOrder;
          saveFcStateToStorage();
          renderFcApp();
        }
      });
    }
  }

  // Final screen events
  if (fcState.screen === 'final') {
    document.getElementById('fc-download-final-csv')?.addEventListener('click', downloadFinalOrderedCSV);
    document.getElementById('fc-final-save-json')?.addEventListener('click', exportFcProgressJSON);
    document.getElementById('fc-final-back-order')?.addEventListener('click', () => {
      goToOrderingScreen(1);
    });
  }

  // Shared "Ver Informe Galo" buttons in ordering & final tables
  document.querySelectorAll('[data-view-galo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-view-galo');
      const plaza = fcState.plazas.find(p => p.fcId === id);
      if (plaza) openFullGaloModal(plaza);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initFlashcardsApp();
});
