// admin.js — handles login, secret storage, and data display
(async function() {
  const loginScreen = document.getElementById('login-screen');
  const adminPanel = document.getElementById('admin-panel');
  const loginInput = document.getElementById('login-secret');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const statusEl = document.getElementById('status');
  const tbody = document.getElementById('tbody');

  let secret = localStorage.getItem('admin_secret') || '';

  function showStatus(msg, kind = 'info') {
    statusEl.textContent = msg;
    statusEl.className =
      kind === 'error' ? 'text-sm text-red-600 mb-4' : 'text-sm text-gray-600 mb-4';
  }

  async function testSecret(candidate) {
    try {
      const res = await fetch('/api/appointments', {
        headers: { 'X-Admin-Secret': candidate },
      });
      const json = await res.json();
      return res.ok && json.success;
    } catch {
      return false;
    }
  }

  async function login() {
    const candidate = loginInput.value.trim();
    if (!candidate) {
      loginError.textContent = 'Please enter your admin secret.';
      loginError.classList.remove('hidden');
      return;
    }

    loginError.classList.add('hidden');
    loginBtn.textContent = 'Testing...';
    loginBtn.disabled = true;

    const ok = await testSecret(candidate);
    if (!ok) {
      loginError.textContent = 'Invalid secret or server not reachable.';
      loginError.classList.remove('hidden');
      loginBtn.textContent = 'Login';
      loginBtn.disabled = false;
      return;
    }

    localStorage.setItem('admin_secret', candidate);
    secret = candidate;
    loginScreen.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    loadAppointments();
  }

  async function logout() {
    localStorage.removeItem('admin_secret');
    secret = '';
    adminPanel.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  async function loadAppointments() {
    showStatus('Loading appointments...');
    try {
      const res = await fetch('/api/appointments', {
        headers: { 'X-Admin-Secret': secret },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to fetch');
      renderTable(json.appointments);
      showStatus(`Loaded ${json.appointments.length} appointments.`);
    } catch (e) {
      console.error(e);
      showStatus('Network or fetch error', 'error');
    }
  }

  function renderTable(rows) {
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center text-gray-400 py-4">No data available.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (r, i) => `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-2">${i + 1}</td>
        <td class="px-4 py-2">${r.created_at || ''}</td>
        <td class="px-4 py-2">${r.owner_name}</td>
        <td class="px-4 py-2">${r.phone}</td>
        <td class="px-4 py-2">${r.pet_name}</td>
        <td class="px-4 py-2">${r.service}</td>
        <td class="px-4 py-2">${r.preferred_date || ''} ${r.preferred_time || ''}</td>
        <td class="px-4 py-2">${r.notes || ''}</td>
      </tr>`
      )
      .join('');
  }

  // Event listeners
  loginBtn.addEventListener('click', login);
  loginInput.addEventListener('keypress', (e) => e.key === 'Enter' && login());
  logoutBtn.addEventListener('click', logout);

  
  // --- Download DB Backup ---
const downloadDbBtn = document.getElementById('downloadDbBtn');
if (downloadDbBtn) {
  downloadDbBtn.addEventListener('click', async () => {
    const secret = localStorage.getItem('admin_secret');
    if (!secret) return alert('You must be logged in to download the database.');

    try {
      const res = await fetch('/api/download-db', {
        headers: { 'X-Admin-Secret': secret },
      });

      if (!res.ok) throw new Error('Failed to download database');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appointments-backup-${new Date().toISOString().slice(0,10)}.db`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('⚠️ Could not download database. Check the server logs.');
    }
  });
}


  // Auto login if secret exists
  if (secret) {
    const ok = await testSecret(secret);
    if (ok) {
      loginScreen.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadAppointments();
    } else {
      localStorage.removeItem('admin_secret');
      secret = '';
    }
  }
})();
