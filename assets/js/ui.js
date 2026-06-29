// ============================================================
// FoodRescue — UI Utilities (Scroll, Navbar, Carousel, etc.)
// ============================================================

// ── Scroll Reveal ────────────────────────────────────────────

export function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '-40px' });

  document.querySelectorAll('.reveal-on-scroll, .reveal-fade, .reveal-left, .reveal-right')
    .forEach(el => observer.observe(el));
}

// ── Navbar Scroll Behavior ───────────────────────────────────

export function initNavbar() {
  const nav = document.querySelector('.fr-nav');
  if (!nav) return;

  const update = () => {
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', update, { passive: true });
  update();

  // Hamburger
  const hamburger = nav.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const closeBtn   = mobileMenu?.querySelector('.mob-close');

  hamburger?.addEventListener('click', () => {
    mobileMenu?.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  closeBtn?.addEventListener('click', closeMenu);
  mobileMenu?.querySelectorAll('.mob-link').forEach(a =>
    a.addEventListener('click', closeMenu)
  );

  function closeMenu() {
    mobileMenu?.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ── Active Nav Link ──────────────────────────────────────────

export function setActiveNavLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mob-link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('/').pop();
    link.classList.toggle('active', href === path);
  });
}

// ── Testimonial Carousel ─────────────────────────────────────

export function initTestimonialCarousel() {
  const track = document.querySelector('.testimonials-track');
  const dots   = document.querySelectorAll('.testimonial-dot');
  if (!track || !dots.length) return;

  const cards  = track.querySelectorAll('.testimonial-card');
  const total  = cards.length;
  let current  = 0;
  let interval = null;
  const perView = window.innerWidth > 991 ? 3 : 1;

  function goTo(idx) {
    current = (idx + total) % total;
    const offset = current * (100 / perView);
    track.style.transform = `translateX(-${offset}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function startAuto() {
    interval = setInterval(() => goTo(current + 1), 5000);
  }

  dots.forEach((d, i) => d.addEventListener('click', () => {
    clearInterval(interval);
    goTo(i);
    startAuto();
  }));

  track.addEventListener('mouseenter', () => clearInterval(interval));
  track.addEventListener('mouseleave', startAuto);

  goTo(0);
  startAuto();
}

// ── Multi-step Form Wizard ───────────────────────────────────

export function initStepWizard() {
  const form     = document.querySelector('.step-wizard-form');
  if (!form) return;
  const steps    = form.querySelectorAll('.wizard-step');
  const nextBtns = form.querySelectorAll('.wizard-next');
  const prevBtns = form.querySelectorAll('.wizard-prev');
  const indicators = document.querySelectorAll('.step-indicator');
  let currentStep = 0;

  function showStep(idx) {
    steps.forEach((s, i) => {
      s.style.display = i === idx ? 'block' : 'none';
      s.classList.toggle('active', i === idx);
    });
    indicators.forEach((ind, i) => {
      ind.classList.remove('active', 'completed');
      if (i < idx)  ind.classList.add('completed');
      if (i === idx) ind.classList.add('active');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateCurrentStep(steps[currentStep])) {
        currentStep = Math.min(currentStep + 1, steps.length - 1);
        showStep(currentStep);
      }
    });
  });

  prevBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep = Math.max(currentStep - 1, 0);
      showStep(currentStep);
    });
  });

  showStep(0);
}

function validateCurrentStep(stepEl) {
  let valid = true;
  stepEl.querySelectorAll('[required]').forEach(input => {
    const errEl = input.parentElement.querySelector('.form-error');
    if (!input.value.trim()) {
      valid = false;
      input.classList.add('error');
      if (errEl) { errEl.textContent = 'This field is required.'; errEl.classList.add('visible'); }
    } else {
      input.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });
  return valid;
}

// ── OTP Input ────────────────────────────────────────────────

export function initOTPInputs(containerSel = '.otp-inputs') {
  const container = document.querySelector(containerSel);
  if (!container) return;
  const boxes = container.querySelectorAll('.otp-box');

  boxes.forEach((box, i) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      if (val && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) boxes[i - 1].focus();
    });
    box.addEventListener('paste', (e) => {
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      boxes.forEach((b, j) => { b.value = pasted[j] || ''; });
      e.preventDefault();
    });
  });
}

export function getOTPValue(containerSel = '.otp-inputs') {
  const container = document.querySelector(containerSel);
  if (!container) return '';
  return Array.from(container.querySelectorAll('.otp-box')).map(b => b.value).join('');
}

// ── OTP Resend Countdown ─────────────────────────────────────

export function startResendCountdown(btnId, seconds = 60) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  let remaining = seconds;
  btn.disabled = true;
  btn.textContent = `Resend in ${remaining}s`;
  const timer = setInterval(() => {
    remaining--;
    btn.textContent = `Resend in ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = 'Resend OTP';
    }
  }, 1000);
}

// ── Password Strength Meter ──────────────────────────────────

export function initPasswordStrength(inputId = 'password') {
  const input = document.getElementById(inputId);
  const bars  = document.querySelectorAll('.strength-bar');
  const label = document.querySelector('.strength-label');
  if (!input || !bars.length) return;

  input.addEventListener('input', () => {
    const val   = input.value;
    const score = getPasswordScore(val);
    const levels = [
      { min: 1, cls: 'weak',     text: 'Weak',     fill: 1 },
      { min: 2, cls: 'fair',     text: 'Fair',     fill: 2 },
      { min: 3, cls: 'strong',   text: 'Strong',   fill: 3 },
      { min: 4, cls: 'v-strong', text: 'Very Strong', fill: 4 }
    ];
    const level = levels.slice().reverse().find(l => score >= l.min) || { fill: 0, text: '', cls: '' };
    bars.forEach((b, i) => {
      b.className = `strength-bar ${i < level.fill ? level.cls : ''}`;
    });
    if (label) label.textContent = level.text;
  });
}

function getPasswordScore(pass) {
  let score = 0;
  if (pass.length >= 8)  score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score;
}

// ── Role Selector Cards ──────────────────────────────────────

export function initRoleSelector(onChange) {
  const cards = document.querySelectorAll('.role-selector-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const role = card.dataset.role;
      if (onChange) onChange(role);
    });
  });
}

// ── Tag Multi-select ─────────────────────────────────────────

export function initTagSelector(onUpdate) {
  const tags = document.querySelectorAll('.tag-chip');
  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('selected');
      const selected = Array.from(document.querySelectorAll('.tag-chip.selected'))
        .map(t => t.dataset.value || t.textContent.trim());
      if (onUpdate) onUpdate(selected);
    });
  });
}

// ── Food Category Radio Toggle ───────────────────────────────

export function initCategoryToggle(onChange) {
  const options = document.querySelectorAll('.category-radio-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      if (onChange) onChange(opt.dataset.value);
    });
  });
}

// ── Photo Upload Zone ────────────────────────────────────────

export function initPhotoUpload(zoneId, inputId, onUpload) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const preview = zone?.querySelector('.photo-preview');
  const overlay = zone?.querySelector('.photo-overlay');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processPhoto(file, preview, overlay, onUpload);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) processPhoto(input.files[0], preview, overlay, onUpload);
  });

  zone.querySelector('.photo-remove')?.addEventListener('click', (e) => {
    e.stopPropagation();
    preview.src = '';
    preview.classList.remove('visible');
    overlay?.classList.remove('visible');
    input.value = '';
    if (onUpload) onUpload(null);
  });
}

function processPhoto(file, preview, overlay, onUpload) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) { preview.src = e.target.result; preview.classList.add('visible'); }
    if (overlay) overlay.classList.add('visible');
  };
  reader.readAsDataURL(file);
  if (onUpload) onUpload(file);
}

// ── Sidebar Toggle (mobile dashboard) ───────────────────────

export function initDashboardSidebar() {
  const toggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.dash-sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ── Logout Button ────────────────────────────────────────────

export function initLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const { logout } = await import('./auth.js');
      await logout();
    });
  });
}

// ── Date/Time Helpers ────────────────────────────────────────

export function formatRelativeTime(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatExpiryCountdown(expiresAt) {
  const exp  = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
  const diff = exp - new Date();
  if (diff <= 0) return { text: 'Expired', critical: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const text = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return { text, critical: diff < 3600000, warning: diff < 7200000 };
}

export function startExpiryTimer(element, expiresAt) {
  const update = () => {
    const { text, critical, warning } = formatExpiryCountdown(expiresAt);
    element.textContent = text;
    element.classList.toggle('critical', critical);
    element.classList.toggle('warning',  warning && !critical);
    const card = element.closest('.donation-feed-card');
    if (card) {
      card.classList.toggle('urgent',  critical);
      card.classList.toggle('warning', warning && !critical);
    }
  };
  update();
  return setInterval(update, 1000);
}

// ── Indian Phone Validation ───────────────────────────────────

export function validateIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''));
}

// ── FSSAI Number Validation ───────────────────────────────────

export function validateFSSAI(fssai) {
  return /^\d{14}$/.test(fssai.replace(/\s/g, ''));
}
