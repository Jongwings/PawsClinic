const form = document.getElementById('apptForm');
const statusEl = document.getElementById('formStatus');
const requiredFields = ['ownerName','email','phone','petName','species','service','date','time','agree'];

function validateField(input) {
  const field = input.closest('label')?.querySelector('small') || input.parentElement?.querySelector('small');
  let msg = '';
  if (input.type === 'checkbox') {
    if (!input.checked) msg = 'Please accept the terms.';
  } else if (!input.value?.trim()) {
    msg = 'This field is required.';
  } else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
    msg = 'Enter a valid email.';
  } else if (input.name === 'phone' && !/[0-9]{7,}/.test(input.value.replace(/\D/g, ''))) {
    msg = 'Enter a valid phone number.';
  }
  if (field) field.textContent = msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  return !msg;
}

if (form) {
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t && 'name' in t) validateField(t);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';

    let ok = true;
    requiredFields.forEach(name => {
      const input = form.elements[name];
      if (input) ok = validateField(input) && ok;
    });
    if (!ok) {
      statusEl.textContent = 'Please fix the highlighted fields.';
      statusEl.style.color = '#e11d48';
      return;
    }

    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.agree = form.querySelector('#agree').checked;

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send SMS');
      statusEl.textContent = 'Thanks! Your request has been sent via SMS to the clinic.';
      statusEl.style.color = '#16a34a';
      form.reset();
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || 'Could not send automatically. Please call us instead.';
      statusEl.style.color = '#e11d48';
    }
  });
}
