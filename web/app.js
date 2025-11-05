// web/app.js — minimal form handler + admin helpers
const API_BASE = (window.API_BASE || '').replace(/\/$/, '');
const API_URL = (API_BASE ? API_BASE : '') + '/api/send-sms';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('appointment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        ownerName: document.getElementById('name')?.value.trim() || '',
        phone:     document.getElementById('phone')?.value.trim() || '',
        petName:   document.getElementById('pet')?.value.trim() || '',
        species:   document.getElementById('petType')?.value.trim() || '',
        service:   (document.getElementById('service')?.value || 'General Checkup').trim(),
        date:      document.getElementById('date')?.value || '',
        time:      document.getElementById('time')?.value || '',
        message:   document.getElementById('notes')?.value.trim() || '',
        email:     document.getElementById('email')?.value.trim() || '',
        agree:     true
      };

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send');
        alert('✅ Appointment request sent. Thank you!');
        form.reset();
      } catch (err) {
        console.error('Send error', err);
        alert('⚠️ Could not send automatically. Please call the clinic instead.');
      }
    });
  }

  // Admin login (stores secret in localStorage) — optional
  const adminLogin = document.getElementById('admin-login-form');
  if (adminLogin) {
    adminLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const secret = (document.getElementById('admin-secret')?.value || '').trim();
      if (secret) {
        localStorage.setItem('admin_secret', secret);
        alert('Admin secret saved to localStorage');
      }
    });
  }
});
