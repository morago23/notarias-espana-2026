// ================= ASISTENTE DE ELECCIÓN: MODO EXCEL PROGRESIVO (1 A 1) + BOE ANEXO II/1 (BOE-A-2026-21686) =================

// Mapa literal de la columna "Notaría" del Anexo I del BOE-A-2026-21686 para las plazas cuyo nombre oficial en BOE varía respecto a DATA_GALO
const BOE_LITERAL_NOTARIA_MAP = {
  '2': 'València',
  '6': 'Coruña, A',
  '36': 'Realejos, Los',
  '42': 'Gandia',
  '48': 'Barco de Ávila, El',
  '57': 'Trevias',
  '74': 'Vellés, La',
  '78': 'Berdun',
  '80': 'Pontenova, A',
  '91': 'Font de la Figuera, la',
  '92': "Font d' en Carròs, la",
  '93': 'Cuervo de Sevilla, El',
  '95': 'Llucena/Lucena del Cid',
  '117': 'Castillo de las Guardas, El',
  '130': 'Pobla del Duc, La',
  '143': 'Barco de Valdeorras, O',
  '158': 'Cañiza, A',
  '171': 'Robla, La'
};

const fcState = {
  unlocked: false,
  screen: 'welcome', // 'welcome' | 'excel' | 'final'
  isFullscreenOverlay: true, // Se abre en pantalla completa
  userName: '',
  userSurnames: '',
  escalafon: '',
  lugarFirma: 'Madrid',
  diaFirma: new Date().getDate().toString(),
  mesFirma: 'octubre',
  postalCode: '',
  userCoords: null,
  locationName: '',
  plazas: [], // Array enriquecido de las 228 plazas de DATA_GALO
  orderedIds: [], // Array con los 228 fcId: los primeros `revealedCount` son los ya visibles y ordenados por el usuario
  revealedCount: 1, // Empieza mostrando solo 1 línea, y van apareciendo de 1 en 1
  lastRevealedId: null, // ID de la última notaría que acaba de aparecer para resaltarla
  excludedBoe: {}, // { [fcId]: boolean } si el usuario decide no pedirla en el Anexo II/1
  notes: {}, // { [fcId]: string } notas personales en la tabla
  expandedPeersRows: {}, // { [fcId]: boolean }
  searchQuery: '',
  filterComunidad: '',
  filterCategoria: '',
  filterTurno: '',
  boeMaxCount: 228,
  boeShowMotivoDisambig: false,
  boeCatSuffix: true,
  finalTab: 'boe', // 'boe' | 'excel'
  sortableInstance: null
};

function buildOfficialMotivoText(motivo, notarioAnterior) {
  const m = (motivo || '').trim();
  const ant = (notarioAnterior || '').trim();
  if (!ant || ant === '-') return m;
  if (m === 'Desierta') return `Desierta en concurso precedente (protocolo de ${ant})`;
  if (m === 'Jubilación') return `Jubilación de ${ant}`;
  if (m === 'Resulta' || m === 'Traslado') return `Traslado de ${ant}`;
  if (m === 'Excedencia') return `Excedencia de ${ant}`;
  return `${m} (${ant})`;
}

function initFlashcardsApp() {
  if (typeof DATA_GALO === 'undefined') return;

  const items = DATA_GALO.map((raw, idx) => {
    const numero = (raw['Número'] || '').toString().trim();
    const comunidad = (raw['Comunidad'] || '').trim();
    const provincia = (raw['Provincia'] || '').trim();
    const localidad = (raw['Localidad / Plaza'] || '').trim();
    const motivo = (raw['Motivo'] || '').trim();
    let categoria = (raw['Categoría'] || '').trim();
    const turno = (raw['Turno'] || '').trim();
    const notarioAnterior = (raw['Notario Anterior'] || '').trim() || '-';
    const colegio = (raw['Colegio'] || comunidad || '').trim();
    const distrito = (raw['Distrito'] || localidad || '').trim();
    const informeGalo = (raw['Informe Galo'] || '').trim();
    const origen = comunidad === 'Cataluña' ? 'DOGC' : 'BOE';

    const notariaSegunConvocatoria = (origen === 'BOE' && BOE_LITERAL_NOTARIA_MAP[numero])
      ? BOE_LITERAL_NOTARIA_MAP[numero]
      : localidad;

    const motivoSegunConvocatoria = buildOfficialMotivoText(motivo, notarioAnterior);

    // Datos de actividad 2025
    const rawProt = raw['Instrumentos públicos (escrituras, actas y protestos)'];
    const rawPolA = raw['Pólizas Sección A'];
    const rawPolB = raw['Pólizas Sección B'];
    const rawFoliosProt = raw['Folios de los instrumentos públicos'];
    const rawTotalGen = raw['Total general'];

    const protocolos2025 = rawProt !== '' && rawProt !== undefined && !isNaN(parseFloat(rawProt))
      ? Math.round(parseFloat(rawProt))
      : null;
    const polizasA2025 = rawPolA !== '' && rawPolA !== undefined && !isNaN(parseFloat(rawPolA))
      ? Math.round(parseFloat(rawPolA))
      : null;
    const polizasB2025 = rawPolB !== '' && rawPolB !== undefined && !isNaN(parseFloat(rawPolB))
      ? Math.round(parseFloat(rawPolB))
      : 0;
    const polizas2025 = polizasA2025 !== null ? (polizasA2025 + polizasB2025) : null;
    const foliosProt2025 = rawFoliosProt !== '' && rawFoliosProt !== undefined && !isNaN(parseFloat(rawFoliosProt))
      ? Math.round(parseFloat(rawFoliosProt))
      : null;
    const foliosPorProt = (protocolos2025 && protocolos2025 > 0 && foliosProt2025 !== null)
      ? (foliosProt2025 / protocolos2025).toFixed(1)
      : null;
    const totalGeneral2025 = rawTotalGen !== '' && rawTotalGen !== undefined && !isNaN(parseFloat(rawTotalGen))
      ? Math.round(parseFloat(rawTotalGen))
      : null;

    // Cruzar con DATA_NOTARIAS para obtener número de notarías en la localidad y categoría
    const nMatch = findNotariaMatchForGalo(localidad, provincia);
    const numNotarias = nMatch ? (parseInt(nMatch.numero) || 1) : 1;
    if (!categoria || categoria === '-') {
      categoria = nMatch ? nMatch.clase : '-';
    }

    const coords = getCoordsForGalo(localidad, provincia);

    // Resto de notarías de la misma localidad
    const { restoNotarias, mediaProtResto, mediaPolResto } = numNotarias > 1
      ? getRestoNotariasForGalo(localidad, provincia, notarioAnterior, raw['Notario'])
      : { restoNotarias: [], mediaProtResto: null, mediaPolResto: null };

    const fcId = `fc_${idx}_${normalize(localidad)}_${normalize(provincia)}`;

    return {
      fcId,
      originalIndex: idx,
      numero,
      origen,
      notariaSegunConvocatoria,
      motivoSegunConvocatoria,
      turno,
      comunidad,
      provincia,
      localidad,
      distrito,
      colegio,
      motivo,
      categoria,
      notarioAnterior,
      numNotarias,
      protocolos2025,
      polizasA2025,
      polizasB2025,
      polizas2025,
      foliosProt2025,
      foliosPorProt,
      totalGeneral2025,
      restoNotarias,
      mediaProtResto,
      mediaPolResto,
      informeGalo,
      coords,
      distancia: null,
      duration: null,
      raw
    };
  });

  // Orden inicial por defecto: Comunidad -> Provincia -> Localidad -> Notario Anterior
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
  fcState.orderedIds = items.map(p => p.fcId);
  fcState.revealedCount = 1;
  fcState.lastRevealedId = fcState.orderedIds[0] || null;
  fcState.boeMaxCount = items.length;

  // Cargar progreso guardado en localStorage
  loadFcStateFromStorage();

  // Calcular distancias si ya tenemos coordenadas
  if (fcState.userCoords) {
    calculateFcDistancesFromCoords(fcState.userCoords);
  } else if (typeof state !== 'undefined' && state && state.userCoords) {
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

  // Modal de Informe Galo
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

  // Cuando el usuario hace clic en la pestaña "Asistente Excel + BOE 📊", activar pantalla completa automáticamente
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-target') === 'tab-flashcards') {
        fcState.isFullscreenOverlay = true;
        renderFcApp();
      } else {
        document.body.classList.remove('fc-fullscreen-active');
      }
    });
  });

  renderFcApp();
}

function findNotariaMatchForGalo(localidad, provincia) {
  const locClean = (localidad || '').replace(/\s*\([^)]*\)/g, '').trim();
  const baseLoc = locClean.replace(/^Madrid-.*$/i, 'Madrid').replace(/^Zaragoza-.*$/i, 'Zaragoza');
  let nMatch = DATA_NOTARIAS.find(n => normalize(n.localidad) === normalize(baseLoc) && normalize(n.provincia) === normalize(provincia));
  if (!nMatch) {
    const provV = normalize(provincia);
    const locV = normalize(baseLoc).replace(/'/g, '').replace(/’/g, '').replace(/, el$/, '').replace(/, la$/, '').replace(/^el /, '').replace(/^la /, '').replace(/, l$/, '').replace(/^l /, '');
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

function isSameNotaryName(n1, n2) {
  const a = normalize(n1 || '');
  const b = normalize(n2 || '');
  if (!a || !b || a === '-') return false;
  if (a === b) return true;
  const ta = a.split(/[\s-]+/).filter(t => t.length > 2);
  const tb = b.split(/[\s-]+/).filter(t => t.length > 2);
  if (!ta.length || !tb.length) return false;
  const common = ta.filter(t => tb.includes(t)).length;
  return common >= Math.min(ta.length, tb.length) && common >= 2;
}

function getRestoNotariasForGalo(localidad, provincia, notarioAnterior, rawNotario) {
  if (typeof DATA_LOCALIDAD_PEERS_2025 === 'undefined') {
    return { restoNotarias: [], mediaProtResto: null, mediaPolResto: null };
  }
  const locClean = (localidad || '').replace(/\s*\([^)]*\)/g, '').trim();
  const baseLoc = locClean.replace(/^Madrid-.*$/i, 'Madrid').replace(/^Zaragoza-.*$/i, 'Zaragoza');
  const key = `${normalize(provincia)}|${normalize(baseLoc)}`;
  const allInLoc = DATA_LOCALIDAD_PEERS_2025[key] || [];
  if (!allInLoc.length) {
    return { restoNotarias: [], mediaProtResto: null, mediaPolResto: null };
  }

  const resto = allInLoc.filter(item =>
    !isSameNotaryName(item.notario, notarioAnterior) &&
    !isSameNotaryName(item.notario, rawNotario)
  );

  if (!resto.length) {
    return { restoNotarias: [], mediaProtResto: null, mediaPolResto: null };
  }

  const sumProt = resto.reduce((acc, r) => acc + (r.protocolos || 0), 0);
  const sumPol = resto.reduce((acc, r) => acc + (r.polizas || 0), 0);

  return {
    restoNotarias: resto,
    mediaProtResto: Math.round(sumProt / resto.length),
    mediaPolResto: Math.round(sumPol / resto.length)
  };
}

// ================= PERSISTENCIA E IMPORTACIÓN / EXPORTACIÓN =================

function ensureCompleteOrderedIds(candidateIds) {
  const allValidIds = fcState.plazas.map(p => p.fcId);
  const validSet = new Set(allValidIds);
  const result = [];
  const seen = new Set();

  (candidateIds || []).forEach(id => {
    if (validSet.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  });

  allValidIds.forEach(id => {
    if (!seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  });

  return result;
}

function saveFcStateToStorage() {
  try {
    const payload = {
      version: 3,
      screen: fcState.screen,
      userName: fcState.userName,
      userSurnames: fcState.userSurnames,
      escalafon: fcState.escalafon,
      lugarFirma: fcState.lugarFirma,
      diaFirma: fcState.diaFirma,
      mesFirma: fcState.mesFirma,
      postalCode: fcState.postalCode,
      userCoords: fcState.userCoords,
      locationName: fcState.locationName,
      orderedIds: fcState.orderedIds,
      revealedCount: fcState.revealedCount,
      lastRevealedId: fcState.lastRevealedId,
      excludedBoe: fcState.excludedBoe,
      notes: fcState.notes,
      boeMaxCount: fcState.boeMaxCount,
      boeShowMotivoDisambig: fcState.boeShowMotivoDisambig,
      boeCatSuffix: fcState.boeCatSuffix,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('fcProgressState', JSON.stringify(payload));
  } catch (e) {
    console.error('Error guardando estado:', e);
  }
}

function loadFcStateFromStorage() {
  try {
    const raw = localStorage.getItem('fcProgressState');
    if (!raw) return;
    const data = JSON.parse(raw);
    applyImportedFcData(data, false);
  } catch (e) {
    console.error('Error cargando estado:', e);
  }
}

function remapFcIdIfNeeded(oldId, usedTargets) {
  if (fcState.plazas.some(p => p.fcId === oldId)) return oldId;
  const suffix = String(oldId).replace(/^fc_\d+_/, '');
  const candidate = fcState.plazas.find(p =>
    !usedTargets.has(p.fcId) &&
    `${normalize(p.localidad)}_${normalize(p.provincia)}` === suffix
  );
  if (candidate) {
    usedTargets.add(candidate.fcId);
    return candidate.fcId;
  }
  return null;
}

function applyImportedFcData(data, showNotification = true) {
  if (!data || typeof data !== 'object') return false;

  fcState.userName = data.userName || '';
  fcState.userSurnames = data.userSurnames || '';
  fcState.escalafon = data.escalafon || '';
  if (data.lugarFirma !== undefined) fcState.lugarFirma = data.lugarFirma;
  if (data.diaFirma !== undefined) fcState.diaFirma = data.diaFirma;
  if (data.mesFirma !== undefined) fcState.mesFirma = data.mesFirma;
  fcState.postalCode = data.postalCode || '';
  fcState.userCoords = data.userCoords || null;
  fcState.locationName = data.locationName || '';

  const usedTargets = new Set();

  if (Array.isArray(data.orderedIds) && data.orderedIds.length > 0) {
    const mapped = data.orderedIds
      .map(oldId => remapFcIdIfNeeded(oldId, usedTargets))
      .filter(Boolean);
    fcState.orderedIds = ensureCompleteOrderedIds(mapped);
  } else if (data.groupOrders && typeof data.groupOrders === 'object') {
    const combined = [];
    for (let g = 1; g <= 5; g++) {
      (data.groupOrders[g] || []).forEach(oldId => {
        const newId = remapFcIdIfNeeded(oldId, usedTargets);
        if (newId && !combined.includes(newId)) combined.push(newId);
      });
    }
    fcState.orderedIds = ensureCompleteOrderedIds(combined);
  } else {
    fcState.orderedIds = ensureCompleteOrderedIds([]);
  }

  if (typeof data.revealedCount === 'number' && data.revealedCount >= 1) {
    fcState.revealedCount = Math.min(fcState.plazas.length, Math.max(1, data.revealedCount));
  } else {
    fcState.revealedCount = 1;
  }

  fcState.lastRevealedId = data.lastRevealedId || fcState.orderedIds[fcState.revealedCount - 1] || null;

  if (data.excludedBoe && typeof data.excludedBoe === 'object') {
    fcState.excludedBoe = data.excludedBoe;
  }
  if (data.notes && typeof data.notes === 'object') {
    fcState.notes = data.notes;
  }
  if (typeof data.boeMaxCount === 'number') {
    fcState.boeMaxCount = data.boeMaxCount;
  }
  if (typeof data.boeShowMotivoDisambig === 'boolean') {
    fcState.boeShowMotivoDisambig = data.boeShowMotivoDisambig;
  }
  if (typeof data.boeCatSuffix === 'boolean') {
    fcState.boeCatSuffix = data.boeCatSuffix;
  }

  if (data.screen === 'flashcards' || data.screen === 'ordering' || data.screen === 'excel') {
    fcState.screen = 'excel';
  } else if (data.screen === 'final') {
    fcState.screen = 'final';
  } else {
    fcState.screen = 'welcome';
  }

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

// ================= CÁLCULO DE DISTANCIAS =================

async function geocodeAndCalculateFcDistances(queryStr) {
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
    console.error('Error calculando distancias:', err);
    if (statusEl) {
      statusEl.textContent = '⚠️ Error al conectar con el servidor de rutas. Se usará distancia en línea recta si está disponible.';
      statusEl.style.color = '#f59e0b';
    }
    return false;
  }
}

async function calculateFcDistancesFromCoords(userCoords) {
  if (!userCoords) return;

  fcState.plazas.forEach(p => {
    if (p.coords) {
      const havDist = haversine(userCoords.lat, userCoords.lon, p.coords.lat, p.coords.lon);
      if (p.distancia === null) p.distancia = havDist;
    }
  });

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
    } catch (e) {}
    if (i + batchSize < validItems.length) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  if (fcState.screen === 'excel' || fcState.screen === 'final') {
    renderFcApp();
  }
}

// ================= APARICIÓN PROGRESIVA (1 A 1) Y MOVIMIENTO DE FILAS =================

function revealNextPlaza() {
  if (fcState.revealedCount < fcState.plazas.length) {
    fcState.revealedCount++;
    fcState.lastRevealedId = fcState.orderedIds[fcState.revealedCount - 1] || null;
    saveFcStateToStorage();
    renderFcApp();

    // Hacer scroll suave hacia la nueva fila que acaba de aparecer
    setTimeout(() => {
      if (fcState.lastRevealedId) {
        const rowEl = document.querySelector(`tr[data-id="${CSS.escape(fcState.lastRevealedId)}"]`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 60);
  }
}

function movePlazaWithinRevealed(fcId, newOneBasedRank) {
  const currentIdx = fcState.orderedIds.indexOf(fcId);
  if (currentIdx === -1 || currentIdx >= fcState.revealedCount) return;

  // Solo se mueve dentro de las filas ya aparecidas (1 .. revealedCount)
  const maxAllowed = fcState.revealedCount;
  const targetIdx = Math.max(0, Math.min(maxAllowed - 1, (parseInt(newOneBasedRank, 10) || 1) - 1));
  if (currentIdx === targetIdx) return;

  const revealedPart = fcState.orderedIds.slice(0, fcState.revealedCount);
  const unrevealedPart = fcState.orderedIds.slice(fcState.revealedCount);

  const [moved] = revealedPart.splice(currentIdx, 1);
  revealedPart.splice(targetIdx, 0, moved);

  fcState.orderedIds = [...revealedPart, ...unrevealedPart];
  saveFcStateToStorage();
  renderFcApp();
}

function openFullGaloModal(plaza) {
  const modal = document.getElementById('galo-modal');
  if (!modal || !plaza) return;
  document.getElementById('galo-modal-title').textContent = `📋 Informe Galo: ${plaza.localidad}`;
  document.getElementById('galo-modal-subtitle').textContent = `${plaza.provincia} (${plaza.comunidad}) — Notario ant.: ${plaza.notarioAnterior}`;
  const contentEl = document.getElementById('galo-modal-content');
  contentEl.innerHTML = formatInformeGaloHtml(plaza.informeGalo) + renderPeersSectionHtml(plaza, true);
  modal.style.display = 'flex';
}

function renderPeersSectionHtml(plaza, inModal = false) {
  if (!plaza || plaza.numNotarias <= 1 || !plaza.restoNotarias || plaza.restoNotarias.length === 0) {
    return '';
  }

  const avgProtStr = plaza.mediaProtResto !== null ? plaza.mediaProtResto.toLocaleString('es-ES') : '-';
  const avgPolStr = plaza.mediaPolResto !== null ? plaza.mediaPolResto.toLocaleString('es-ES') : '-';

  return `
    <div class="fc-peers-box ${inModal ? 'fc-peers-in-modal' : ''}">
      <div class="fc-peers-header">
        <div class="fc-peers-title">
          <span>🏛️ Resto de notarías en ${escapeHTML(plaza.localidad)} (${plaza.restoNotarias.length})</span>
        </div>
        <div class="fc-peers-avg">
          <span>Media resto: 📜 <strong>${avgProtStr}</strong> prot. · 📑 <strong>${avgPolStr}</strong> pól.</span>
        </div>
      </div>
      <div class="fc-peers-list">
        ${plaza.restoNotarias.map(r => {
          const pStr = (r.protocolos || 0).toLocaleString('es-ES');
          const zStr = (r.polizas || 0).toLocaleString('es-ES');
          const subLoc = r.notaria ? ` <span class="fc-peer-subloc">(${escapeHTML(r.notaria)})</span>` : '';
          return `
            <div class="fc-peer-item">
              <div class="fc-peer-name">${escapeHTML(r.notario)}${subLoc}</div>
              <div class="fc-peer-stats">
                <span class="fc-peer-stat-prot" title="Protocolos 2025">📜 <strong>${pStr}</strong> prot.</span>
                <span class="fc-peer-stat-pol" title="Pólizas 2025">📑 <strong>${zStr}</strong> pól.</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
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

// ================= EXPORTACIÓN: EXCEL COMPLETO, CSV, JSON Y BOE ANEXO II/1 =================

function getRevealedOrderedPlazasArray() {
  const mapPlaza = {};
  fcState.plazas.forEach(p => { mapPlaza[p.fcId] = p; });
  const complete = ensureCompleteOrderedIds(fcState.orderedIds);
  return complete.slice(0, fcState.revealedCount).map(id => mapPlaza[id]).filter(Boolean);
}

function getAllOrderedPlazasArray() {
  const mapPlaza = {};
  fcState.plazas.forEach(p => { mapPlaza[p.fcId] = p; });
  return ensureCompleteOrderedIds(fcState.orderedIds).map(id => mapPlaza[id]).filter(Boolean);
}

function getBoeFilteredPlazasArray() {
  // Por defecto exporta las notarías colocadas/visibles (o hasta boeMaxCount)
  const all = getAllOrderedPlazasArray();
  const limit = Math.max(1, Math.min(all.length, parseInt(fcState.boeMaxCount, 10) || fcState.revealedCount));
  return all.slice(0, limit).filter(p => !fcState.excludedBoe[p.fcId]);
}

function formatBoeOrdenConvocatoria(p) {
  if (p.origen === 'DOGC' && fcState.boeCatSuffix) {
    return `${p.numero} (Cataluña)`;
  }
  return String(p.numero);
}

function formatBoeNotariaSolicitada(p) {
  const base = p.notariaSegunConvocatoria || p.localidad;
  if (fcState.boeShowMotivoDisambig && p.notarioAnterior && p.notarioAnterior !== '-') {
    return `${base} (${p.motivoSegunConvocatoria})`;
  }
  return base;
}

function exportFcProgressJSON() {
  const payload = {
    version: 3,
    app: 'NotariasExcelBOE',
    screen: fcState.screen,
    userName: fcState.userName,
    userSurnames: fcState.userSurnames,
    escalafon: fcState.escalafon,
    lugarFirma: fcState.lugarFirma,
    diaFirma: fcState.diaFirma,
    mesFirma: fcState.mesFirma,
    postalCode: fcState.postalCode,
    userCoords: fcState.userCoords,
    locationName: fcState.locationName,
    orderedIds: fcState.orderedIds,
    revealedCount: fcState.revealedCount,
    lastRevealedId: fcState.lastRevealedId,
    excludedBoe: fcState.excludedBoe,
    notes: fcState.notes,
    boeMaxCount: fcState.boeMaxCount,
    boeShowMotivoDisambig: fcState.boeShowMotivoDisambig,
    boeCatSuffix: fcState.boeCatSuffix,
    savedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (fcState.userName || 'notario').replace(/[^a-z0-9_-]/gi, '_');
  a.href = url;
  a.download = `progreso_eleccion_notarias_${safeName}_${fcState.revealedCount}de${fcState.plazas.length}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 1) Descargar Lista en Excel (.xlsx)
function downloadFullExcelXLSX() {
  const ordered = getAllOrderedPlazasArray();
  const baseHeaders = typeof DATA_GALO_HEADERS !== 'undefined' ? DATA_GALO_HEADERS : Object.keys(fcState.plazas[0]?.raw || {});

  const rowsData = ordered.map((p, idx) => {
    const obj = {
      'Orden de Preferencia': idx + 1,
      'Estado en Tabla': idx < fcState.revealedCount ? 'Colocada' : 'Pendiente',
      'Orden Convocatoria (BOE/DOGC)': formatBoeOrdenConvocatoria(p),
      'Convocatoria': p.origen,
      'Notaría Solicitada (según BOE)': p.notariaSegunConvocatoria,
      'Turno': p.turno,
      'Categoría': p.categoria,
      'Comunidad': p.comunidad,
      'Provincia': p.provincia,
      'Localidad': p.localidad,
      'Distrito': p.distrito,
      'Colegio Notarial': p.colegio,
      'Motivo Vacante': p.motivo,
      'Notario Anterior': p.notarioAnterior,
      'Protocolos 2025': p.protocolos2025 !== null ? p.protocolos2025 : '',
      'Pólizas 2025': p.polizas2025 !== null ? p.polizas2025 : '',
      'Folios Instrumentos 2025': p.foliosProt2025 !== null ? p.foliosProt2025 : '',
      'Media Folios / Protocolo': p.foliosPorProt !== null ? Number(p.foliosPorProt) : '',
      'Total General 2025': p.totalGeneral2025 !== null ? p.totalGeneral2025 : '',
      'Informe Galo': p.informeGalo || '',
      'Notas Personales': fcState.notes[p.fcId] || '',
      'Núm. Notarios Localidad': p.numNotarias,
      'Media Protocolos Resto Localidad': p.mediaProtResto !== null ? p.mediaProtResto : '',
      'Media Pólizas Resto Localidad': p.mediaPolResto !== null ? p.mediaPolResto : '',
      'Distancia C.P. (km)': p.distancia !== null ? Number(p.distancia.toFixed(1)) : '',
      'Tiempo en Coche': p.duration ? formatDuration(p.duration) : ''
    };

    baseHeaders.forEach(h => {
      if (!(h in obj)) {
        obj[h] = p.raw[h] !== undefined && p.raw[h] !== null ? p.raw[h] : '';
      }
    });

    return obj;
  });

  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsData);
    ws['!cols'] = [
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 28 },
      { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 26 },
      { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 28 }, { wch: 15 },
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 65 },
      { wch: 35 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Listado Eleccion');
    const safeName = (fcState.userName || 'notarias').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(wb, `Listado_Eleccion_Notarias_${safeName}.xlsx`);
  }
}

// 2) Descargar Excel con el formato exacto del ANEXO II/1 del BOE (BOE-A-2026-21686)
function downloadBoeAnexoExcelXLSX() {
  const boeList = getBoeFilteredPlazasArray();

  const aoa = [
    ['ANEXO II/1'],
    [],
    ['N.º ESCALAFÓN:', fcState.escalafon || '', 'APELLIDOS:', fcState.userSurnames || ''],
    ['NOMBRE:', fcState.userName || '', '', ''],
    [],
    [
      'ORDEN DE PREFERENCIA',
      'ORDEN CONVOCATORIA',
      'NOTARÍA QUE SE SOLICITA (según convocatoria)',
      'TURNO'
    ]
  ];

  boeList.forEach((p, idx) => {
    aoa.push([
      idx + 1,
      formatBoeOrdenConvocatoria(p),
      formatBoeNotariaSolicitada(p),
      p.turno
    ]);
  });

  aoa.push([]);
  aoa.push(['En caso necesario deberán utilizarse cuantas hojas sean precisas']);
  aoa.push([`${fcState.lugarFirma || '..........'} a ${fcState.diaFirma || '....'} de ${fcState.mesFirma || '..........'} de 2026`]);
  aoa.push(['(lugar, fecha y firma)']);

  if (typeof XLSX !== 'undefined') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 24 },
      { wch: 48 },
      { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'ANEXO II-1 BOE');
    const safeName = (fcState.userSurnames || fcState.userName || 'BOE').replace(/[^a-z0-9_-]/gi, '_');
    XLSX.writeFile(wb, `BOE_Anexo_II_1_Solicitud_${safeName}.xlsx`);
  }
}

function printBoeAnexoII1() {
  document.body.classList.add('printing-boe-anexo');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-boe-anexo');
  }, 500);
}

function copyBoeTableToClipboard() {
  const boeList = getBoeFilteredPlazasArray();
  const lines = [
    `ANEXO II/1`,
    `N.º ESCALAFÓN: ${fcState.escalafon || '-'}\tAPELLIDOS: ${fcState.userSurnames || '-'}\tNOMBRE: ${fcState.userName || '-'}`,
    `ORDEN DE PREFERENCIA\tORDEN CONVOCATORIA\tNOTARÍA QUE SE SOLICITA (según convocatoria)\tTURNO`
  ];
  boeList.forEach((p, idx) => {
    lines.push(`${idx + 1}\t${formatBoeOrdenConvocatoria(p)}\t${formatBoeNotariaSolicitada(p)}\t${p.turno}`);
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('fc-btn-copy-boe');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ ¡Copiado al portapapeles!';
      setTimeout(() => { btn.textContent = orig; }, 2200);
    }
  });
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    try {
      if (file.name.endsWith('.json') || (typeof content === 'string' && content.trim().startsWith('{'))) {
        const data = JSON.parse(content);
        if (data && (data.orderedIds || data.ratings || data.groupOrders)) {
          applyImportedFcData(data, true);
          if (fcState.screen === 'welcome') {
            fcState.screen = 'excel';
            saveFcStateToStorage();
            renderFcApp();
          }
          alert(`✅ Progreso importado correctamente (${fcState.revealedCount}/${fcState.plazas.length} notarías en tabla).`);
          return;
        }
      }

      const importedFromCsv = parseImportedCsvOrExcel(content, file.name.endsWith('.xlsx'));
      if (importedFromCsv) {
        alert(`✅ Orden de plazas importado correctamente.`);
        renderFcApp();
      } else {
        alert('⚠️ El archivo seleccionado no tiene un formato válido de progreso (.json) o listado (.csv / .xlsx).');
      }
    } catch (err) {
      console.error('Error importando archivo:', err);
      alert('⚠️ Error al leer el archivo.');
    }
  };
  if (file.name.endsWith('.xlsx')) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file, 'UTF-8');
  }
}

function parseImportedCsvOrExcel(content, isBinary = false) {
  try {
    if (typeof XLSX === 'undefined') return false;
    const wb = isBinary
      ? XLSX.read(content, { type: 'array' })
      : XLSX.read(content, { type: 'string' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    if (!rows || rows.length === 0) return false;

    const importedOrder = [];
    const newNotes = { ...fcState.notes };
    let colocadasCount = 0;

    rows.forEach(r => {
      const loc = (r['Localidad / Plaza'] || r['Localidad'] || r['NOTARÍA QUE SE SOLICITA (según convocatoria)'] || r['Notaría Solicitada (según BOE)'] || '').toString().trim();
      const prov = (r['Provincia'] || '').toString().trim();
      const ant = (r['Notario Anterior'] || '').toString().trim();
      const numConv = (r['Orden Convocatoria'] || r['Orden Convocatoria (BOE/DOGC)'] || r['ORDEN CONVOCATORIA'] || r['Número'] || '').toString().replace(/\(.*\)/, '').trim();

      let match = null;
      if (ant && loc) {
        match = fcState.plazas.find(p =>
          (normalize(p.localidad) === normalize(loc) || normalize(p.notariaSegunConvocatoria) === normalize(loc)) &&
          normalize(p.notarioAnterior) === normalize(ant)
        );
      }
      if (!match && numConv && loc) {
        match = fcState.plazas.find(p =>
          String(p.numero) === numConv &&
          (normalize(p.localidad) === normalize(loc) || normalize(p.notariaSegunConvocatoria) === normalize(loc))
        );
      }
      if (!match && loc && prov) {
        match = fcState.plazas.find(p =>
          normalize(p.localidad) === normalize(loc) &&
          normalize(p.provincia) === normalize(prov) &&
          !importedOrder.includes(p.fcId)
        );
      }
      if (!match && loc) {
        match = fcState.plazas.find(p =>
          (normalize(p.localidad) === normalize(loc) || normalize(p.notariaSegunConvocatoria) === normalize(loc)) &&
          !importedOrder.includes(p.fcId)
        );
      }

      if (match && !importedOrder.includes(match.fcId)) {
        importedOrder.push(match.fcId);
        if (r['Estado en Tabla'] === 'Colocada') colocadasCount++;
        if (r['Notas Personales']) {
          newNotes[match.fcId] = String(r['Notas Personales']);
        }
      }
    });

    if (importedOrder.length === 0) return false;

    fcState.orderedIds = ensureCompleteOrderedIds(importedOrder);
    fcState.revealedCount = colocadasCount > 0 ? colocadasCount : importedOrder.length;
    fcState.notes = newNotes;
    fcState.screen = 'excel';
    saveFcStateToStorage();
    return true;
  } catch (e) {
    return false;
  }
}

// ================= RENDERIZADO DE LA APLICACIÓN (PANTALLA COMPLETA) =================

function renderFcApp(options = {}) {
  const container = document.getElementById('fc-app-container');
  if (!container) return;

  const prevScrollArea = container.querySelector('.fc-main-scroll-area');
  const prevScrollTop = prevScrollArea ? prevScrollArea.scrollTop : 0;
  const prevSpreadScroll = document.getElementById('fc-spreadsheet-scroll');
  const prevSpreadLeft = prevSpreadScroll ? prevSpreadScroll.scrollLeft : 0;
  const prevWindowScrollY = window.scrollY;

  const tabEl = document.getElementById('tab-flashcards');
  const isTabActive = tabEl && tabEl.classList.contains('active');

  if (isTabActive && fcState.isFullscreenOverlay) {
    container.classList.add('fc-fullscreen-modal');
    document.body.classList.add('fc-fullscreen-active');
  } else {
    container.classList.remove('fc-fullscreen-modal');
    document.body.classList.remove('fc-fullscreen-active');
  }

  if (!fcState.unlocked && sessionStorage.getItem('fcUnlocked') !== 'true') {
    container.innerHTML = renderPasswordScreen();
    attachPasswordEvents();
    return;
  }
  fcState.unlocked = true;

  const totalCount = fcState.plazas.length;
  const revCount = fcState.revealedCount;

  const topBarHtml = `
    <div class="fc-topbar no-print-boe">
      <div class="fc-topbar-left">
        <div class="fc-steps-nav">
          <button class="fc-step-pill ${fcState.screen === 'welcome' ? 'active' : ''}" id="fc-nav-welcome">
            1. Datos e Inicio ${fcState.postalCode ? `(${escapeHTML(fcState.postalCode)})` : ''}
          </button>
          <button class="fc-step-pill ${fcState.screen === 'excel' ? 'active' : ''}" id="fc-nav-excel">
            2. Tabla Progresiva (${revCount} / ${totalCount} notarías)
          </button>
          <button class="fc-step-pill ${fcState.screen === 'final' ? 'active' : ''}" id="fc-nav-final">
            3. Finalizar: Excel y BOE Anexo II/1
          </button>
        </div>
      </div>
      <div class="fc-topbar-right">
        <button class="action-btn-secondary fc-btn-sm" id="fc-btn-save-progress" title="Guardar progreso en archivo .json">
          💾 Guardar (.json)
        </button>
        <label class="action-btn-secondary fc-btn-sm" style="cursor:pointer; margin:0;" title="Importar archivo .json, .csv o .xlsx">
          📂 Importar
          <input type="file" id="fc-input-import-top" accept=".json,.csv,.xlsx" style="display:none;">
        </label>
        <button class="action-btn-secondary fc-btn-sm" id="fc-btn-browser-fs" title="Activar/desactivar pantalla completa del navegador (F11)">
          ⛶ Pantalla Completa
        </button>
        <button class="action-btn-secondary fc-btn-sm" id="fc-btn-exit-fs" style="color:#ef4444; border-color:rgba(239,68,68,0.35);" title="Salir al menú general de la web">
          ✖ Salir al menú web
        </button>
      </div>
    </div>
  `;

  let bodyHtml = '';
  if (fcState.screen === 'welcome') {
    bodyHtml = renderWelcomeScreen(revCount, totalCount);
  } else if (fcState.screen === 'excel') {
    bodyHtml = renderExcelScreen(revCount, totalCount);
  } else if (fcState.screen === 'final') {
    bodyHtml = renderFinalScreen();
  }

  container.innerHTML = topBarHtml + `<div class="fc-main-scroll-area">${bodyHtml}</div>`;
  attachFcEvents();

  if (!options.resetScroll) {
    const newScrollArea = container.querySelector('.fc-main-scroll-area');
    if (newScrollArea) {
      newScrollArea.scrollTop = prevScrollTop;
    }
    const newSpreadScroll = document.getElementById('fc-spreadsheet-scroll');
    if (newSpreadScroll) {
      newSpreadScroll.scrollLeft = prevSpreadLeft;
    }
    if (!fcState.isFullscreenOverlay) {
      window.scrollTo(0, prevWindowScrollY);
    }
  }
}

function renderPasswordScreen() {
  return `
    <div class="fc-welcome-wrapper" style="padding-top: 60px;">
      <div class="fc-welcome-card" style="max-width: 440px; text-align: center;">
        <div class="fc-welcome-badge">🔒 Acceso Restringido</div>
        <h2 class="fc-welcome-title">Asistente Excel + BOE</h2>
        <p class="fc-welcome-desc" style="margin-bottom: 20px;">
          Introduce la contraseña para acceder a la tabla progresiva con el Informe Galo y el generador del Anexo II/1 del BOE.
        </p>
        <form id="fc-password-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="password" id="fc-password-input" class="search-input" style="min-width: unset; text-align: center; font-size: 16px;" placeholder="Contraseña..." autocomplete="current-password" required>
          <div id="fc-password-error" style="display: none; color: #ef4444; font-size: 13px; font-weight: 600;">
            ❌ Contraseña incorrecta. Inténtalo de nuevo.
          </div>
          <button type="submit" class="action-btn fc-btn-lg" style="width: 100%;">
            🔓 Entrar en Pantalla Completa
          </button>
          <button type="button" id="fc-pwd-exit-btn" class="action-btn-secondary" style="width: 100%;">
            Volver a la web
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
  document.getElementById('fc-pwd-exit-btn')?.addEventListener('click', exitFullscreenToWeb);
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

function exitFullscreenToWeb() {
  fcState.isFullscreenOverlay = false;
  document.body.classList.remove('fc-fullscreen-active');
  if (document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (e) {}
  }
  const vacTabBtn = document.querySelector('.tab-btn[data-target="tab-vacantes"]');
  if (vacTabBtn) {
    vacTabBtn.click();
  } else {
    renderFcApp();
  }
}

// ================= PANTALLA 1: DATOS E INICIO =================

function renderWelcomeScreen(revCount, totalCount) {
  return `
    <div class="fc-welcome-wrapper">
      <div class="fc-welcome-card" style="max-width: 760px;">
        <div class="fc-welcome-badge">📊 Tabla Progresiva 1 a 1 + Modelo Oficial BOE-A-2026-21686</div>
        <h2 class="fc-welcome-title">Ordena tus Notarías Vacantes de 1 en 1</h2>
        <p class="fc-welcome-desc">
          Empiezas con <strong>una sola línea</strong> en la tabla. A medida que vas leyendo y colocándola en su posición, pulsas <strong>"➕ Siguiente notaría"</strong> y aparece la 2.ª, luego la 3.ª, y así sucesivamente hasta las ${totalCount}. Al terminar, obtendrás tu <strong>Excel</strong> y el <strong>Anexo II/1 oficial del BOE</strong>.
        </p>

        <div class="fc-form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div class="fc-form-group">
            <label for="fc-user-name">👤 Nombre (para Anexo II/1 BOE)</label>
            <input type="text" id="fc-user-name" class="search-input" style="min-width:unset;" placeholder="Ej: Miguel" value="${escapeHTML(fcState.userName)}">
          </div>
          <div class="fc-form-group">
            <label for="fc-user-surnames">👤 Apellidos (para Anexo II/1 BOE)</label>
            <input type="text" id="fc-user-surnames" class="search-input" style="min-width:unset;" placeholder="Ej: García López" value="${escapeHTML(fcState.userSurnames)}">
          </div>
          <div class="fc-form-group">
            <label for="fc-user-escalafon">🔢 N.º Escalafón (para Anexo II/1 BOE)</label>
            <input type="text" id="fc-user-escalafon" class="search-input" style="min-width:unset;" placeholder="Ej: 1450" value="${escapeHTML(fcState.escalafon)}">
          </div>
          <div class="fc-form-group">
            <label for="fc-postal-code">📍 Tu Código Postal o Ciudad (para distancias)</label>
            <input type="text" id="fc-postal-code" class="search-input" style="min-width:unset;" placeholder="Ej: 28001 o Madrid" value="${escapeHTML(fcState.postalCode)}">
          </div>
        </div>

        <div id="fc-dist-status" class="fc-dist-status" style="margin-top: 8px;">
          ${fcState.locationName ? `✅ Ubicación configurada: ${escapeHTML(fcState.locationName)}` : ''}
        </div>

        <div class="fc-welcome-actions">
          <button id="fc-start-btn" class="action-btn fc-btn-lg">
            ${revCount > 1 ? `▶️ Continuar por la notaría ${revCount} de ${totalCount}` : `🚀 Empezar con la 1.ª Notaría`}
          </button>
          <button id="fc-reset-order-btn" class="action-btn-secondary fc-btn-lg" style="color:#ef4444; border-color:rgba(239,68,68,0.4);">
            🔄 Reiniciar a 1 sola línea desde cero
          </button>
        </div>

        <div class="fc-import-box">
          <div class="fc-import-box-header">
            <strong>📂 ¿Tienes un progreso o listado guardado anteriormente?</strong>
            <p>Puedes importar tu archivo de progreso (<code>.json</code>) o un listado en Excel/CSV (<code>.xlsx</code> / <code>.csv</code>) para retomar exactamente por donde ibas.</p>
          </div>
          <div class="fc-import-box-actions">
            <label class="action-btn-secondary" style="cursor:pointer;">
              ⬆️ Importar archivo (.json / .xlsx / .csv)
              <input type="file" id="fc-welcome-import-input" accept=".json,.csv,.xlsx" style="display:none;">
            </label>
            <button id="fc-welcome-export-btn" class="action-btn-secondary">
              💾 Descargar copia de seguridad (.json)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ================= PANTALLA 2: TABLA EXCEL PROGRESIVA (1 EN 1) =================

function renderExcelScreen(revCount, totalCount) {
  const revealedPlazas = getRevealedOrderedPlazasArray();
  const pct = Math.round((revCount / totalCount) * 100);
  const canRevealMore = revCount < totalCount;

  return `
    <div class="fc-excel-wrapper">
      <!-- Barra superior de control progresivo -->
      <div class="fc-excel-toolbar">
        <div class="fc-excel-toolbar-top">
          <div class="fc-progressive-status">
            <div class="fc-progressive-title-row">
              <h2 class="fc-excel-title">
                📊 Notarías en tu tabla: <strong style="color:var(--color-accent);">${revCount}</strong> de <strong>${totalCount}</strong> (${pct}%)
              </h2>
              <div class="fc-progressive-bar-mini">
                <div class="fc-progressive-bar-fill" style="width:${pct}%;"></div>
              </div>
            </div>
            <p class="fc-excel-subtitle">
              Coloca la notaría arrastrando desde <strong>☰</strong> o escribiendo su <strong>puesto (#1 a #${revCount})</strong> y pulsando <code>Enter</code>. Cuando la tengas en su sitio, pulsa <strong>"➕ Siguiente notaría"</strong> para que aparezca la siguiente línea.
            </p>
          </div>

          <div class="fc-excel-toolbar-actions">
            ${canRevealMore ? `
              <button type="button" class="action-btn fc-btn-next-plaza" id="fc-btn-reveal-next">
                ➕ Siguiente notaría (${revCount + 1} / ${totalCount})
              </button>
            ` : `
              <span class="badge" style="background:#10b981; color:#fff; font-size:13px; padding:8px 12px;">
                🎉 ¡Las ${totalCount} notarías están en la tabla!
              </span>
            `}
            <button type="button" class="action-btn-secondary fc-btn-sm" id="fc-excel-download-xlsx" style="border-color:#10b981; color:#10b981;">
              📊 Descargar Excel (.xlsx)
            </button>
            <button type="button" class="action-btn fc-btn-sm" id="fc-go-final-btn" style="background:#1d4ed8; border-color:#1d4ed8;">
              ✅ Terminar: Ver Excel y BOE Anexo II/1 ➡️
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla tipo Hoja de Cálculo con el orden de columnas exacto pedido -->
      <div class="fc-spreadsheet-container" id="fc-spreadsheet-scroll">
        <table class="fc-spreadsheet-table" id="fc-excel-table">
          <thead>
            <tr>
              <th class="fc-col-order">1. Orden (#)</th>
              <th class="fc-col-loc">2. Plaza / Convocatoria / Turno</th>
              <th class="fc-col-work">3. Protocolos y Pólizas 2025</th>
              <th class="fc-col-galo">4. Informe Galo</th>
              <th class="fc-col-peers">5. Compañeros en la Plaza</th>
              <th class="fc-col-dist">6. Distancia C.P.</th>
            </tr>
          </thead>
          <tbody id="fc-excel-tbody">
            ${revealedPlazas.map((p, idx) => renderExcelRowHtml(p, idx + 1, revCount)).join('')}
          </tbody>
        </table>
      </div>

      <!-- Barra inferior para sacar la siguiente notaría sin tener que subir arriba -->
      <div class="fc-bottom-reveal-bar">
        ${canRevealMore ? `
          <button type="button" class="action-btn fc-btn-next-plaza-lg" id="fc-btn-reveal-next-bottom">
            ➕ Sacar siguiente notaría (Línea ${revCount + 1} de ${totalCount})
          </button>
        ` : `
          <button type="button" class="action-btn fc-btn-next-plaza-lg" id="fc-btn-finish-bottom" style="background:#10b981; border-color:#10b981;">
            🎉 ¡Has colocado las ${totalCount} notarías! Ver Excel y BOE Anexo II/1 ➡️
          </button>
        `}
      </div>
    </div>
  `;
}

function renderExcelRowHtml(p, rank, revCount) {
  const isNewlyRevealed = p.fcId === fcState.lastRevealedId;
  const isExcluded = Boolean(fcState.excludedBoe[p.fcId]);
  const noteVal = fcState.notes[p.fcId] || '';

  const badgeCat = p.categoria === 'Primera'
    ? 'badge-primera'
    : p.categoria === 'Segunda'
      ? 'badge-segunda'
      : 'badge-tercera';

  const badgeMotivo = p.motivo.includes('Jubilación')
    ? 'badge-jubilacion'
    : p.motivo === 'Resulta'
      ? 'badge-resulta'
      : p.motivo === 'Excedencia'
        ? 'badge-excedencia'
        : 'badge-desierta';

  // Columna 3: Protocolos y Pólizas 2025
  const protStr = p.protocolos2025 !== null ? p.protocolos2025.toLocaleString('es-ES') : '-';
  const polStr = p.polizas2025 !== null ? p.polizas2025.toLocaleString('es-ES') : '-';
  const foliosStr = p.foliosProt2025 !== null ? p.foliosProt2025.toLocaleString('es-ES') : '-';
  const folPorProtStr = p.foliosPorProt !== null ? `${p.foliosPorProt} fol/prot` : '';
  const totalGenStr = p.totalGeneral2025 !== null ? p.totalGeneral2025.toLocaleString('es-ES') : '-';

  // Columna 5: Compañeros en la plaza
  let peersHtml = '';
  if (p.numNotarias <= 1) {
    peersHtml = `<div class="fc-cell-badge-unique">🏛️ Plaza Única (1 notario)</div>`;
  } else {
    const avgProt = p.mediaProtResto !== null ? p.mediaProtResto.toLocaleString('es-ES') : '-';
    const avgPol = p.mediaPolResto !== null ? p.mediaPolResto.toLocaleString('es-ES') : '-';
    const peersExpanded = Boolean(fcState.expandedPeersRows[p.fcId]);
    peersHtml = `
      <div class="fc-cell-peers-summary">
        <div><strong>🏛️ ${p.numNotarias} notarios</strong> en municipio</div>
        <div class="fc-cell-peers-avg">Media resto: <strong>${avgProt}</strong> prot. · <strong>${avgPol}</strong> pól.</div>
        ${p.restoNotarias && p.restoNotarias.length > 0 ? `
          <button type="button" class="fc-inline-link-btn" data-toggle-peers="${escapeHTML(p.fcId)}">
            ${peersExpanded ? '🔼 Ocultar compañeros' : `🔽 Ver ${p.restoNotarias.length} compañero${p.restoNotarias.length !== 1 ? 's' : ''}`}
          </button>
          ${peersExpanded ? `
            <div class="fc-cell-peers-dropdown">
              ${p.restoNotarias.map(r => `
                <div class="fc-cell-peer-row">
                  <span class="fc-cell-peer-name">${escapeHTML(r.notario)}</span>
                  <span class="fc-cell-peer-nums">📜 ${(r.protocolos || 0).toLocaleString('es-ES')} · 📑 ${(r.polizas || 0).toLocaleString('es-ES')}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  // Columna 6: Distancia
  const distStr = p.distancia !== null ? `${p.distancia.toFixed(1)} km` : (fcState.postalCode ? '...' : 'Sin C.P.');
  const timeStr = p.duration ? formatDuration(p.duration) : (p.distancia !== null ? '✈️ / Ferry' : '');

  return `
    <tr data-id="${escapeHTML(p.fcId)}" class="fc-excel-row ${isNewlyRevealed ? 'fc-row-new' : ''} ${isExcluded ? 'fc-row-excluded' : ''}">
      <!-- COLUMNA 1: ORDEN (#) -->
      <td class="fc-cell-order">
        ${isNewlyRevealed ? `<div class="fc-new-pill">🆕 NUEVA</div>` : ''}
        <div class="fc-order-box">
          <span class="fc-drag-handle" title="Arrastra desde aquí para mover esta fila">☰</span>
          <input type="number" min="1" max="${revCount}" value="${rank}" class="fc-rank-input" data-rank-input="${escapeHTML(p.fcId)}" title="Escribe el puesto (1 a ${revCount}) y pulsa Enter">
        </div>
        <div class="fc-order-checks">
          <label class="fc-check-label" title="Incluir esta plaza en la solicitud del BOE (Anexo II/1)">
            <input type="checkbox" data-boe-check="${escapeHTML(p.fcId)}" ${!isExcluded ? 'checked' : ''}>
            <span>Pedir BOE</span>
          </label>
        </div>
      </td>

      <!-- COLUMNA 2: PLAZA / CONVOCATORIA / TURNO -->
      <td class="fc-cell-loc">
        <div class="fc-loc-name">
          <a href="#" data-action="openTownModal" data-localidad="${escapeHTML(p.localidad)}" data-provincia="${escapeHTML(p.provincia)}" class="town-link" title="Ver ficha del municipio (Wikipedia, Maps, Street View, Idealista)">
            ${escapeHTML(p.localidad)}
          </a>
        </div>
        ${p.notariaSegunConvocatoria !== p.localidad ? `
          <div class="fc-loc-boe-name" title="Denominación literal en el Anexo I del BOE">
            BOE: <em>${escapeHTML(p.notariaSegunConvocatoria)}</em>
          </div>
        ` : ''}
        <div class="fc-loc-sub">
          <strong>${escapeHTML(p.provincia)}</strong> · ${escapeHTML(p.comunidad)}
        </div>
        <div class="fc-conv-top" style="margin-top:5px;">
          <span class="badge" style="background:var(--color-primary); color:#fff; font-weight:700;">
            Nº ${escapeHTML(p.numero)} ${p.origen === 'DOGC' ? '(Cat)' : '(BOE)'}
          </span>
          <span class="badge ${badgeCat}">Cat. ${escapeHTML(p.categoria)}</span>
          <span class="badge ${badgeMotivo}">${escapeHTML(p.motivo)}</span>
        </div>
        <div class="fc-conv-turno">
          ⚖️ ${escapeHTML(p.turno)}
        </div>
        <div class="fc-conv-ant">
          👤 Ant.: <strong>${escapeHTML(p.notarioAnterior)}</strong>
        </div>
      </td>

      <!-- COLUMNA 3: PROTOCOLOS Y PÓLIZAS 2025 -->
      <td class="fc-cell-work">
        <div class="fc-work-main">
          <span class="fc-work-prot" title="Instrumentos públicos 2025 (escrituras, actas y protestos)">📜 <strong>${protStr}</strong> prot.</span>
        </div>
        <div class="fc-work-pol" title="Pólizas 2025">
          📑 <strong>${polStr}</strong> pólizas
        </div>
        <div class="fc-work-folios" title="Folios de los instrumentos públicos 2025">
          📄 ${foliosStr} folios ${folPorProtStr ? `<span class="fc-work-ratio">(${folPorProtStr})</span>` : ''}
        </div>
        <div class="fc-work-total" title="Total general en estadística 2025">
          ∑ Total: <strong>${totalGenStr}</strong>
        </div>
      </td>

      <!-- COLUMNA 4: INFORME GALO -->
      <td class="fc-cell-galo">
        <div class="fc-cell-galo-content">
          ${formatInformeGaloHtml(p.informeGalo)}
        </div>
        <div class="fc-cell-note-wrap">
          <input type="text" class="fc-inline-note-input" data-note-input="${escapeHTML(p.fcId)}" placeholder="📝 Nota personal sobre esta plaza..." value="${escapeHTML(noteVal)}">
          <button type="button" class="fc-icon-action" data-view-galo="${escapeHTML(p.fcId)}" title="Abrir Informe Galo en grande">🔍</button>
        </div>
      </td>

      <!-- COLUMNA 5: COMPAÑEROS EN LA PLAZA -->
      <td class="fc-cell-peers">
        ${peersHtml}
      </td>

      <!-- COLUMNA 6: DISTANCIA C.P. -->
      <td class="fc-cell-dist">
        <div class="fc-dist-km"><strong>${distStr}</strong></div>
        ${timeStr ? `<div class="fc-dist-time">🚗 ${timeStr}</div>` : ''}
      </td>
    </tr>
  `;
}

// ================= PANTALLA 3: FINALIZAR (EXCEL + BOE ANEXO II/1) =================

function renderFinalScreen() {
  const orderedPlazas = getAllOrderedPlazasArray();
  const boePlazas = getBoeFilteredPlazasArray();

  return `
    <div class="fc-final-wrapper">
      <div class="fc-final-hero no-print-boe">
        <h2 style="margin-top:0;">🎉 Listado de Elección en Excel y Solicitud Oficial BOE (BOE-A-2026-21686)</h2>
        <p style="margin-bottom: 18px;">
          Aquí tienes tus dos listados listos para descargar: la <strong>Lista en Excel</strong> y el <strong>Modelo Oficial ANEXO II/1 del BOE</strong>.
        </p>

        <div class="fc-final-actions" style="margin-bottom: 20px;">
          <button type="button" class="action-btn fc-btn-lg" id="fc-btn-download-full-xlsx" style="background:#10b981; border-color:#10b981;">
            📊 1. Descargar Lista en Excel (.xlsx)
          </button>
          <button type="button" class="action-btn fc-btn-lg" id="fc-btn-print-boe" style="background:#1d4ed8; border-color:#1d4ed8;">
            🖨️ 2. Imprimir / Guardar PDF Oficial BOE (Anexo II/1)
          </button>
          <button type="button" class="action-btn-secondary fc-btn-lg" id="fc-btn-download-boe-xlsx">
            📄 Descargar Anexo II/1 BOE en Excel (.xlsx)
          </button>
          <button type="button" class="action-btn-secondary fc-btn-lg" id="fc-btn-copy-boe">
            📋 Copiar Tabla BOE
          </button>
          <button type="button" class="action-btn-secondary fc-btn-lg" id="fc-btn-back-excel">
            ⬅️ Volver a la Tabla Progresiva
          </button>
        </div>

        <div class="fc-boe-config-box">
          <div class="fc-boe-config-title">⚙️ Datos para la cabecera del <strong>ANEXO II/1 (BOE-A-2026-21686)</strong>:</div>
          <div class="fc-boe-config-grid">
            <div class="fc-form-group">
              <label>N.º ESCALAFÓN</label>
              <input type="text" id="fc-boe-escalafon" class="search-input" style="min-width:unset; padding:7px 10px;" value="${escapeHTML(fcState.escalafon)}" placeholder="Ej: 1450">
            </div>
            <div class="fc-form-group">
              <label>APELLIDOS</label>
              <input type="text" id="fc-boe-apellidos" class="search-input" style="min-width:unset; padding:7px 10px;" value="${escapeHTML(fcState.userSurnames)}" placeholder="Ej: GARCÍA LÓPEZ">
            </div>
            <div class="fc-form-group">
              <label>NOMBRE</label>
              <input type="text" id="fc-boe-nombre" class="search-input" style="min-width:unset; padding:7px 10px;" value="${escapeHTML(fcState.userName)}" placeholder="Ej: MIGUEL">
            </div>
            <div class="fc-form-group">
              <label>Solicitar hasta el puesto Nº</label>
              <input type="number" id="fc-boe-max" min="1" max="${orderedPlazas.length}" class="search-input" style="min-width:unset; padding:7px 10px;" value="${fcState.boeMaxCount}">
            </div>
            <div class="fc-form-group">
              <label>Lugar de firma</label>
              <input type="text" id="fc-boe-lugar" class="search-input" style="min-width:unset; padding:7px 10px;" value="${escapeHTML(fcState.lugarFirma)}" placeholder="Ej: Madrid">
            </div>
            <div class="fc-form-group">
              <label>Día / Mes de 2026</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="fc-boe-dia" class="search-input" style="min-width:unset; width:60px; padding:7px 8px;" value="${escapeHTML(fcState.diaFirma)}" placeholder="Día">
                <input type="text" id="fc-boe-mes" class="search-input" style="min-width:unset; flex:1; padding:7px 8px;" value="${escapeHTML(fcState.mesFirma)}" placeholder="octubre">
              </div>
            </div>
          </div>
          <div class="fc-boe-config-checks">
            <label class="fc-check-label">
              <input type="checkbox" id="fc-boe-cat-suffix" ${fcState.boeCatSuffix ? 'checked' : ''}>
              <span>Añadir <code>(Cataluña)</code> al número de orden de convocatoria en las plazas del DOGC</span>
            </label>
            <label class="fc-check-label">
              <input type="checkbox" id="fc-boe-show-motivo" ${fcState.boeShowMotivoDisambig ? 'checked' : ''}>
              <span>Incluir motivo/protocolo entre paréntesis junto al nombre de la notaría</span>
            </label>
          </div>
        </div>

        <div class="fc-final-view-tabs">
          <button type="button" class="fc-view-tab-btn ${fcState.finalTab === 'boe' ? 'active' : ''}" data-final-tab="boe">
            📜 Vista Oficial BOE: ANEXO II/1 (${boePlazas.length} plazas)
          </button>
          <button type="button" class="fc-view-tab-btn ${fcState.finalTab === 'excel' ? 'active' : ''}" data-final-tab="excel">
            📊 Vista Lista en Excel (${orderedPlazas.length} plazas)
          </button>
        </div>
      </div>

      <!-- DOCUMENTO OFICIAL ANEXO II/1 DEL BOE (BOE-A-2026-21686, Pág. 139174) -->
      <div id="fc-boe-anexo-sheet" class="fc-boe-sheet" style="${fcState.finalTab === 'boe' ? '' : 'display:none;'}">
        <div class="fc-boe-sheet-title">ANEXO II/1</div>

        <div class="fc-boe-sheet-meta">
          <div class="fc-boe-meta-row">
            <div class="fc-boe-meta-item">
              <span class="fc-boe-meta-label">N.º ESCALAFÓN</span>
              <span class="fc-boe-meta-value">${escapeHTML(fcState.escalafon)}</span>
            </div>
            <div class="fc-boe-meta-item fc-boe-meta-wide">
              <span class="fc-boe-meta-label">APELLIDOS</span>
              <span class="fc-boe-meta-value">${escapeHTML(fcState.userSurnames)}</span>
            </div>
          </div>
          <div class="fc-boe-meta-row">
            <div class="fc-boe-meta-item fc-boe-meta-wide">
              <span class="fc-boe-meta-label">NOMBRE</span>
              <span class="fc-boe-meta-value">${escapeHTML(fcState.userName)}</span>
            </div>
          </div>
        </div>

        <table class="fc-boe-official-table">
          <thead>
            <tr>
              <th style="width: 18%;">ORDEN DE<br>PREFERENCIA</th>
              <th style="width: 18%;">ORDEN<br>CONVOCATORIA</th>
              <th style="width: 44%;">NOTARÍA QUE SE SOLICITA <em>(según convocatoria)</em></th>
              <th style="width: 20%;">TURNO</th>
            </tr>
          </thead>
          <tbody>
            ${boePlazas.map((p, idx) => `
              <tr>
                <td class="fc-boe-td-center">${idx + 1}</td>
                <td class="fc-boe-td-center">${escapeHTML(formatBoeOrdenConvocatoria(p))}</td>
                <td class="fc-boe-td-left">${escapeHTML(formatBoeNotariaSolicitada(p))}</td>
                <td class="fc-boe-td-center">${escapeHTML(p.turno)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="fc-boe-sheet-footnote">
          En caso necesario deberán utilizarse cuantas hojas sean precisas
        </div>

        <div class="fc-boe-sheet-signature">
          <p>${escapeHTML(fcState.lugarFirma || '....................')} a ${escapeHTML(fcState.diaFirma || '......')} de ${escapeHTML(fcState.mesFirma || '....................')} de 2026</p>
          <p class="fc-boe-sig-sub">(lugar, fecha y firma)</p>
        </div>
      </div>

      <!-- VISTA TABLA EXCEL RESUMEN -->
      <div id="fc-final-excel-preview" class="no-print-boe" style="${fcState.finalTab === 'excel' ? '' : 'display:none;'}">
        <div class="table-responsive">
          <table class="table fc-order-table">
            <thead>
              <tr>
                <th class="center">Orden Pref.</th>
                <th class="center">Orden Conv.</th>
                <th>Notaría (según BOE)</th>
                <th>Provincia / CCAA</th>
                <th class="center">Protocolos 2025</th>
                <th class="center">Pólizas 2025</th>
                <th>Informe Galo</th>
                <th>Compañeros</th>
                <th class="center">Distancia / Tiempo</th>
              </tr>
            </thead>
            <tbody>
              ${orderedPlazas.map((p, idx) => {
                const protStr = p.protocolos2025 !== null ? p.protocolos2025.toLocaleString('es-ES') : '-';
                const polStr = p.polizas2025 !== null ? p.polizas2025.toLocaleString('es-ES') : '-';
                const distStr = p.distancia !== null ? `${p.distancia.toFixed(1)} km` : '-';
                const timeStr = p.duration ? ` (${formatDuration(p.duration)})` : '';

                return `
                  <tr>
                    <td class="center"><strong>#${idx + 1}</strong></td>
                    <td class="center"><span class="badge" style="background:var(--color-surface-hover); color:var(--color-text); font-weight:700;">${escapeHTML(formatBoeOrdenConvocatoria(p))}</span></td>
                    <td>
                      <strong>${escapeHTML(p.notariaSegunConvocatoria)}</strong>
                      <div style="font-size:11px; color:var(--color-text-muted);">${escapeHTML(p.turno)} · ${escapeHTML(p.notarioAnterior)}</div>
                    </td>
                    <td>${escapeHTML(p.provincia)} <small style="color:var(--color-text-muted);">(${escapeHTML(p.comunidad)})</small></td>
                    <td class="center"><strong>${protStr}</strong></td>
                    <td class="center">${polStr}</td>
                    <td style="max-width:340px;"><small>${escapeHTML((p.informeGalo || '').slice(0, 160))}${(p.informeGalo || '').length > 160 ? '...' : ''}</small></td>
                    <td class="center"><small>${p.numNotarias === 1 ? 'Única' : `${p.numNotarias} not. (Media: ${p.mediaProtResto ?? '-'})`}</small></td>
                    <td class="center">${distStr}<small style="color:var(--color-text-muted);">${timeStr}</small></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ================= EVENTOS =================

function attachFcEvents() {
  // Navegación barra superior
  document.getElementById('fc-nav-welcome')?.addEventListener('click', () => {
    fcState.screen = 'welcome';
    saveFcStateToStorage();
    renderFcApp({ resetScroll: true });
  });
  document.getElementById('fc-nav-excel')?.addEventListener('click', () => {
    fcState.screen = 'excel';
    saveFcStateToStorage();
    renderFcApp({ resetScroll: true });
  });
  document.getElementById('fc-nav-final')?.addEventListener('click', () => {
    fcState.screen = 'final';
    saveFcStateToStorage();
    renderFcApp({ resetScroll: true });
  });

  // Guardar / Importar / Pantalla Completa en barra superior
  document.getElementById('fc-btn-save-progress')?.addEventListener('click', exportFcProgressJSON);
  document.getElementById('fc-input-import-top')?.addEventListener('change', (e) => {
    if (e.target.files?.[0]) handleImportFile(e.target.files[0]);
  });

  document.getElementById('fc-btn-browser-fs')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  document.getElementById('fc-btn-exit-fs')?.addEventListener('click', exitFullscreenToWeb);

  // Eventos Pantalla 1 (Inicio)
  if (fcState.screen === 'welcome') {
    const nameInput = document.getElementById('fc-user-name');
    const surnamesInput = document.getElementById('fc-user-surnames');
    const escInput = document.getElementById('fc-user-escalafon');
    const cpInput = document.getElementById('fc-postal-code');

    document.getElementById('fc-start-btn')?.addEventListener('click', async () => {
      const newName = nameInput ? nameInput.value.trim() : '';
      const newSurnames = surnamesInput ? surnamesInput.value.trim() : '';
      const newEsc = escInput ? escInput.value.trim() : '';
      const newCp = cpInput ? cpInput.value.trim() : '';
      const cpChanged = newCp !== fcState.postalCode;

      fcState.userName = newName;
      fcState.userSurnames = newSurnames;
      fcState.escalafon = newEsc;
      fcState.postalCode = newCp;
      saveFcStateToStorage();

      if (newCp && (cpChanged || !fcState.userCoords)) {
        const btn = document.getElementById('fc-start-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '⏳ Calculando distancias en coche...';
        }
        await geocodeAndCalculateFcDistances(newCp);
      }

      fcState.screen = 'excel';
      saveFcStateToStorage();
      renderFcApp({ resetScroll: true });
    });

    document.getElementById('fc-reset-order-btn')?.addEventListener('click', () => {
      if (confirm('¿Quieres reiniciar la tabla para empezar de nuevo con 1 sola línea y el orden alfabético inicial?')) {
        fcState.orderedIds = fcState.plazas.map(p => p.fcId);
        fcState.revealedCount = 1;
        fcState.lastRevealedId = fcState.orderedIds[0] || null;
        fcState.excludedBoe = {};
        fcState.screen = 'excel';
        saveFcStateToStorage();
        renderFcApp({ resetScroll: true });
      }
    });

    document.getElementById('fc-welcome-import-input')?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleImportFile(e.target.files[0]);
    });

    document.getElementById('fc-welcome-export-btn')?.addEventListener('click', exportFcProgressJSON);
  }

  // Eventos Pantalla 2 (Tabla Excel Progresiva 1 a 1)
  if (fcState.screen === 'excel') {
    document.getElementById('fc-btn-reveal-next')?.addEventListener('click', revealNextPlaza);
    document.getElementById('fc-btn-reveal-next-bottom')?.addEventListener('click', revealNextPlaza);
    document.getElementById('fc-excel-download-xlsx')?.addEventListener('click', downloadFullExcelXLSX);

    const goFinal = () => {
      fcState.boeMaxCount = fcState.revealedCount;
      fcState.screen = 'final';
      saveFcStateToStorage();
      renderFcApp({ resetScroll: true });
    };
    document.getElementById('fc-go-final-btn')?.addEventListener('click', goFinal);
    document.getElementById('fc-btn-finish-bottom')?.addEventListener('click', goFinal);

    // Cambio de posición escribiendo el número de orden (#1..#revealedCount)
    document.querySelectorAll('[data-rank-input]').forEach(inp => {
      let committed = false;
      const commitRank = () => {
        if (committed) return;
        const id = inp.getAttribute('data-rank-input');
        const val = parseInt(inp.value, 10);
        if (!isNaN(val) && val >= 1) {
          committed = true;
          movePlazaWithinRevealed(id, val);
        }
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitRank();
        }
      });
      inp.addEventListener('change', commitRank);
    });

    // Casilla "Pedir BOE"
    document.querySelectorAll('[data-boe-check]').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-boe-check');
        if (!chk.checked) {
          fcState.excludedBoe[id] = true;
        } else {
          delete fcState.excludedBoe[id];
        }
        saveFcStateToStorage();
        const tr = chk.closest('tr');
        if (tr) tr.classList.toggle('fc-row-excluded', !chk.checked);
      });
    });

    // Notas en línea
    document.querySelectorAll('[data-note-input]').forEach(inp => {
      inp.addEventListener('input', () => {
        const id = inp.getAttribute('data-note-input');
        fcState.notes[id] = inp.value;
        saveFcStateToStorage();
      });
    });

    // Desplegar compañeros de plaza en línea
    document.querySelectorAll('[data-toggle-peers]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-peers');
        fcState.expandedPeersRows[id] = !fcState.expandedPeersRows[id];
        renderFcApp();
      });
    });

    // SortableJS Drag & Drop entre las filas ya aparecidas
    const tbody = document.getElementById('fc-excel-tbody');
    if (tbody && window.Sortable) {
      if (fcState.sortableInstance) {
        try { fcState.sortableInstance.destroy(); } catch (e) {}
        fcState.sortableInstance = null;
      }
      fcState.sortableInstance = new Sortable(tbody, {
        handle: '.fc-drag-handle',
        animation: 150,
        ghostClass: 'fc-sortable-ghost',
        onEnd: function () {
          const rows = Array.from(tbody.querySelectorAll('.fc-excel-row'));
          const newRevealedOrder = rows.map(r => r.getAttribute('data-id')).filter(Boolean);
          const unrevealedPart = fcState.orderedIds.slice(fcState.revealedCount);
          fcState.orderedIds = ensureCompleteOrderedIds([...newRevealedOrder, ...unrevealedPart]);
          saveFcStateToStorage();
          // Actualizar los números de orden en el DOM sin reconstruir ni mover el scroll
          rows.forEach((row, idx) => {
            const rankInp = row.querySelector('[data-rank-input]');
            if (rankInp) rankInp.value = idx + 1;
          });
        }
      });
    }
  }

  // Eventos Pantalla 3 (Final: Excel + BOE Anexo II/1)
  if (fcState.screen === 'final') {
    document.getElementById('fc-btn-download-full-xlsx')?.addEventListener('click', downloadFullExcelXLSX);
    document.getElementById('fc-btn-print-boe')?.addEventListener('click', printBoeAnexoII1);
    document.getElementById('fc-btn-download-boe-xlsx')?.addEventListener('click', downloadBoeAnexoExcelXLSX);
    document.getElementById('fc-btn-copy-boe')?.addEventListener('click', copyBoeTableToClipboard);
    document.getElementById('fc-btn-back-excel')?.addEventListener('click', () => {
      fcState.screen = 'excel';
      saveFcStateToStorage();
      renderFcApp({ resetScroll: true });
    });

    const bindLiveField = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        fcState[key] = el.value.trim();
        saveFcStateToStorage();
        renderFcApp();
      });
    };
    bindLiveField('fc-boe-escalafon', 'escalafon');
    bindLiveField('fc-boe-apellidos', 'userSurnames');
    bindLiveField('fc-boe-nombre', 'userName');
    bindLiveField('fc-boe-lugar', 'lugarFirma');
    bindLiveField('fc-boe-dia', 'diaFirma');
    bindLiveField('fc-boe-mes', 'mesFirma');

    document.getElementById('fc-boe-max')?.addEventListener('change', (e) => {
      fcState.boeMaxCount = Math.max(1, Math.min(fcState.plazas.length, parseInt(e.target.value, 10) || fcState.plazas.length));
      saveFcStateToStorage();
      renderFcApp();
    });

    document.getElementById('fc-boe-cat-suffix')?.addEventListener('change', (e) => {
      fcState.boeCatSuffix = e.target.checked;
      saveFcStateToStorage();
      renderFcApp();
    });

    document.getElementById('fc-boe-show-motivo')?.addEventListener('change', (e) => {
      fcState.boeShowMotivoDisambig = e.target.checked;
      saveFcStateToStorage();
      renderFcApp();
    });

    document.querySelectorAll('[data-final-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        fcState.finalTab = btn.getAttribute('data-final-tab');
        renderFcApp();
      });
    });
  }

  // Botón lupa para ver Informe Galo en modal
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
