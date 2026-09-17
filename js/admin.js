/**
 * admin.js — Panel de Administración
 * Mudanzas D'La 14
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  initLogin();
});

/* ── Theme (Claro / Oscuro) ── */
function initTheme() {
  const savedTheme = localStorage.getItem('mudanzas14_theme') || 'dark';
  applyTheme(savedTheme);

  const btn = document.getElementById('themeToggleAdminBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem('mudanzas14_theme', newTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleAdminBtn');
  if (btn) {
    btn.innerHTML = `<i class="fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`;
    btn.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  }
}

/* ── Clock ── */
function initClock() {
  function tick() {
    const now = new Date();
    const el = document.getElementById('adminClock');
    if (el) el.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 60000);
}

/* ── Login ── */
function initLogin() {
  const pwInput  = document.getElementById('loginPassword');
  const pwToggle = document.getElementById('pwToggle');
  const loginBtn = document.getElementById('loginBtn');
  const loginErr = document.getElementById('loginError');

  if (pwToggle && pwInput) {
    pwToggle.addEventListener('click', () => {
      const show = pwInput.type === 'password';
      pwInput.type = show ? 'text' : 'password';
      pwToggle.innerHTML = `<i class="fas fa-eye${show ? '-slash' : ''}"></i>`;
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', attemptLogin);
  }
  if (pwInput) {
    pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });
  }

  function attemptLogin() {
    const cfg = window.MudanzasCalc.getConfig();
    const entered = pwInput ? pwInput.value : '';
    if (entered === cfg.password) {
      loginErr && loginErr.classList.remove('show');
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('adminApp').classList.add('show');
      initAdminApp();
    } else {
      if (loginErr) loginErr.classList.add('show');
      if (pwInput) { pwInput.value = ''; pwInput.focus(); }
    }
  }
}

/* ── Admin App ── */
function initAdminApp() {
  loadAllSettings();
  renderDashboard();
  initSidebar();
  initSaveButtons();
  initPasswordChange();
  initResetButtons();
}

/* ── Sidebar Navigation ── */
function initSidebar() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      const panel = link.dataset.panel;
      if (!panel) return;
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      const panelEl = document.getElementById('panel' + panel.charAt(0).toUpperCase() + panel.slice(1));
      if (panelEl) panelEl.classList.add('active');
      // Update topbar title
      document.getElementById('panelTitle').innerHTML = `<i class="fas ${link.dataset.icon || 'fa-cog'}"></i> ${link.textContent.trim()}`;
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('¿Cerrar sesión del panel de administración?')) {
      document.getElementById('adminApp').classList.remove('show');
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('loginPassword').value = '';
    }
  });
}

/* ── Dashboard ── */
function renderDashboard() {
  const cfg = window.MudanzasCalc.getConfig();
  const activeUnits = cfg.units.filter(u => u.active).length;
  document.getElementById('dashUnits').textContent   = activeUnits;
  document.getElementById('dashExtras').textContent  = cfg.extras.length;
  document.getElementById('dashContact').textContent = cfg.contact.phone;

  // Min price
  const minPrice = Math.min(...cfg.units.filter(u => u.active).map(u => u.basePrice));
  document.getElementById('dashMinPrice').textContent = window.MudanzasCalc.formatMXN(minPrice);
}

/* ── Load All Settings into Forms ── */
function loadAllSettings() {
  const cfg = window.MudanzasCalc.getConfig();

  // Contact
  document.getElementById('adminPhone').value   = cfg.contact.phone;
  document.getElementById('adminEmail').value   = cfg.contact.email;
  document.getElementById('adminAddress').value = cfg.contact.address;
  document.getElementById('adminHours').value   = cfg.contact.hours;
  document.getElementById('adminWhatsapp').value = cfg.contact.whatsapp;

  // Distance ranges
  const dr = cfg.distanceRanges;
  document.getElementById('localMax').value        = dr.local.max;
  document.getElementById('foraneoMax').value      = dr.foraneo.max;
  document.getElementById('localMult').value       = dr.local.multiplier;
  document.getElementById('foraneoMult').value     = dr.foraneo.multiplier;
  document.getElementById('largoMult').value       = dr.largo.multiplier;

  // Units table
  renderUnitsTable(cfg);

  // Extras table
  renderExtrasTable(cfg);
}

/* ── Units Table (CRUD) ── */
function renderUnitsTable(cfg) {
  const tbody = document.getElementById('unitsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  cfg.units.forEach((unit, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:.5rem">
          <i class="fas ${unit.icon || 'fa-truck'}" style="color:var(--red)"></i>
          <input type="text" value="${unit.name}" data-field="name" data-idx="${idx}" style="min-width:130px;font-weight:600">
        </div>
      </td>
      <td>
        <input type="text" value="${unit.capacity || ''}" data-field="capacity" data-idx="${idx}" style="min-width:180px;font-size:.82rem">
      </td>
      <td>
        <input type="number" value="${unit.basePrice}" min="0" data-field="basePrice" data-idx="${idx}" style="width:85px">
      </td>
      <td>
        <input type="number" value="${unit.pricePerKm}" min="0" step="0.5" data-field="pricePerKm" data-idx="${idx}" style="width:75px">
      </td>
      <td>
        <label class="unit-active-toggle" title="Ocultar o mostrar al cliente">
          <input type="checkbox" ${unit.active ? 'checked' : ''} data-field="active" data-idx="${idx}">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button type="button" class="btn-delete-item" data-action="delete-unit" data-idx="${idx}" title="Eliminar unidad" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:.95rem;padding:.3rem .5rem">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Wire delete buttons
  tbody.querySelectorAll('[data-action="delete-unit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const cfgNow = window.MudanzasCalc.getConfig();
      if (cfgNow.units.length <= 1) {
        showAdminToast('Debe existir al menos una unidad', 'error');
        return;
      }
      if (confirm(`¿Eliminar la unidad "${cfgNow.units[idx].name}"?`)) {
        cfgNow.units.splice(idx, 1);
        window.MudanzasCalc.saveConfig(cfgNow);
        renderUnitsTable(cfgNow);
        renderDashboard();
        showAdminToast('Unidad eliminada ✓', 'success');
      }
    });
  });
}

/* ── Extras Table (CRUD) ── */
function renderExtrasTable(cfg) {
  const tbody = document.getElementById('extrasTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  cfg.extras.forEach((extra, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:.5rem">
          <i class="fas ${extra.icon || 'fa-plus-circle'}" style="color:var(--red)"></i>
          <input type="text" value="${extra.name}" data-field="name" data-idx="${idx}" style="min-width:130px;font-weight:600">
        </div>
      </td>
      <td>
        <input type="text" value="${extra.desc || ''}" data-field="desc" data-idx="${idx}" style="min-width:180px;font-size:.82rem">
      </td>
      <td>
        <input type="number" value="${extra.price}" min="0" data-field="price" data-idx="${idx}" style="width:85px">
      </td>
      <td>
        <label class="unit-active-toggle" title="Ocultar o mostrar al cliente">
          <input type="checkbox" ${extra.active !== false ? 'checked' : ''} data-field="active" data-idx="${idx}">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button type="button" class="btn-delete-item" data-action="delete-extra" data-idx="${idx}" title="Eliminar servicio" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:.95rem;padding:.3rem .5rem">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Wire delete buttons
  tbody.querySelectorAll('[data-action="delete-extra"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const cfgNow = window.MudanzasCalc.getConfig();
      if (confirm(`¿Eliminar el servicio "${cfgNow.extras[idx].name}"?`)) {
        cfgNow.extras.splice(idx, 1);
        window.MudanzasCalc.saveConfig(cfgNow);
        renderExtrasTable(cfgNow);
        renderDashboard();
        showAdminToast('Servicio eliminado ✓', 'success');
      }
    });
  });
}

/* ── Save Buttons & New Item Listeners ── */
function initSaveButtons() {
  // Add Unit button
  const btnAddUnit = document.getElementById('btnAddUnit');
  if (btnAddUnit) {
    btnAddUnit.addEventListener('click', () => {
      const cfg = window.MudanzasCalc.getConfig();
      const newId = 'unit_' + Date.now().toString(36);
      cfg.units.push({
        id: newId,
        name: 'Nueva Unidad',
        capacity: 'Capacidad estimada',
        basePrice: 1000,
        pricePerKm: 15,
        icon: 'fa-truck',
        active: true
      });
      window.MudanzasCalc.saveConfig(cfg);
      renderUnitsTable(cfg);
      renderDashboard();
      showAdminToast('Nueva unidad agregada. Puedes editar sus datos y guardar.', 'success');
    });
  }

  // Add Extra button
  const btnAddExtra = document.getElementById('btnAddExtra');
  if (btnAddExtra) {
    btnAddExtra.addEventListener('click', () => {
      const cfg = window.MudanzasCalc.getConfig();
      const newId = 'extra_' + Date.now().toString(36);
      cfg.extras.push({
        id: newId,
        name: 'Nuevo Servicio',
        desc: 'Descripción del servicio',
        price: 350,
        icon: 'fa-plus-circle',
        active: true
      });
      window.MudanzasCalc.saveConfig(cfg);
      renderExtrasTable(cfg);
      renderDashboard();
      showAdminToast('Nuevo servicio adicional agregado. Edita sus datos y guarda.', 'success');
    });
  }

  // Save Contact
  document.getElementById('saveContact').addEventListener('click', () => {
    const cfg = window.MudanzasCalc.getConfig();
    cfg.contact.phone    = document.getElementById('adminPhone').value;
    cfg.contact.email    = document.getElementById('adminEmail').value;
    cfg.contact.address  = document.getElementById('adminAddress').value;
    cfg.contact.hours    = document.getElementById('adminHours').value;
    cfg.contact.whatsapp = document.getElementById('adminWhatsapp').value;
    window.MudanzasCalc.saveConfig(cfg);
    showSaveStatus('contactStatus');
    showAdminToast('Información de contacto guardada ✓', 'success');
  });

  // Save Distance Ranges
  document.getElementById('saveDistances').addEventListener('click', () => {
    const cfg = window.MudanzasCalc.getConfig();
    cfg.distanceRanges.local.max         = parseFloat(document.getElementById('localMax').value)    || 30;
    cfg.distanceRanges.foraneo.max       = parseFloat(document.getElementById('foraneoMax').value)  || 150;
    cfg.distanceRanges.local.multiplier  = parseFloat(document.getElementById('localMult').value)   || 1.0;
    cfg.distanceRanges.foraneo.multiplier= parseFloat(document.getElementById('foraneoMult').value) || 1.15;
    cfg.distanceRanges.largo.multiplier  = parseFloat(document.getElementById('largoMult').value)   || 1.25;
    cfg.distanceRanges.foraneo.min       = cfg.distanceRanges.local.max + 1;
    cfg.distanceRanges.largo.min         = cfg.distanceRanges.foraneo.max + 1;
    window.MudanzasCalc.saveConfig(cfg);
    showSaveStatus('distancesStatus');
    showAdminToast('Rangos de distancia guardados ✓', 'success');
  });

  // Save Units
  document.getElementById('saveUnits').addEventListener('click', () => {
    const cfg = window.MudanzasCalc.getConfig();
    document.querySelectorAll('#unitsTableBody [data-field]').forEach(inp => {
      const idx   = parseInt(inp.dataset.idx);
      const field = inp.dataset.field;
      if (!cfg.units[idx]) return;
      if (field === 'active') cfg.units[idx][field] = inp.checked;
      else if (field === 'basePrice' || field === 'pricePerKm') cfg.units[idx][field] = parseFloat(inp.value) || 0;
      else cfg.units[idx][field] = inp.value.trim();
    });
    window.MudanzasCalc.saveConfig(cfg);
    renderDashboard();
    showSaveStatus('unitsStatus');
    showAdminToast('Unidades actualizadas y guardadas ✓', 'success');
  });

  // Save Extras
  document.getElementById('saveExtras').addEventListener('click', () => {
    const cfg = window.MudanzasCalc.getConfig();
    document.querySelectorAll('#extrasTableBody [data-field]').forEach(inp => {
      const idx   = parseInt(inp.dataset.idx);
      const field = inp.dataset.field;
      if (!cfg.extras[idx]) return;
      if (field === 'active') cfg.extras[idx][field] = inp.checked;
      else if (field === 'price') cfg.extras[idx][field] = parseFloat(inp.value) || 0;
      else cfg.extras[idx][field] = inp.value.trim();
    });
    window.MudanzasCalc.saveConfig(cfg);
    renderDashboard();
    showSaveStatus('extrasStatus');
    showAdminToast('Servicios adicionales actualizados y guardados ✓', 'success');
  });
}

/* ── Password Change ── */
function initPasswordChange() {
  document.getElementById('savePassword').addEventListener('click', () => {
    const current  = document.getElementById('currentPw').value;
    const newPw    = document.getElementById('newPw').value;
    const confirmPw= document.getElementById('confirmPw').value;
    const cfg      = window.MudanzasCalc.getConfig();

    if (current !== cfg.password) {
      showAdminToast('La contraseña actual es incorrecta', 'error'); return;
    }
    if (newPw.length < 4) {
      showAdminToast('La nueva contraseña debe tener mínimo 4 caracteres', 'error'); return;
    }
    if (newPw !== confirmPw) {
      showAdminToast('Las contraseñas no coinciden', 'error'); return;
    }
    cfg.password = newPw;
    window.MudanzasCalc.saveConfig(cfg);
    document.getElementById('currentPw').value = '';
    document.getElementById('newPw').value     = '';
    document.getElementById('confirmPw').value = '';
    showAdminToast('Contraseña actualizada correctamente ✓', 'success');
  });
}

/* ── Reset Buttons ── */
function initResetButtons() {
  document.querySelectorAll('[data-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('¿Restablecer todos los valores a los predeterminados? Esta acción no se puede deshacer.')) return;
      window.MudanzasCalc.saveConfig(JSON.parse(JSON.stringify(window.MudanzasCalc.DEFAULT_CONFIG)));
      loadAllSettings();
      renderDashboard();
      showAdminToast('Configuración restablecida ✓', 'success');
    });
  });
}

/* ── Save Status ── */
function showSaveStatus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── Admin Toast ── */
function showAdminToast(msg, type = 'success') {
  const toast = document.getElementById('adminToast');
  if (!toast) return;
  const icon = toast.querySelector('i');
  const text = toast.querySelector('span');
  if (type === 'success') { icon.className = 'fas fa-check-circle success-icon'; }
  else { icon.className = 'fas fa-exclamation-circle error-icon'; }
  text.textContent = msg;
  toast.className = `show ${type}`;
  setTimeout(() => { toast.className = toast.className.replace('show', '').trim(); }, 3500);
}
