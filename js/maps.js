/**
 * maps.js — Integración de Mapa Interactivo
 * Mudanzas D'La 14
 *
 * APIs usadas (100% GRATUITAS, sin API key):
 *   - Leaflet.js        → Mapa interactivo (OpenStreetMap tiles)
 *   - Photon (Komoot)   → Autocompletado de direcciones
 *   - OSRM              → Cálculo de distancia real por carretera
 */

'use strict';

/* ── Helper: escape HTML ── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

/* ── State ── */
const MapState = {
  map:          null,
  markerOrigen: null,
  markerDest:   null,
  routeLine:    null,
  isManualMode: true,
  coords: {
    origen:  null,   // { lat, lon, display, isManualApprox }
    destino: null    // { lat, lon, display, isManualApprox }
  }
};

/* ── Custom red/green markers ── */
function createMarker(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,.6);
      cursor:grab;
    "></div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
    popupAnchor:[0, -14]
  });
}

/* ────────────────────────────────────
   INIT MAP (lazy — only once)
──────────────────────────────────── */
function initMap() {
  if (MapState.map) return;

  MapState.map = L.map('routeMap', {
    center: [19.0414, -98.2063], // Puebla, Puebla
    zoom:   12,
    zoomControl: true,
    attributionControl: true
  });

  // Servidor de mapas CARTO Voyager (basado en OpenStreetMap, 100% gratuito, rápido y sin bloqueos 403)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(MapState.map);
}

/* ────────────────────────────────────
   PHOTON AUTOCOMPLETE
   API pública de Komoot — sin key
──────────────────────────────────── */
const autocompleteTimers = {};

/**
 * @param {string} fieldId   'origen' | 'destino'
 * @param {string} listId    'origenList' | 'destinoList'
 * @param {string} coordsId  'origenCoords' | 'destinoCoords'
 * @param {string} textId    'origenCoordsText' | 'destinoCoordsText'
 */
function setupAutocomplete(fieldId, listId, coordsId, textId) {
  const input  = document.getElementById(fieldId);
  const list   = document.getElementById(listId);
  const coords = document.getElementById(coordsId);
  const text   = document.getElementById(textId);
  if (!input || !list) return;

  // Typing handler — debounced 400ms
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(autocompleteTimers[fieldId]);
    list.classList.remove('open');
    list.innerHTML = '';

    // Reset coords if user is typing again
    if (MapState.coords[fieldId]) {
      MapState.coords[fieldId] = null;
      coords.style.display = 'none';
      clearRoute();
    }

    if (q.length < 3) return;

    autocompleteTimers[fieldId] = setTimeout(() => {
      fetchPhoton(q, list, input, coords, text, fieldId);
    }, 400);
  });

  // Close list on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.classList.remove('open');
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('li:not(.autocomplete-loading)');
    const active = list.querySelector('li.active');
    let idx = -1;
    items.forEach((li, i) => { if (li === active) idx = i; });

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (active) active.classList.remove('active');
      const next = items[Math.min(idx + 1, items.length - 1)];
      if (next) next.classList.add('active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (active) active.classList.remove('active');
      const prev = items[Math.max(idx - 1, 0)];
      if (prev) prev.classList.add('active');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) active.click();
    } else if (e.key === 'Escape') {
      list.classList.remove('open');
    }
  });
}

/**
 * Establece una dirección como "Aproximada" y desbloquea el cálculo manual
 */
function selectApproximateAddress(fieldId, query, input, list, coordsEl, textEl) {
  input.value = query;
  list.classList.remove('open');
  list.innerHTML = '';

  MapState.coords[fieldId] = {
    lat: null,
    lon: null,
    display: query,
    isManualApprox: true
  };

  coordsEl.style.display = 'flex';
  coordsEl.className = 'addr-coords approx';
  textEl.innerHTML = `<i class="fas fa-info-circle"></i> Ubicación aproximada: <strong>${escapeHtml(query)}</strong> (distancia manual)`;

  // Quitar marcador si existía
  if (fieldId === 'origen' && MapState.markerOrigen) {
    MapState.markerOrigen.remove();
    MapState.markerOrigen = null;
  } else if (fieldId === 'destino' && MapState.markerDest) {
    MapState.markerDest.remove();
    MapState.markerDest = null;
  }

  clearRoute();

  // Ocultar mapa en modo manual/aproximado
  const mapWrapper = document.getElementById('mapWrapper');
  if (mapWrapper) mapWrapper.classList.remove('visible');

  // Mostrar mensaje de colocar dirección completa
  const manualNotice = document.getElementById('manualAddressNotice');
  if (manualNotice) manualNotice.style.display = 'flex';

  setRouteUI('manual-notice', null, null, 'Coloca tu dirección completa y define la distancia estimada en km.');
  setKmValue(window.quoteData?.km || 50, 'manual');

  // Enfocar el slider de distancia
  const slider = document.getElementById('kmSlider');
  if (slider) slider.focus();
}

async function fetchPhoton(query, list, input, coordsEl, textEl, fieldId) {
  // Show loading
  list.innerHTML = `<li class="autocomplete-loading"><i class="fas fa-spinner fa-spin"></i> Buscando...</li>`;
  list.classList.add('open');

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 6000);

  let results = [];

  // 1. Try Photon (fast autocomplete)
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lat=19.0414&lon=-98.2063`;
    const res = await fetch(url, { signal: controller.signal });
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        results = data.features.map(feat => {
          const p   = feat.properties;
          const lon = feat.geometry.coordinates[0];
          const lat = feat.geometry.coordinates[1];
          const parts = [p.name, p.street, p.housenumber, p.postcode, p.city, p.state, p.country].filter(Boolean);
          const mainLabel = [p.name || p.street, p.housenumber].filter(Boolean).join(' ') || parts[0] || query;
          const subLabel  = [p.city || p.county, p.state, p.country].filter(Boolean).join(', ');
          const fullLabel = parts.join(', ') || mainLabel;
          return { lat, lon, mainLabel, subLabel, fullLabel };
        });
      }
    }
  } catch (err) {
    console.warn('Photon fetch failed, trying Nominatim fallback...', err);
  }

  // 2. Fallback to OpenStreetMap Nominatim if Photon returned no results or failed
  if (results.length === 0) {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=mx`;
      const res = await fetch(nomUrl, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'es' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          results = data.map(item => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const parts = (item.display_name || '').split(',').map(s => s.trim());
            const mainLabel = item.name || parts[0] || query;
            const subLabel  = parts.slice(1, 4).join(', ');
            return { lat, lon, mainLabel, subLabel, fullLabel: item.display_name };
          });
        }
      }
    } catch (nomErr) {
      console.warn('Nominatim fallback also failed:', nomErr);
    }
  }

  clearTimeout(timeout);
  list.innerHTML = '';

  if (results.length === 0) {
    const li = document.createElement('li');
    li.className = 'autocomplete-approx-item';
    li.innerHTML = `
      <div style="display:flex;align-items:center;gap:.6rem;width:100%;">
        <i class="fas fa-map-pin" style="color:#f59e0b;font-size:1.1rem;flex-shrink:0;"></i>
        <div style="flex:1;">
          <strong style="color:var(--white);font-size:.85rem;display:block;">Usar "${escapeHtml(query)}" como ubicación aproximada</strong>
          <span style="font-size:.74rem;color:#fbbf24;">No encontrada en mapa · Podrás definir los km manualmente</span>
        </div>
      </div>
    `;
    li.addEventListener('click', () => {
      selectApproximateAddress(fieldId, query, input, list, coordsEl, textEl);
    });
    list.appendChild(li);
    list.classList.add('open');
    return;
  }

  results.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <i class="fas fa-map-marker-alt"></i>
      <div>
        <span class="ac-main">${escapeHtml(item.mainLabel)}</span>
        <span class="ac-secondary">${escapeHtml(item.subLabel)}</span>
      </div>
    `;
    li.addEventListener('click', () => {
      input.value = item.fullLabel;
      list.classList.remove('open');
      list.innerHTML = '';

      // Store coords
      MapState.coords[fieldId] = {
        lat: item.lat,
        lon: item.lon,
        display: item.fullLabel,
        isManualApprox: false
      };

      // Show confirmed pill
      coordsEl.style.display = 'flex';
      coordsEl.className     = 'addr-coords';
      textEl.innerHTML       = `<span>${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}</span>`;

      // Update map & route
      updateMapMarker(fieldId, item.lat, item.lon, item.mainLabel);
      if (MapState.coords.origen && MapState.coords.destino) {
        if (MapState.coords.origen.isManualApprox || MapState.coords.destino.isManualApprox) {
          clearRoute();
          setRouteUI('manual-notice', null, null, 'Una o ambas direcciones son aproximadas. Ajusta la distancia en km manualmente.');
          setKmValue(window.quoteData?.km || 50, 'manual');
        } else {
          calcRoute();
        }
      }
    });

    list.appendChild(li);
  });

  // Opción adicional al final para colocar aproximado si ninguna sugerencia coincide
  const approxLi = document.createElement('li');
  approxLi.className = 'autocomplete-approx-item';
  approxLi.innerHTML = `
    <div style="display:flex;align-items:center;gap:.6rem;width:100%;">
      <i class="fas fa-question-circle" style="color:#f59e0b;font-size:.95rem;flex-shrink:0;"></i>
      <div style="flex:1;">
        <span style="color:var(--gray);font-size:.82rem;font-weight:600;display:block;">¿No ves tu dirección exacta?</span>
        <span style="font-size:.73rem;color:var(--gray-dark);">Usar "${escapeHtml(query)}" como aproximada y calcular km manualmente</span>
      </div>
    </div>
  `;
  approxLi.addEventListener('click', () => {
    selectApproximateAddress(fieldId, query, input, list, coordsEl, textEl);
  });
  list.appendChild(approxLi);

  list.classList.add('open');
}

/* ────────────────────────────────────
   UPDATE MAP MARKERS & DRAGGABLE LOGIC
──────────────────────────────────── */
function updateMapMarker(fieldId, lat, lon, label) {
  // Show map
  const wrapper = document.getElementById('mapWrapper');
  if (wrapper) wrapper.classList.add('visible');

  // Init map if needed
  initMap();
  setTimeout(() => MapState.map && MapState.map.invalidateSize(), 100);

  const isOrigen  = fieldId === 'origen';
  const color     = isOrigen ? '#e11d1d' : '#16a34a';
  const title     = isOrigen ? 'Origen' : 'Destino';
  const iconClass = isOrigen ? 'fa-map-marker-alt' : 'fa-flag-checkered';

  // Crear marcador con draggable: true
  const marker = L.marker([lat, lon], {
    icon: createMarker(color),
    draggable: true
  }).addTo(MapState.map);

  marker.bindPopup(`
    <strong><i class="fas ${iconClass}" style="color:${color}"></i> ${title}</strong><br>
    ${escapeHtml(label)}<br>
    <small style="color:var(--gray-dark);display:block;margin-top:4px;">
      <i class="fas fa-arrows-alt"></i> Puedes arrastrar este pin para ajustar la ubicación exacta
    </small>
  `);

  // Evento dragend: actualiza coordenadas y recalcula la ruta automáticamente
  marker.on('dragend', (e) => {
    const { lat: newLat, lng: newLng } = e.target.getLatLng();
    const coordsEl = document.getElementById(fieldId + 'Coords');
    const textEl   = document.getElementById(fieldId + 'CoordsText');
    const inputEl  = document.getElementById(fieldId);
    const currentName = (inputEl?.value || label).replace(/\s*\(punto ajustado en mapa\)/g, '');

    MapState.coords[fieldId] = {
      lat: newLat,
      lon: newLng,
      display: `${currentName} (punto ajustado en mapa)`,
      isManualApprox: false,
      isPinAdjusted: true
    };

    if (coordsEl) {
      coordsEl.style.display = 'flex';
      coordsEl.className = 'addr-coords';
    }
    if (textEl) {
      textEl.innerHTML = `<strong>${newLat.toFixed(5)}, ${newLng.toFixed(5)}</strong> <span style="font-size:.75rem;opacity:.85">(punto ajustado)</span>`;
    }

    marker.setPopupContent(`
      <strong><i class="fas ${iconClass}" style="color:${color}"></i> ${title}</strong><br>
      ${escapeHtml(label)}<br>
      <small style="color:var(--success);display:block;margin-top:4px;">
        <i class="fas fa-check"></i> Ubicación ajustada exactamente
      </small>
    `);

    // Recalcular ruta si ambos puntos están definidos y tienen coordenadas reales
    if (MapState.coords.origen && MapState.coords.destino &&
        MapState.coords.origen.lat != null && MapState.coords.destino.lat != null) {
      calcRoute();
    }
  });

  if (isOrigen) {
    if (MapState.markerOrigen) MapState.markerOrigen.remove();
    MapState.markerOrigen = marker;
  } else {
    if (MapState.markerDest) MapState.markerDest.remove();
    MapState.markerDest = marker;
  }

  // Fit map to markers
  const markers = [MapState.markerOrigen, MapState.markerDest].filter(Boolean);
  if (markers.length === 1) {
    MapState.map.setView([lat, lon], 14);
  } else if (markers.length === 2) {
    const group = L.featureGroup(markers);
    MapState.map.fitBounds(group.getBounds().pad(0.15));
  }
}

/* ────────────────────────────────────
   OSRM — REAL ROAD DISTANCE
   Open Source Routing Machine
   API pública — sin key, gratis
──────────────────────────────────── */
let routeDebounce = null;

async function calcRoute() {
  if (!MapState.coords.origen || !MapState.coords.destino) return;

  // Si alguna de las dos es aproximada manual, no calcular por OSRM
  if (MapState.coords.origen.isManualApprox || MapState.coords.destino.isManualApprox) {
    clearRoute();
    setRouteUI('manual-notice', null, null, 'Ubicación aproximada: ingresa la distancia en km manualmente.');
    setKmValue(window.quoteData?.km || 50, 'manual');
    return;
  }

  const { lat: lat1, lon: lon1 } = MapState.coords.origen;
  const { lat: lat2, lon: lon2 } = MapState.coords.destino;
  if (lat1 == null || lat2 == null) return;

  // UI state
  setRouteUI('calculating');

  clearTimeout(routeDebounce);
  routeDebounce = setTimeout(async () => {
    try {
      // OSRM public demo server — driving mode
      const osrmController = new AbortController();
      const osrmTimeout    = setTimeout(() => osrmController.abort(), 8000);
      const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
      const res  = await fetch(url, { signal: osrmController.signal });
      clearTimeout(osrmTimeout);
      if (!res.ok) throw new Error(`OSRM error ${res.status}`);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route   = data.routes[0];
      const distKm  = Math.max(1, Math.round(route.distance / 1000));
      const durSecs = route.duration;
      const durStr  = formatDuration(durSecs);

      // Bloquear km al valor del mapa (modo automático)
      setKmValue(distKm, 'auto');

      // Draw polyline on map
      drawRouteLine(route.geometry.coordinates);

      // Show route info
      setRouteUI('success', distKm, durStr);

    } catch (err) {
      console.warn('OSRM route error:', err);
      // Fallback: haversine × 1.3 road factor
      const distKm = Math.max(1, Math.round(haversine(lat1, lon1, lat2, lon2) * 1.3));
      setKmValue(distKm, 'auto');
      setRouteUI('fallback', distKm);
    }
  }, 600);
}

function drawRouteLine(coords) {
  initMap();
  if (MapState.routeLine) MapState.routeLine.remove();

  // coords from OSRM are [lon, lat] → convert to [lat, lon] for Leaflet
  const latlngs = coords.map(c => [c[1], c[0]]);
  MapState.routeLine = L.polyline(latlngs, {
    color:     '#e11d1d',
    weight:    4,
    opacity:   0.8,
    dashArray: '8 4'
  }).addTo(MapState.map);

  // Fit bounds to route
  MapState.map.fitBounds(MapState.routeLine.getBounds().pad(0.12));
}

function clearRoute() {
  if (MapState.routeLine) { MapState.routeLine.remove(); MapState.routeLine = null; }
  setRouteUI('hidden');
}

/* ── Route UI states ── */
function setRouteUI(state, km, time, customMsg) {
  const info   = document.getElementById('routeInfo');
  const calc   = document.getElementById('routeCalc');
  const errEl  = document.getElementById('routeError');
  const errTxt = document.getElementById('routeErrorText');
  const kmTxt  = document.getElementById('routeKmText');
  const timeTxt= document.getElementById('routeTimeText');

  // Hide all
  [info, calc, errEl].forEach(el => { if (el) el.style.display = 'none'; });

  if (state === 'calculating') {
    if (calc) calc.style.display = 'flex';
  } else if (state === 'success') {
    if (info) info.style.display = 'flex';
    if (kmTxt)   kmTxt.textContent   = `${km} km`;
    if (timeTxt) timeTxt.textContent = time;
  } else if (state === 'fallback') {
    if (info) info.style.display = 'flex';
    if (kmTxt)   kmTxt.textContent   = `~${km} km (estimado)`;
    if (timeTxt) timeTxt.textContent = '—';
    if (errEl) {
      errEl.style.display = 'flex';
      errEl.style.background = 'rgba(217,119,6,.08)';
      errEl.style.borderColor = 'rgba(217,119,6,.3)';
      errEl.style.color = '#fbbf24';
    }
    if (errTxt)  errTxt.textContent  = 'Ruta exacta no disponible. Se usó distancia estimada (línea recta ×1.3).';
  } else if (state === 'manual-notice') {
    if (errEl) {
      errEl.style.display = 'flex';
      errEl.style.background = 'rgba(245,158,11,.08)';
      errEl.style.borderColor = 'rgba(245,158,11,.35)';
      errEl.style.color = '#fbbf24';
    }
    if (errTxt) {
      errTxt.innerHTML = `<i class="fas fa-info-circle"></i> ${customMsg || 'Ubicación aproximada: ingresa los kilómetros manualmente.'}`;
    }
  } else if (state === 'hidden') {
    // All hidden already
  }
}

/* ────────────────────────────────────
   KM SLIDER & LOCKING (UNA U OTRA)
──────────────────────────────────── */
function setKmValue(km, source = 'manual') {
  km = Math.min(1500, Math.max(1, km));
  const slider     = document.getElementById('kmSlider');
  const valEl      = document.getElementById('kmValue');
  const dispEl     = document.getElementById('kmDisplay');
  const badgeEl    = document.getElementById('kmSourceBadge');
  const btnToggle  = document.getElementById('btnToggleManualKm');
  const lockNotice = document.getElementById('kmLockNotice');

  if (slider)  slider.value       = km;
  if (valEl)   valEl.textContent  = km;
  if (dispEl)  dispEl.textContent = `${km} km`;

  if (source === 'auto') {
    // MODO RUTA MAPA: Bloquear slider y valor editable
    MapState.isManualMode = false;
    const manualNotice = document.getElementById('manualAddressNotice');
    if (manualNotice) manualNotice.style.display = 'none';
    const mapWrapper = document.getElementById('mapWrapper');
    if (mapWrapper && (MapState.markerOrigen || MapState.markerDest)) {
      mapWrapper.classList.add('visible');
    }

    if (slider) {
      slider.disabled = true;
      slider.classList.add('locked');
    }
    if (valEl) {
      valEl.setAttribute('contenteditable', 'false');
      valEl.classList.add('locked');
    }
    if (badgeEl) {
      badgeEl.innerHTML = '<i class="fas fa-lock"></i> Por mapa';
      badgeEl.className = 'km-source-badge auto';
    }
    if (btnToggle) {
      btnToggle.style.display = 'inline-flex';
      btnToggle.innerHTML = '<i class="fas fa-pencil-alt"></i> Cambiar a manual';
    }
    if (lockNotice) {
      lockNotice.style.display = 'block';
    }
  } else {
    // MODO MANUAL: Desbloquear slider y valor editable
    MapState.isManualMode = true;
    if (slider) {
      slider.disabled = false;
      slider.classList.remove('locked');
    }
    if (valEl) {
      valEl.setAttribute('contenteditable', 'true');
      valEl.classList.remove('locked');
    }
    if (badgeEl) {
      badgeEl.innerHTML = '<i class="fas fa-hand-pointer"></i> Manual';
      badgeEl.className = 'km-source-badge';
    }
    if (lockNotice) {
      lockNotice.style.display = 'none';
    }

    // Si ambos puntos tienen coordenadas en mapa, permitir volver al cálculo automático
    if (btnToggle) {
      if (MapState.coords.origen && MapState.coords.destino &&
          MapState.coords.origen.lat != null && MapState.coords.destino.lat != null) {
        btnToggle.style.display = 'inline-flex';
        btnToggle.innerHTML = '<i class="fas fa-route"></i> Usar distancia de mapa';
      } else {
        btnToggle.style.display = 'none';
      }
    }
  }

  // Actualizar calculador
  if (window.quoteData) {
    window.quoteData.km = km;
    if (typeof window.updatePricePreview === 'function') window.updatePricePreview();
  }
}

/* ────────────────────────────────────
   HAVERSINE — Fallback straight-line
──────────────────────────────────── */
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371; // Earth radius km
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) *
             Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Format seconds to "Xh Ym" ── */
function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

/* ────────────────────────────────────
   INIT — Wire everything up on DOMContentLoaded
──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Setup autocomplete for both fields
  setupAutocomplete('origen',  'origenList',  'origenCoords',  'origenCoordsText');
  setupAutocomplete('destino', 'destinoList', 'destinoCoords', 'destinoCoordsText');

  // Wire km slider manual input
  const slider = document.getElementById('kmSlider');
  const valEl  = document.getElementById('kmValue');
  const dispEl = document.getElementById('kmDisplay');

  if (slider) {
    slider.addEventListener('input', () => {
      // Si está bloqueado no permitir cambios
      if (slider.disabled) return;
      const v = parseInt(slider.value);
      if (valEl)  valEl.textContent  = v;
      if (dispEl) dispEl.textContent = `${v} km`;
      const badge = document.getElementById('kmSourceBadge');
      if (badge) {
        badge.innerHTML = '<i class="fas fa-hand-pointer"></i> Manual';
        badge.className = 'km-source-badge';
      }
      if (window.quoteData) {
        window.quoteData.km = v;
        if (typeof window.updatePricePreview === 'function') window.updatePricePreview();
      }
    });
  }

  if (valEl) {
    valEl.addEventListener('blur', () => {
      if (valEl.getAttribute('contenteditable') === 'false') return;
      const v = Math.min(1500, Math.max(1, parseInt(valEl.textContent) || 1));
      setKmValue(v, 'manual');
    });
    valEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); valEl.blur(); }
    });
  }

  // Botón para alternar entre manual y ruta de mapa
  const btnToggle = document.getElementById('btnToggleManualKm');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const mapWrapper   = document.getElementById('mapWrapper');
      const manualNotice = document.getElementById('manualAddressNotice');

      if (MapState.isManualMode) {
        // Volver a calcular por mapa
        if (manualNotice) manualNotice.style.display = 'none';
        if (mapWrapper && (MapState.markerOrigen || MapState.markerDest)) {
          mapWrapper.classList.add('visible');
        }
        calcRoute();
      } else {
        // Cambiar a manual:
        // La dirección se mantiene (no se borra nada de origen/destino)
        // Se quita el mapa
        if (mapWrapper) mapWrapper.classList.remove('visible');

        // Sale mensaje de "Coloca tu dirección completa"
        if (manualNotice) manualNotice.style.display = 'flex';

        // Poner slider en modo manual
        const curKm = parseInt(document.getElementById('kmSlider')?.value) || 50;
        setKmValue(curKm, 'manual');
        setRouteUI('manual-notice', null, null, 'Coloca tu dirección completa');
      }
    });
  }
});

// Expose for app.js use
window.MapState   = MapState;
window.setKmValue = setKmValue;
window.calcRoute  = calcRoute;
