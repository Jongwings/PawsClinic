// web/app.js
// Mobile menu toggle + form submit handler (deferred script)

// Toast utility - animated fade + slide (Tailwind)
function showToast(message, type = 'success', timeout = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const id = 'toast-' + Date.now();
  const bg = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';

  // Build toast element
  const toast = document.createElement('div');
  toast.id = id;
  // initial state: slightly down and invisible (will transition to translate-y-0 and opacity-100)
  // We use Tailwind utility classes. `transform` + `translate-y-4` + `opacity-0` initial.
  // Then force reflow and swap to `translate-y-0 opacity-100`.
  toast.className = `max-w-sm w-full text-white ${bg} px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 transform translate-y-4 opacity-0 transition-all duration-300`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', type === 'success' ? 'polite' : 'assertive');

  toast.innerHTML = `
    <div class="flex-1 text-sm leading-tight">${message}</div>
    <button aria-label="Close" class="ml-3 text-white/90 hover:text-white">&times;</button>
  `;

  // add to DOM
  container.appendChild(toast);

  // Force reflow then animate in (only if not reduced motion)
  if (!prefersReduced) {
    // read offsetHeight to force reflow
    void toast.offsetHeight;
    toast.classList.remove('translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  } else {
    // Immediately visible for reduced motion users
    toast.classList.remove('translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  }

  // Close handler (fade & slide out)
  const removeToast = () => {
    if (!toast) return;
    if (!prefersReduced) {
      // animate out
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-4', 'opacity-0');
      // wait for animation to finish before removing
      setTimeout(() => {
        toast.remove();
      }, 300); // matches duration-300
    } else {
      toast.remove();
    }
  };

  // wire close button
  const btn = toast.querySelector('button');
  if (btn) btn.addEventListener('click', removeToast);

  // auto-remove after timeout
  const timer = setTimeout(removeToast, timeout);

  // return an object to allow programmatic close if needed
  return {
    id,
    remove: () => {
      clearTimeout(timer);
      removeToast();
    }
  };
}

(() => {
    // Mobile menu toggle
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }
  
    // Form submission handler (POST to /api/send-sms)
    // inside web/app.js - submit handler
const form = document.getElementById('appointment-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const ownerName = document.getElementById('name')?.value.trim() || '';
    const phone = document.getElementById('phone')?.value.trim() || '';
    const petName = document.getElementById('pet')?.value.trim() || '';
    const species = document.getElementById('petType')?.value.trim() || '';
    const date = document.getElementById('date')?.value.trim() || '';
    const time = document.getElementById('time')?.value.trim() || '';
    const message = document.getElementById('notes')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || ''; // optional
    const service = document.getElementById('service')?.value.trim() || '';

    // client-side validation: require ownerName, phone, petName, service
    if (!ownerName || !phone || !petName || !service) {
      alert('Please fill in your name, phone, pet name, and choose a service.');
      return;
    }

    const payload = {
      ownerName,
      phone,
      petName,
      species,
      service,    // required
      date,
      time,
      message,
      email,      // may be empty string
      agree: true
    };

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to send');
      showToast('Appointment request sent — we will contact you shortly.', 'success');

      form.reset();
    } catch (err) {
      console.error(err);
      showToast('Could not send automatically. Please call the clinic instead.', 'error');

    }
  });
}

  })();
  