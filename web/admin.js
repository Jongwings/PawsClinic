// web/admin.js — unified admin client for GitHub Pages + Render API

// ---- API base (from admin.html) ----
const API = (window.API_BASE || 'https://pawsclinic-server.onrender.com').replace(/\/$/,'');


// ---- Element helpers (support both UIs) ----
const $ = (id) => document.getElementById(id);

const els = {
  // simple form UI
  status: $('status'),
  rows: $('rows') || $('tbody'),           // accept either id
  search: $('search'),
  refresh: $('refresh'),
  downloadCsv: $('download'),
  loginForm: $('admin-login-form'),
  secretInput: $('admin-secret'),
  clearSecret: $('clear-secret'),

  // two-panel UI (optional)
  loginScreen: $('login-screen'),
  adminPanel: $('admin-panel'),
  loginInput2: $('login-secret'),
  loginBtn2: $('login-btn'),
  loginErr2: $('login-error'),
  logoutBtn2: $('logout-btn'),

  // optional DB backup button (works in either UI)
  downloadDbBtn: $('downloadDbBtn'),
};

let ALL = [];

// ---- Secret helpers ----
function getSecret() {
  return localStorage.getItem('admin_secret') || '';
}
function setSecret(v) {
  localStorage.setItem('admin_secret', v);
  updateSecretStatus();
}
function clearSecret() {
  localStorage.removeItem('admin_secret');
  updateSecretStatus();
}
function updateSecretStatus() {
  const s = getSecret();
  const badge = $('secret-status');
  if (badge) badge.textContent = s ? 'Secret saved' : 'No secret saved';
}

// ---- Status helper ----
function showStatus(msg, kind = 'info') {
  if (!els.status) return;
  els.status.textContent = msg;
  els.status.className =
    kind === 'error' ? 'text-sm text-red-600 mb-2' : 'text-sm text-gray-600 mb-2';
}

// ---- API calls ----
async function testSecret(candidate) {
  try {
    const res = await fetch(`${API}/api/appointments`, {
      headers: { 'X-Admin-Secret': candidate },
    });
    const j = await res.json();
    return res.ok && j.success;
  } catch {
    return false;
  }
}

async function fetchAppointments() {
  const secret = getSecret();
  if (!secret) {
    showStatus('No secret — enter it above and click Save.');
    return;
  }
  showStatus('Loading…');
  try {
    const res = await fetch(`${API}/api/appointments`, {
      headers: { 'X-Admin-Secret': secret },
    });
    const j = await res.json();
    if (!res.ok || !j.success) throw new Error(j.error || 'Failed to fetch');
    ALL = j.appointments || [];
    showStatus(`Loaded ${ALL.length} rows.`);
    renderTable(ALL);
  } catch (e) {
    console.error(e);
    showStatus(`Error: ${e.message}`, 'error');
  }
}

async function downloadDb() {
  const secret = getSecret();
  if (!secret) {
    alert('You must be logged in to download the database.');
    return;
  }
  try {
    const res = await fetch(`${API}/api/download-db`, {
      headers: { 'X-Admin-Secret': secret },
    });
    if (!res.ok) throw new Error('Failed to download database');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments-backup-${new Date().toISOString().slice(0, 10)}.db`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('⚠️ Could not download database. Check the server logs.');
  }
}

// ---- Render helpers ----
function renderTable(rows) {
  if (!els.rows) return;
  const q = (els.search && els.search.value ? els.search.value : '').toLowerCase();

  const data = !q
    ? rows
    : rows.filter((r) => {
        const hay = `${r.owner_name} ${r.phone} ${r.email || ''} ${r.pet_name} ${r.species} ${r.service} ${r.notes || ''}`.toLowerCase();
        return hay.includes(q);
      });

  if (!data.length) {
    els.rows.innerHTML =
      '<tr><td colspan="10" class="text-center text-gray-400 py-4">No data available.</td></tr>';
    return;
  }

  els.rows.innerHTML = data
    .map(
      (r, i) => `
      <tr class="${i % 2 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100">
        <td class="p-2">${i + 1}</td>
        <td class="p-2">${r.created_at || ''}</td>
        <td class="p-2">${r.owner_name}</td>
        <td class="p-2">${r.phone}</td>
        <td class="p-2">${r.email || ''}</td>
        <td class="p-2">${r.pet_name}</td>
        <td class="p-2">${r.species}</td>
        <td class="p-2">${r.service}</td>
        <td class="p-2">${(r.preferred_date || '') + (r.preferred_time ? ' ' + r.preferred_time : '')}</td>
        <td class="p-2">${r.notes || ''}</td>
      </tr>`
    )
    .join('');
}

function toCSV(rows) {
  const header = [
    'id',
    'created_at',
    'owner_name',
    'phone',
    'email',
    'pet_name',
    'species',
    'service',
    'preferred_date',
    'preferred_time',
    'notes',
  ];
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) => header.map((k) => esc(r[k])).join(','));
  return [header.join(','), ...body].join('\n');
}

function downloadCSV() {
  const csv = toCSV(ALL);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointments.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Login flows (both UIs supported) ----
async function handleSimpleLoginSubmit(e) {
  e.preventDefault();
  const v = (els.secretInput && els.secretInput.value ? els.secretInput.value : '').trim();
  if (!v) return;
  if (!(await testSecret(v))) {
    showStatus('Invalid secret or server not reachable.', 'error');
    return;
  }
  setSecret(v);
  if (els.secretInput) els.secretInput.value = '';
  fetchAppointments();
}

async function handlePanelLogin() {
  const candidate = (els.loginInput2 && els.loginInput2.value ? els.loginInput2.value : '').trim();
  if (!candidate) {
    if (els.loginErr2) {
      els.loginErr2.textContent = 'Please enter your admin secret.';
      els.loginErr2.classList.remove('hidden');
    }
    return;
  }
  if (els.loginErr2) els.loginErr2.classList.add('hidden');
  if (els.loginBtn2) {
    els.loginBtn2.textContent = 'Testing...';
    els.loginBtn2.disabled = true;
  }
  const ok = await testSecret(candidate);
  if (!ok) {
    if (els.loginErr2) {
      els.loginErr2.textContent = 'Invalid secret or server not reachable.';
      els.loginErr2.classList.remove('hidden');
    }
    if (els.loginBtn2) {
      els.loginBtn2.textContent = 'Login';
      els.loginBtn2.disabled = false;
    }
    return;
  }
  setSecret(candidate);
  // switch panels if present
  if (els.loginScreen) els.loginScreen.classList.add('hidden');
  if (els.adminPanel) els.adminPanel.classList.remove('hidden');
  fetchAppointments();
}

function handlePanelLogout() {
  clearSecret();
  if (els.adminPanel) els.adminPanel.classList.add('hidden');
  if (els.loginScreen) els.loginScreen.classList.remove('hidden');
  if (els.rows) els.rows.innerHTML = '';
  showStatus('Logged out.');
}

// ---- Init ----
function init() {
  updateSecretStatus();

  // simple UI
  if (els.loginForm) els.loginForm.addEventListener('submit', handleSimpleLoginSubmit);
  if (els.clearSecret)
    els.clearSecret.addEventListener('click', () => {
      clearSecret();
      if (els.rows) els.rows.innerHTML = '';
      showStatus('Secret cleared.');
    });

  // two-panel UI
  if (els.loginBtn2) els.loginBtn2.addEventListener('click', handlePanelLogin);
  if (els.loginInput2)
    els.loginInput2.addEventListener('keypress', (e) => e.key === 'Enter' && handlePanelLogin());
  if (els.logoutBtn2) els.logoutBtn2.addEventListener('click', handlePanelLogout);

  // common controls
  if (els.refresh) els.refresh.addEventListener('click', fetchAppointments);
  if (els.downloadCsv) els.downloadCsv.addEventListener('click', downloadCSV);
  if (els.search) els.search.addEventListener('input', () => renderTable(ALL));
  if (els.downloadDbBtn) els.downloadDbBtn.addEventListener('click', downloadDb);

  // autoload if secret already saved
  if (getSecret()) {
    // if 2-panel UI exists, show admin panel automatically
    if (els.loginScreen && els.adminPanel) {
      els.loginScreen.classList.add('hidden');
      els.adminPanel.classList.remove('hidden');
    }
    fetchAppointments();
  }
}

document.addEventListener('DOMContentLoaded', init);

