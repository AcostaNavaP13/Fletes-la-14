/**
 * calculator.js — Motor de cálculo de precios
 * Mudanzas D'La 14
 */

const CONFIG_VERSION = 2; // Incrementar este número cada vez que cambies precios en GitHub para que se actualice a todos

const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  password: 'Pruebas1234',
  contact: {
    whatsapp: '5212221234567',
    phone: '(222) 123-4567',
    email: 'contacto@mudanzasdla14.com',
    address: 'Puebla, Puebla, México',
    hours: 'Lun–Sáb 7:00am – 8:00pm'
  },
  units: [
    { id: 'camioneta', name: 'Camioneta 1 Ton', icon: 'fa-truck-pickup', capacity: 'Hasta 1,000 kg / Estudio o 1 recámara', basePrice: 800,  pricePerKm: 12, active: true },
    { id: 'tres_ton',  name: 'Caja 3.5 Ton',   icon: 'fa-truck',        capacity: 'Hasta 3,500 kg / 2–3 recámaras',    basePrice: 1400, pricePerKm: 18, active: true },
    { id: 'cinco_ton', name: 'Camión 5 Ton',   icon: 'fa-truck',        capacity: 'Hasta 5,000 kg / 3–4 recámaras',    basePrice: 2200, pricePerKm: 25, active: true },
    { id: 'torton',    name: 'Tórton 10 Ton',  icon: 'fa-truck-moving', capacity: 'Hasta 10,000 kg / Casa completa',   basePrice: 3500, pricePerKm: 35, active: true }
  ],
  extras: [
    { id: 'embalaje',  name: 'Embalaje profesional', desc: 'Cajas, cinta y protección',  price: 600,  icon: 'fa-box', active: true },
    { id: 'maniobras', name: 'Carga y descarga',      desc: 'Personal especializado',     price: 500,  icon: 'fa-people-carry', active: true },
    { id: 'montaje',   name: 'Montaje de muebles',   desc: 'Armado en el destino',        price: 700,  icon: 'fa-tools', active: true },
    { id: 'seguro',    name: 'Seguro de bienes',     desc: 'Cobertura básica por daños',  price: 300,  icon: 'fa-shield-alt', active: true },
    { id: 'custodia',  name: 'Resguardo temporal',   desc: '24h en bodega segura',        price: 450,  icon: 'fa-warehouse', active: true },
    { id: 'piano',     name: 'Maniobra especial',    desc: 'Pianos, cajas fuertes, etc.', price: 1200, icon: 'fa-star-of-life', active: true }
  ],
  distanceRanges: {
    local:   { label: 'Local',             min: 0,   max: 30,  multiplier: 1.0 },
    foraneo: { label: 'Foráneo',           min: 31,  max: 150, multiplier: 1.15 },
    largo:   { label: 'Largo Recorrido',   min: 151, max: 1500, multiplier: 1.25 }
  }
};

/**
 * Load config from localStorage or use defaults
 */
function getConfig() {
  try {
    const stored = localStorage.getItem('mudanzas14_config');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Si la versión en el código es más reciente, forzar actualización para todos los usuarios
      if (!parsed.version || parsed.version < CONFIG_VERSION) {
        saveConfig(DEFAULT_CONFIG);
        return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      }
      // Migrate legacy password if it was admin14
      if (parsed.password === 'admin14') {
        parsed.password = 'Pruebas1234';
      }
      // Migrate legacy default address to Puebla
      if (parsed.contact && (!parsed.contact.address || parsed.contact.address.includes('Mérida') || parsed.contact.address.includes('Yucatán'))) {
        parsed.contact.address = 'Puebla, Puebla, México';
      }
      // Ensure extras have active attribute
      if (Array.isArray(parsed.extras)) {
        parsed.extras.forEach(e => {
          if (e.active === undefined) e.active = true;
          if (!e.icon) e.icon = 'fa-plus-circle';
        });
      }
      // Ensure units have all attributes
      if (Array.isArray(parsed.units)) {
        parsed.units.forEach(u => {
          if (u.active === undefined) u.active = true;
          if (!u.icon) u.icon = 'fa-truck';
        });
      }
      saveConfig(parsed);
      return parsed;
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/**
 * Save config to localStorage
 */
function saveConfig(config) {
  localStorage.setItem('mudanzas14_config', JSON.stringify(config));
}

/**
 * Calculate quote price
 * @param {Object} params
 * @param {string} params.unitId
 * @param {number} params.km
 * @param {string[]} params.extraIds
 * @returns {Object} breakdown
 */
function calculateQuote({ unitId, km, extraIds = [] }) {
  const config = getConfig();
  const unit = config.units.find(u => u.id === unitId);
  if (!unit) return null;

  // Determine range multiplier
  let multiplier = 1.0;
  const ranges = config.distanceRanges;
  if (km <= ranges.local.max) multiplier = ranges.local.multiplier;
  else if (km <= ranges.foraneo.max) multiplier = ranges.foraneo.multiplier;
  else multiplier = ranges.largo.multiplier;

  const basePrice    = unit.basePrice;
  const kmCost       = Math.round(km * unit.pricePerKm * multiplier);
  let   extrasCost   = 0;
  const extrasDetail = [];

  extraIds.forEach(id => {
    const extra = config.extras.find(e => e.id === id);
    if (extra) {
      extrasCost += extra.price;
      extrasDetail.push({ name: extra.name, price: extra.price });
    }
  });

  const subtotal = basePrice + kmCost + extrasCost;
  const iva      = Math.round(subtotal * 0.16);
  const total    = subtotal + iva;

  // Range label
  let rangeLabel = ranges.local.label;
  if (km > ranges.local.max && km <= ranges.foraneo.max) rangeLabel = ranges.foraneo.label;
  else if (km > ranges.foraneo.max) rangeLabel = ranges.largo.label;

  return {
    unit:        { name: unit.name, icon: unit.icon },
    km,
    rangeLabel,
    basePrice,
    kmCost,
    extrasCost,
    extrasDetail,
    subtotal,
    iva,
    total
  };
}

/**
 * Format currency (MXN)
 */
function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(amount);
}

// Export to global scope
window.MudanzasCalc = { getConfig, saveConfig, calculateQuote, formatMXN, DEFAULT_CONFIG };
