/**
 * app.js — Main application logic
 * Mudanzas D'La 14
 *
 * BUGS CORREGIDOS:
 *  #1  resetQuote() reasignaba quoteData perdiendo la referencia window.quoteData → ahora usa Object.assign()
 *  #2  Listeners duplicados del slider en app.js y maps.js → eliminado el bloque km del initQuoteForm
 *  #3  waContactLink no se actualizaba en loadContact()
 *  #4  kmValue.addEventListener('change') no aplica a contenteditable (no dispara 'change') → eliminado
 *  #5  goToStep() permitía saltar a paso 2+ sin unidad desde los breadcrumbs superiores → validación mejorada
 *  #6  FontAwesome icons no existentes en FA6 (fa-nightstand, fa-dresser, fa-kitchen-set, fa-border-top-left,
 *      fa-rectangle-list, fa-cabinet-filing, fa-mattress-pillow) → reemplazados con iconos válidos
 *  #7  submitQuote() llamaba form.querySelector('#origen') pero el id es en el form global (no sub-query) → corregido
 *  #8  loadContact() se llamaba dos veces (initWhatsapp + DOMContentLoaded) → eliminada la doble llamada
 *  #9  quoteResult podía quedar como null si unitId es null y se llama generatePDF → toast claro ya existía
 */

/* ── Furniture catalog by room ── */
const FURNITURE_CATALOG = {
  sala: {
    label: 'Sala',
    icon: 'fa-couch',
    items: [
      { id: 'sofa_3',    icon: 'fa-couch',         name: 'Sofá 3 plazas',       note: 'Grande / pesado' },
      { id: 'sofa_2',    icon: 'fa-couch',         name: 'Sofá 2 plazas',       note: 'Mediano' },
      { id: 'sofa_1',    icon: 'fa-chair',         name: 'Sillón individual',   note: '' },
      { id: 'tv',        icon: 'fa-tv',            name: 'Televisor',           note: 'Con mueble' },
      { id: 'mesa_cent', icon: 'fa-table',         name: 'Mesa de centro',      note: '' },  // FIX #6: fa-border-top-left → fa-table
      { id: 'librero',   icon: 'fa-book',          name: 'Librero / estante',   note: '' },
      { id: 'consola',   icon: 'fa-tv',            name: 'Consola / credenza',  note: '' },  // FIX #6: fa-rectangle-list → fa-tv
      { id: 'alfombra',  icon: 'fa-scroll',        name: 'Alfombra grande',     note: '' },
    ]
  },
  comedor: {
    label: 'Comedor',
    icon: 'fa-utensils',
    items: [
      { id: 'mesa_com',  icon: 'fa-table',         name: 'Mesa de comedor',     note: '4–8 personas' },
      { id: 'sillas_4',  icon: 'fa-chair',         name: 'Set de sillas',       note: '4–8 piezas' },
      { id: 'vitrina',   icon: 'fa-box-open',      name: 'Vitrina / aparador',  note: 'Con vidrio' },  // FIX #6: fa-cabinet-filing → fa-box-open
      { id: 'bar_mini',  icon: 'fa-wine-glass',    name: 'Mueble bar',          note: '' },
      { id: 'lampara_c', icon: 'fa-lightbulb',     name: 'Lámpara de pie',      note: '' },
    ]
  },
  recamara: {
    label: 'Recámara',
    icon: 'fa-bed',
    items: [
      { id: 'cama_king',  icon: 'fa-bed',          name: 'Cama King Size',      note: 'Con cabecera' },
      { id: 'cama_queen', icon: 'fa-bed',          name: 'Cama Queen / Mat.',   note: 'Con cabecera' },
      { id: 'cama_ind',   icon: 'fa-bed',          name: 'Cama Individual',     note: '' },
      { id: 'colchon',    icon: 'fa-square',       name: 'Colchón extra',       note: 'Sin base' },    // FIX #6: fa-mattress-pillow → fa-square
      { id: 'ropero',     icon: 'fa-door-closed',  name: 'Ropero / armario',    note: 'Grande, pesado' },
      { id: 'comoda',     icon: 'fa-boxes-stacked',name: 'Cómoda',              note: 'Con o sin espejo' }, // FIX #6: fa-dresser → fa-boxes-stacked
      { id: 'buro',       icon: 'fa-table',        name: 'Buró / mesa de noche',note: '' },            // FIX #6: fa-nightstand → fa-table
      { id: 'tocador',    icon: 'fa-circle',       name: 'Tocador',             note: 'Con espejo' },
    ]
  },
  cocina: {
    label: 'Cocina',
    icon: 'fa-utensils',                                                                               // FIX #6: fa-kitchen-set → fa-utensils
    items: [
      { id: 'refri',      icon: 'fa-snowflake',    name: 'Refrigerador',        note: '14–22 pies' },  // FIX #6: fa-temperature-low → fa-snowflake
      { id: 'estufa',     icon: 'fa-fire',         name: 'Estufa / horno',      note: '' },            // FIX #6: fa-fire-burner → fa-fire
      { id: 'microondas', icon: 'fa-square',       name: 'Microondas',          note: 'Independiente' }, // FIX #6
      { id: 'lava_platos',icon: 'fa-sink',         name: 'Lavavajillas',        note: '' },
      { id: 'alacena',    icon: 'fa-archive',      name: 'Alacena / trinchero', note: '' },            // FIX #6: fa-toolbox → fa-archive
      { id: 'isla',       icon: 'fa-table',        name: 'Isla de cocina',      note: 'Con o sin tarja' },
    ]
  },
  lavanderia: {
    label: 'Lavandería',
    icon: 'fa-shirt',
    items: [
      { id: 'lavadora',   icon: 'fa-rotate',       name: 'Lavadora',            note: 'Carga sup. o frontal' }, // FIX #6: fa-drum → fa-rotate
      { id: 'secadora',   icon: 'fa-wind',         name: 'Secadora',            note: '' },
      { id: 'tendedero',  icon: 'fa-arrows-left-right', name: 'Tendedero metálico',  note: '' },       // FIX #6
    ]
  },
  oficina: {
    label: 'Oficina',
    icon: 'fa-briefcase',
    items: [
      { id: 'escritorio', icon: 'fa-table',         name: 'Escritorio',          note: 'Grande o esquinero' },
      { id: 'silla_ofi',  icon: 'fa-chair',         name: 'Silla ejecutiva',     note: '' },
      { id: 'archivero',  icon: 'fa-folder',        name: 'Archivero',           note: 'Metal / madera' }, // FIX #6: fa-file-alt → fa-folder
      { id: 'pc',         icon: 'fa-desktop',       name: 'Computadora de escritorio', note: '' },
      { id: 'impresora',  icon: 'fa-print',         name: 'Impresora',           note: '' },
      { id: 'librero_ofi',icon: 'fa-book',          name: 'Librero de oficina',  note: '' },
    ]
  },
  otros: {
    label: 'Otros',
    icon: 'fa-ellipsis',
    items: [
      { id: 'piano',      icon: 'fa-music',          name: 'Piano / teclado',     note: 'Maniobra especial' },
      { id: 'bici',       icon: 'fa-bicycle',        name: 'Bicicleta',           note: '' },
      { id: 'ejercicio',  icon: 'fa-dumbbell',       name: 'Equipo de ejercicio', note: 'Caminadora, pesas, etc.' },
      { id: 'caja_fuerte',icon: 'fa-lock',           name: 'Caja fuerte',         note: 'Maniobra especial' },
      { id: 'acuario',    icon: 'fa-fish',           name: 'Pecera / acuario',    note: 'Vacío' },
      { id: 'plantas',    icon: 'fa-leaf',           name: 'Plantas grandes',     note: 'En maceta' },
      { id: 'cajas_gen',  icon: 'fa-boxes-stacked',  name: 'Cajas generales',     note: 'Estima cantidad de cajas' }, // FIX #6: fa-boxes-packing → fa-boxes-stacked
      { id: 'maletas',    icon: 'fa-suitcase',       name: 'Maletas / bultos',    note: '' },
    ]
  }
};

/* ── State (object reference shared with maps.js via window.quoteData) ── */
let currentStep = 1;
let quoteData   = { km: 50, unitId: null, extraIds: [], furniture: {} };
let quoteResult = null;

// Expose object reference to maps.js (MUST be the same object — not a copy)
window.quoteData = quoteData;

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  initTabs();
  initHero();
  initQuoteForm();
  initFAQ();
  initContactForm();
  loadContact();

  // Listen for real-time Firestore config updates
  window.addEventListener('mudanzas:configUpdated', () => {
    loadContact();
    renderUnitCards();
    renderExtras();
    updatePricePreview();
  });
});

/* ── Theme Toggle (Claro / Oscuro) ── */
function initTheme() {
  const savedTheme = localStorage.getItem('mudanzas14_theme') || 'dark';
  applyTheme(savedTheme);

  const toggleBtns = [document.getElementById('themeToggleBtn'), document.getElementById('themeToggleMobileBtn')].filter(Boolean);
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem('mudanzas14_theme', newTheme);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const iconClass = theme === 'dark' ? 'fa-sun' : 'fa-moon';
  [document.getElementById('themeToggleBtn'), document.getElementById('themeToggleMobileBtn')].forEach(btn => {
    if (btn) {
      btn.innerHTML = `<i class="fas ${iconClass}"></i>`;
      btn.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
  });
}

/* ── Tab Views Navigation (Pestañas en vez de una sola página corrida) ── */
function initTabs() {
  document.querySelectorAll('[data-tab], [data-tab-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      const targetTab = el.dataset.tab || el.dataset.tabNav;
      if (!targetTab) return;
      e.preventDefault();
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // Hide all view tab panes
  document.querySelectorAll('.view-tab-pane').forEach(p => p.classList.remove('active'));

  // Show target tab pane
  const pane = document.getElementById('tab-' + tabId);
  if (pane) {
    pane.classList.add('active');
  }

  // Update active status on nav links
  document.querySelectorAll('.navbar-links a[data-tab], .mobile-menu a[data-tab]').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === tabId);
  });

  // Scroll smoothly to top of window
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Invalidate map size if switching to cotizador tab
  if (tabId === 'cotizador' && window.MapState && window.MapState.map) {
    setTimeout(() => window.MapState.map.invalidateSize(), 200);
  }
}

/* ── Navbar ── */
function initNavbar() {
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
  }
}

/* ── Hero CTA ── */
function initHero() {
  document.querySelectorAll('[data-tab-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(el.dataset.tabNav);
    });
  });
}

/* ── Load Contact Info ── */
function loadContact() {
  const cfg = window.MudanzasCalc.getConfig();

  // Hero WA buttons
  const waHref = `https://wa.me/${cfg.contact.whatsapp}?text=Hola,%20me%20interesa%20una%20cotización%20de%20mudanza`;
  ['waBtn', 'waFloat', 'waContactLink'].forEach(id => {  // FIX #3: waContactLink added
    const el = document.getElementById(id);
    if (el) el.href = waHref;
  });

  // Update link text
  const waContactLink = document.getElementById('waContactLink');
  if (waContactLink) waContactLink.textContent = cfg.contact.whatsapp;

  // Contact section
  setTextById('contactPhone',   cfg.contact.phone);
  setTextById('contactEmail',   cfg.contact.email);
  setTextById('contactAddress', cfg.contact.address);
  setTextById('contactHours',   cfg.contact.hours);

  // Update phone link href
  const phoneLink = document.getElementById('contactPhoneLink');
  if (phoneLink) {
    const cleanPhone = (cfg.contact.phone || '').replace(/[^\d+]/g, '');
    phoneLink.href = `tel:${cleanPhone}`;
  }
}

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ─────────────────────────────────────
   QUOTE FORM
───────────────────────────────────── */
function initQuoteForm() {
  renderUnitCards();
  renderExtras();
  renderFurnitureTabs();

  // Step navigation breadcrumb buttons
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.step)));
  });

  // FIX #2: km slider/value listeners REMOVED from here — maps.js handles them entirely
  // (maps.js DOMContentLoaded runs before this and sets up the slider correctly)

  // Quote form submit
  const quoteForm = document.getElementById('quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', e => {
      e.preventDefault();
      submitQuote();
    });
  }

  // Step next/prev buttons
  document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.next)));
  });
  document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.prev)));
  });

  updatePricePreview();
}

/* ── Unit Cards ── */
function renderUnitCards() {
  const cfg       = window.MudanzasCalc.getConfig();
  const container = document.getElementById('unitGrid');
  if (!container) return;
  container.innerHTML = '';
  cfg.units.filter(u => u.active).forEach(unit => {
    const isSelected = quoteData.unitId === unit.id;
    const card = document.createElement('label');
    card.className = 'unit-card' + (isSelected ? ' selected' : '');
    card.innerHTML = `
      <input type="radio" name="unit" value="${unit.id}" ${isSelected ? 'checked' : ''}>
      <i class="fas ${unit.icon} unit-icon"></i>
      <div class="unit-info">
        <div class="unit-name">${unit.name}</div>
        <div class="unit-cap">${unit.capacity}</div>
      </div>
      <div class="unit-price">${window.MudanzasCalc.formatMXN(unit.basePrice)}</div>
      <span class="unit-check"><i class="fas fa-check"></i></span>
    `;
    card.querySelector('input').addEventListener('change', () => {
      document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      quoteData.unitId = unit.id;
      updatePricePreview();
    });
    container.appendChild(card);
  });
}

/* ── Extras ── */
function renderExtras() {
  const cfg       = window.MudanzasCalc.getConfig();
  const container = document.getElementById('extrasGrid');
  if (!container) return;
  container.innerHTML = '';
  cfg.extras.filter(extra => extra.active !== false).forEach(extra => {
    const isChecked = quoteData.extraIds.includes(extra.id);
    const item = document.createElement('label');
    item.className = 'extra-item' + (isChecked ? ' checked' : '');
    item.innerHTML = `
      <input type="checkbox" value="${extra.id}" ${isChecked ? 'checked' : ''}>
      <i class="fas ${extra.icon}" style="color:var(--red);flex-shrink:0"></i>
      <div class="extra-label">
        <strong>${extra.name}</strong>
        <span>${extra.desc}</span>
      </div>
      <span class="extra-price">+${window.MudanzasCalc.formatMXN(extra.price)}</span>
    `;
    item.querySelector('input').addEventListener('change', e => {
      item.classList.toggle('checked', e.target.checked);
      if (e.target.checked) {
        if (!quoteData.extraIds.includes(extra.id)) quoteData.extraIds.push(extra.id);
      } else {
        quoteData.extraIds = quoteData.extraIds.filter(id => id !== extra.id);
      }
      updatePricePreview();
    });
    container.appendChild(item);
  });
}

/* ── Furniture Tabs & Panels ── */
function renderFurnitureTabs() {
  const tabsContainer   = document.getElementById('roomTabs');
  const panelsContainer = document.getElementById('furniturePanels');
  if (!tabsContainer || !panelsContainer) return;
  tabsContainer.innerHTML   = '';
  panelsContainer.innerHTML = '';

  Object.entries(FURNITURE_CATALOG).forEach(([roomKey, room], i) => {
    // Tab button
    const tab = document.createElement('button');
    tab.className    = 'room-tab' + (i === 0 ? ' active' : '');
    tab.dataset.room = roomKey;
    tab.type         = 'button';
    tab.innerHTML    = `<i class="fas ${room.icon}"></i> ${room.label}`;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.room-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.furniture-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel_' + roomKey).classList.add('active');
    });
    tabsContainer.appendChild(tab);

    // Panel
    const panel    = document.createElement('div');
    panel.className = 'furniture-panel' + (i === 0 ? ' active' : '');
    panel.id        = 'panel_' + roomKey;
    const itemsDiv  = document.createElement('div');
    itemsDiv.className = 'furniture-items';

    room.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'furniture-item';
      el.innerHTML = `
        <i class="fas ${item.icon} furniture-item-icon"></i>
        <div class="furniture-item-name">
          ${item.name}
          ${item.note ? `<small>${item.note}</small>` : ''}
        </div>
        <div class="qty-controls">
          <button type="button" class="qty-btn" data-action="dec"><i class="fas fa-minus"></i></button>
          <input type="number" class="qty-input" value="0" min="0" max="20" readonly>
          <button type="button" class="qty-btn" data-action="inc"><i class="fas fa-plus"></i></button>
        </div>
      `;
      el.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const inp = el.querySelector('.qty-input');
          let val = parseInt(inp.value) || 0;
          val = btn.dataset.action === 'inc' ? Math.min(20, val + 1) : Math.max(0, val - 1);
          inp.value = val;
          if (!quoteData.furniture[roomKey]) quoteData.furniture[roomKey] = {};
          quoteData.furniture[roomKey][item.id] = val;
          updateFurnitureSummary();
        });
      });
      itemsDiv.appendChild(el);
    });

    panel.appendChild(itemsDiv);
    panelsContainer.appendChild(panel);
  });
}

/* ── Furniture Summary Badge ── */
function updateFurnitureSummary() {
  let total = 0;
  Object.values(quoteData.furniture).forEach(room => {
    Object.values(room).forEach(qty => { total += parseInt(qty) || 0; });
  });
  const summaryEl = document.getElementById('furnitureSummary');
  const textEl    = document.getElementById('furnitureSummaryText');
  if (summaryEl && textEl) {
    textEl.textContent   = `${total} artículo${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`;
    summaryEl.style.display = total > 0 ? 'flex' : 'none';
  }
}

/* ── Price Preview ── */
function updatePricePreview() {
  const amountEl    = document.getElementById('priceAmount');
  const breakdownEl = document.getElementById('priceBreakdown');
  if (!amountEl || !breakdownEl) return;

  if (!quoteData.unitId) {
    amountEl.textContent   = '$0';
    breakdownEl.innerHTML  = '<div class="price-line"><span class="price-label"><i class="fas fa-info-circle"></i> Selecciona una unidad para ver el desglose</span><span>—</span></div>';
    return;
  }

  const result = window.MudanzasCalc.calculateQuote(quoteData);
  quoteResult  = result;
  if (!result) return;

  const fmt = window.MudanzasCalc.formatMXN;
  amountEl.textContent = fmt(result.total);

  let html = `
    <div class="price-line"><span class="price-label"><i class="fas fa-truck"></i> Precio base (${result.unit.name})</span><span>${fmt(result.basePrice)}</span></div>
    <div class="price-line"><span class="price-label"><i class="fas fa-road"></i> Costo por km (${result.km} km · ${result.rangeLabel})</span><span>${fmt(result.kmCost)}</span></div>
  `;
  result.extrasDetail.forEach(e => {
    html += `<div class="price-line"><span class="price-label"><i class="fas fa-plus-circle"></i> ${e.name}</span><span>${fmt(e.price)}</span></div>`;
  });
  html += `
    <div class="price-line"><span class="price-label"><i class="fas fa-receipt"></i> Subtotal</span><span>${fmt(result.subtotal)}</span></div>
    <div class="price-line"><span class="price-label"><i class="fas fa-percentage"></i> IVA (16%)</span><span>${fmt(result.iva)}</span></div>
    <div class="price-line" style="font-weight:700;font-size:.9rem;color:var(--white)"><span>TOTAL ESTIMADO</span><span style="color:var(--red)">${fmt(result.total)}</span></div>
  `;
  breakdownEl.innerHTML = html;
}

/* ── Step navigation ── */
function goToStep(step) {
  // Validate ONLY when moving forward
  if (step > currentStep) {
    // If leaving Step 1, ensure origin & destination are provided
    if (currentStep === 1) {
      const orig = (document.getElementById('origen')?.value || '').trim();
      const dest = (document.getElementById('destino')?.value || '').trim();
      if (!orig || !dest) {
        showToast('Por favor escribe tu dirección de origen y destino', 'error');
        return;
      }
    }
    // Cannot skip past Step 2 (e.g. clicking directly on step 3, 4 or 5) without selecting a unit
    if (step > 2 && !quoteData.unitId) {
      showToast('Por favor selecciona un tipo de unidad', 'error');
      goToStep(2);
      return;
    }
  }

  currentStep = step;
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.getElementById('step' + step);
  if (stepEl) stepEl.classList.add('active');

  document.querySelectorAll('.step-btn').forEach(btn => {
    const n = parseInt(btn.dataset.step);
    btn.classList.remove('active', 'done');
    if (n === step) btn.classList.add('active');
    else if (n < step) btn.classList.add('done');
  });

  // If entering step 1 and map exists, refresh size
  if (step === 1 && window.MapState && window.MapState.map) {
    setTimeout(() => window.MapState.map.invalidateSize(), 150);
  }
}


/* ── Submit Quote ── */
function submitQuote() {
  // FIX #7: use document.getElementById directly (not form.querySelector for top-level ids)
  const nombre   = (document.getElementById('clientName')?.value  || '').trim();
  const telefono = (document.getElementById('clientPhone')?.value  || '').trim();
  const email    = (document.getElementById('clientEmail')?.value  || '').trim();
  const notas    = (document.getElementById('clientNotes')?.value  || '').trim();
  const origen   = (document.getElementById('origen')?.value       || '').trim();
  const destino  = (document.getElementById('destino')?.value      || '').trim();
  const fecha    = (document.getElementById('fechaMudanza')?.value || '').trim();
  const tipoServ = (document.getElementById('tipoServicio')?.value || '').trim();

  if (!nombre || !telefono) {
    showToast('Por favor ingresa tu nombre y teléfono', 'error');
    return;
  }
  if (!origen || !destino) {
    showToast('Por favor completa las direcciones de origen y destino', 'error');
    return;
  }
  if (!quoteData.unitId) {
    showToast('Por favor selecciona un tipo de unidad', 'error');
    goToStep(2);
    return;
  }

  // Coordenadas y enlaces a Google Maps
  const coordsOrigen  = window.MapState?.coords?.origen;
  const coordsDestino = window.MapState?.coords?.destino;

  let origenTexto = origen;
  let gmapsOrigen = '';
  if (coordsOrigen && coordsOrigen.lat != null && coordsOrigen.lon != null) {
    const latO = Number(coordsOrigen.lat).toFixed(6);
    const lonO = Number(coordsOrigen.lon).toFixed(6);
    gmapsOrigen = `https://www.google.com/maps?q=${latO},${lonO}`;
    if (coordsOrigen.isPinAdjusted || (coordsOrigen.display && coordsOrigen.display.includes('(ajustado)'))) {
      origenTexto = `${origen} (📍 Punto ajustado: ${latO}, ${lonO})`;
    }
  }

  let destinoTexto = destino;
  let gmapsDestino = '';
  if (coordsDestino && coordsDestino.lat != null && coordsDestino.lon != null) {
    const latD = Number(coordsDestino.lat).toFixed(6);
    const lonD = Number(coordsDestino.lon).toFixed(6);
    gmapsDestino = `https://www.google.com/maps?q=${latD},${lonD}`;
    if (coordsDestino.isPinAdjusted || (coordsDestino.display && coordsDestino.display.includes('(ajustado)'))) {
      destinoTexto = `${destino} (📍 Punto ajustado: ${latD}, ${lonD})`;
    }
  }

  // Build furniture list in tabular format
  let furnitureTotal = 0;
  let furnitureRows  = [];
  Object.entries(quoteData.furniture).forEach(([roomKey, items]) => {
    const room = FURNITURE_CATALOG[roomKey];
    if (!room) return;
    Object.entries(items).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const fi = room.items.find(i => i.id === itemId);
        if (fi) {
          furnitureTotal += qty;
          const qtyStr = String(qty).padStart(2, ' ') + 'x';
          furnitureRows.push(` ${qtyStr}  ${fi.name} (${room.label})`);
        }
      }
    });
  });

  let furnitureBlock = '';
  if (furnitureRows.length > 0) {
    furnitureBlock =
      `📦 *INVENTARIO PRELIMINAR (${furnitureTotal} artículos):*\n` +
      '```\n' +
      'CANT  ARTÍCULO\n' +
      '--------------------------------\n' +
      furnitureRows.join('\n') + '\n' +
      '```\n' +
      '📄 _(Detalle completo disponible en PDF adjunto)_\n';
  }

  quoteResult = window.MudanzasCalc.calculateQuote(quoteData);
  const fmt   = window.MudanzasCalc.formatMXN;

  // Show result card
  const quoteCard = document.getElementById('quoteCard');
  const resultEl  = document.getElementById('quoteResult');
  if (quoteCard)  quoteCard.style.display = 'none';
  if (!resultEl)  return;
  resultEl.classList.add('show');

  const amountEl = document.getElementById('resultAmount');
  const nameEl   = document.getElementById('resultName');
  if (amountEl) amountEl.textContent = fmt(quoteResult.total);
  if (nameEl)   nameEl.textContent   = nombre;

  // WhatsApp message formatting
  const cfg = window.MudanzasCalc.getConfig();
  const extrasNames = (quoteData.extraIds || [])
    .map(id => cfg.extras.find(e => e.id === id)?.name)
    .filter(Boolean);

  const modoDist = window.MapState?.isManualMode ? 'Ajuste manual' : 'Cálculo vial por mapa';

  let msgLines = [
    `🚚 *SOLICITUD DE COTIZACIÓN — MUDANZAS D'LA 14*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Cliente:* ${nombre}`,
    `📱 *Teléfono:* ${telefono}`
  ];

  if (email) {
    msgLines.push(`✉️ *Correo:* ${email}`);
  }

  msgLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  msgLines.push(`📍 *Origen:* ${origenTexto}`);
  if (gmapsOrigen) {
    msgLines.push(`   🗺️ *Abrir en Google Maps:* ${gmapsOrigen}`);
  }

  msgLines.push(`📍 *Destino:* ${destinoTexto}`);
  if (gmapsDestino) {
    msgLines.push(`   🗺️ *Abrir en Google Maps:* ${gmapsDestino}`);
  }

  msgLines.push(`📏 *Distancia:* ${quoteResult.km} km (${modoDist})`);

  msgLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
  msgLines.push(`🚛 *Unidad solicitada:* ${quoteResult.unit.name}`);

  if (extrasNames.length > 0) {
    msgLines.push(`✨ *Servicios adicionales:* ${extrasNames.join(', ')}`);
  }
  if (fecha) {
    msgLines.push(`📅 *Fecha tentativa:* ${fecha}`);
  }
  if (tipoServ) {
    const tipos = { local: 'Mudanza local', foraneo: 'Mudanza foránea', flete: 'Solo flete', compartida: 'Mudanza compartida' };
    msgLines.push(`🏷️ *Tipo de servicio:* ${tipos[tipoServ] || tipoServ}`);
  }

  if (furnitureBlock) {
    msgLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`);
    msgLines.push(furnitureBlock.trim());
  }

  msgLines.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *TOTAL ESTIMADO:* ${fmt(quoteResult.total)} (IVA incluido)`,
    `⏳ *Vigencia de cotización:* 48 horas`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⭐ *¿DESEAS UN DESCUENTO EXTRA?*`,
    `Déjanos tu reseña o referencia en Google y compártenos una captura de pantalla:`,
    `👉 https://g.page/r/CS4RBcHPgBYjEBM/review`
  );

  if (notas) {
    msgLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━`, `📝 *Notas:* ${notas}`);
  }

  const rawMsg = msgLines.join('\n');
  const msg    = encodeURIComponent(rawMsg);
  const waBtn  = document.getElementById('resultWaBtn');
  if (waBtn) waBtn.href = `https://wa.me/${cfg.contact.whatsapp}?text=${msg}`;

  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Generate PDF ── */
function generatePDF() {
  if (!quoteResult) { showToast('Primero completa la cotización', 'error'); return; }
  const nombre   = (document.getElementById('clientName')?.value  || '').trim();
  const telefono = (document.getElementById('clientPhone')?.value || '').trim();
  const email    = (document.getElementById('clientEmail')?.value || '').trim();
  const origen   = (document.getElementById('origen')?.value       || '').trim();
  const destino  = (document.getElementById('destino')?.value      || '').trim();
  const fmt      = window.MudanzasCalc.formatMXN;

  if (!window.jspdf) { showToast('Error cargando jsPDF. Verifica tu conexión.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(225, 29, 29);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text("MUDANZAS D'LA 14", W / 2, 13, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('"EL MEJOR SERVICIO AL MEJOR PRECIO"', W / 2, 20, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Folio: MDL14-${Date.now().toString().slice(-6)}  |  Fecha: ${new Date().toLocaleDateString('es-MX')}`, W / 2, 26, { align: 'center' });

  // Client info
  doc.setTextColor(13, 13, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DATOS DEL CLIENTE', 15, 39);
  doc.setFillColor(240, 240, 240);
  const clientBoxH = email ? 32 : 25;
  doc.rect(14, 42, W - 28, clientBoxH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Cliente:   ${nombre}  ${telefono ? `(${telefono})` : ''}`, 18, 49);
  let curY = 56;
  if (email) {
    doc.text(`Correo:    ${email}`, 18, curY);
    curY += 7;
  }
  doc.text(`Origen:    ${origen}`, 18, curY);
  curY += 7;
  doc.text(`Destino:   ${destino}`, 18, curY);

  // Service detail
  const detailHeaderY = 42 + clientBoxH + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DETALLE DEL SERVICIO', 15, detailHeaderY);
  const rows = [
    ['Unidad',                quoteResult.unit.name],
    ['Distancia',             `${quoteResult.km} km (${quoteResult.rangeLabel})`],
    ['Precio base',           fmt(quoteResult.basePrice)],
    ['Costo por km',          fmt(quoteResult.kmCost)],
    ['Servicios adicionales', fmt(quoteResult.extrasCost)],
    ['Subtotal',              fmt(quoteResult.subtotal)],
    ['IVA (16%)',             fmt(quoteResult.iva)],
  ];
  let y = detailHeaderY + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  rows.forEach((row, i) => {
    if (i % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(14, y - 4, W - 28, 8, 'F'); }
    doc.setTextColor(13, 13, 13);
    doc.text(row[0], 18, y);
    doc.text(row[1], W - 18, y, { align: 'right' });
    y += 9;
  });

  // Total row
  doc.setFillColor(225, 29, 29);
  doc.rect(14, y - 3, W - 28, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('TOTAL ESTIMADO (IVA incluido)', 18, y + 4);
  doc.text(fmt(quoteResult.total), W - 18, y + 4, { align: 'right' });
  y += 18;

  // Furniture
  const furnitureItems = [];
  Object.entries(quoteData.furniture).forEach(([roomKey, items]) => {
    const room = FURNITURE_CATALOG[roomKey];
    if (!room) return;
    Object.entries(items).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const fi = room.items.find(i => i.id === itemId);
        if (fi) furnitureItems.push(`${qty}x ${fi.name} (${room.label})`);
      }
    });
  });
  if (furnitureItems.length > 0) {
    doc.setTextColor(13, 13, 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('INVENTARIO PRELIMINAR', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    furnitureItems.forEach((item, i) => {
      if (i % 2 === 0) { doc.setFillColor(248,248,248); doc.rect(14, y - 3.5, W - 28, 7, 'F'); }
      doc.setTextColor(13, 13, 13);
      doc.text(`• ${item}`, 18, y);
      y += 7;
      if (y > 260) { doc.addPage(); y = 20; }
    });
    y += 4;
  }

  // Footer
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('Esta cotización es un estimado. El precio final puede variar según condiciones reales del servicio.', W / 2, y + 6, { align: 'center' });
  doc.text('Válido por 48 horas. Mudanzas D\'La 14 — El mejor servicio al mejor precio.', W / 2, y + 11, { align: 'center' });
  doc.setTextColor(180, 80, 0);
  doc.text('⭐ Descuento extra: Deja tu reseña en https://g.page/r/CS4RBcHPgBYjEBM/review y envíanos captura.', W / 2, y + 16, { align: 'center' });

  doc.save(`Cotizacion_MudanzasDLa14_${Date.now()}.pdf`);
  showToast('PDF descargado correctamente ✓', 'success');
}

/* ── Reset Quote ── */
function resetQuote() {
  // FIX #1: use Object.assign to mutate existing object (window.quoteData keeps its reference)
  Object.assign(quoteData, { km: 50, unitId: null, extraIds: [], furniture: {} });

  quoteResult = null;

  const resultEl  = document.getElementById('quoteResult');
  const quoteCard = document.getElementById('quoteCard');
  if (resultEl)  resultEl.classList.remove('show');
  if (quoteCard) quoteCard.style.display = 'block';

  // Reset form fields
  const form = document.getElementById('quoteForm');
  if (form) form.reset();

  // Reset UI state
  document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.extra-item').forEach(e => e.classList.remove('checked'));
  document.querySelectorAll('.qty-input').forEach(inp => { inp.value = 0; });

  // Reset manual address banner
  const manualNotice = document.getElementById('manualAddressNotice');
  if (manualNotice) manualNotice.style.display = 'none';

  // Reset map state
  if (window.MapState) {
    if (window.MapState.markerOrigen) { window.MapState.markerOrigen.remove(); window.MapState.markerOrigen = null; }
    if (window.MapState.markerDest) { window.MapState.markerDest.remove(); window.MapState.markerDest = null; }
    if (window.MapState.routeLine) { window.MapState.routeLine.remove(); window.MapState.routeLine = null; }
    window.MapState.coords.origen  = null;
    window.MapState.coords.destino = null;
    window.MapState.isManualMode   = true;
  }
  ['origenCoords','destinoCoords'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.className = 'addr-coords';
    }
  });
  const mapWrapper = document.getElementById('mapWrapper');
  if (mapWrapper) mapWrapper.classList.remove('visible');
  document.getElementById('routeInfo')  && (document.getElementById('routeInfo').style.display  = 'none');
  document.getElementById('routeCalc')  && (document.getElementById('routeCalc').style.display  = 'none');
  document.getElementById('routeError') && (document.getElementById('routeError').style.display = 'none');

  // Reset km
  if (typeof window.setKmValue === 'function') window.setKmValue(50, 'manual');

  goToStep(1);
  updatePricePreview();
  document.getElementById('cotizador')?.scrollIntoView({ behavior: 'smooth' });
}

/* ── FAQ Accordion ── */
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item    = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

/* ── Contact Form ── */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const cfg      = window.MudanzasCalc.getConfig();
    const nombre   = (form.querySelector('[name="nombre"]')?.value   || '').trim();
    const telefono = (form.querySelector('[name="telefono"]')?.value || '').trim();
    const mensaje  = (form.querySelector('[name="mensaje"]')?.value  || '').trim();
    if (!nombre || !telefono) {
      showToast('Por favor completa nombre y teléfono', 'error');
      return;
    }
    const waMsg = encodeURIComponent(`Hola, soy ${nombre} (${telefono}).\n${mensaje}`);
    window.open(`https://wa.me/${cfg.contact.whatsapp}?text=${waMsg}`, '_blank');
    showToast('Redirigiendo a WhatsApp... ✓', 'success');
    form.reset();
  });
}

/* ── Toast notification ── */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = toast.className.replace('show', '').trim();
  }, 3500);
}

/* ── Global exports ── */
window.generatePDF        = generatePDF;
window.resetQuote         = resetQuote;
window.showToast          = showToast;
window.updatePricePreview = updatePricePreview;
