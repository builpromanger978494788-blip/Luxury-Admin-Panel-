// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyCVmYkaUKr003oDDjZVja98HpTf9ByrH44",
  authDomain: "sohanmali-77014.firebaseapp.com",
  databaseURL: "https://sohanmali-77014-default-rtdb.firebaseio.com",
  projectId: "sohanmali-77014",
  storageBucket: "sohanmali-77014.firebasestorage.app",
  messagingSenderId: "281655194324",
  appId: "1:281655194324:web:05833d65971ebbd5580141",
  measurementId: "G-3Q3RL1C6BW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const fbStorage = firebase.storage();

// ── Global State ──
let siteData = {};
let firebaseConnected = false;
const API = '/api';

// ── Init ──
// Request Notification Permission
let notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
function requestNotificationPermission() {
  if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
}

function playNotification() {
  try {
    notificationSound.play().catch(e => console.warn('Audio play failed:', e));
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("New Client Message", {
        body: "You have received a new message from the website contact form.",
        icon: "favicon.jpg"
      });
    }
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Load Theme
  const savedTheme = localStorage.getItem('adminTheme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  loadContent();
  requestNotificationPermission();
});

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('adminTheme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('adminTheme', 'dark');
  }
}

async function loadContent() {
  showLoading(true);
  try {
    // Try Realtime Database first
    const snapshot = await db.ref('website/content').once('value');
    if (snapshot.exists()) {
      siteData = snapshot.val();
      if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
      firebaseConnected = true;
      updateFirebaseStatus(true, 'Connected to Firebase. Data loaded from RTDB.');
    } else {
      // First time — load from local data.json and push to RTDB
      const res = await fetch(`${API}/content`);
      siteData = await res.json();
      if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
      await db.ref('website/content').set(siteData);
      firebaseConnected = true;
      updateFirebaseStatus(true, 'First sync complete. Data pushed to RTDB.');
      showToast('Data synced to Firebase', 'success');
    }
  } catch (err) {
    console.error('Firebase error, falling back to local:', err);
    try {
      const res = await fetch(`${API}/content`);
      siteData = await res.json();
      if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
      updateFirebaseStatus(false, 'Firebase unavailable. Using local data.');
    } catch (e) {
      showToast('Failed to load content', 'error');
      showLoading(false);
      return;
    }
  }
  if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
  populateAllForms();
  updateDashboard();
  setupMessagesListener();
  showLoading(false);
}

// ── Firebase Status UI ──
function updateFirebaseStatus(connected, message) {
  const badge = document.getElementById('firebaseStatus');
  const msg = document.getElementById('firebaseMsg');
  if (badge) {
    if (connected) {
      badge.textContent = '✓ Connected';
      badge.style.background = '#ecfdf5';
      badge.style.color = '#10b981';
    } else {
      badge.textContent = '✕ Offline';
      badge.style.background = '#fef2f2';
      badge.style.color = '#ef4444';
    }
  }
  if (msg) msg.textContent = message;
}

// ── Sync Functions ──
async function syncToFirebase() {
  showLoading(true, 'Syncing to Firebase...');
  try {
    collectAllFormData();
    if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
    await db.ref('website/content').set(siteData);
    firebaseConnected = true;
    updateFirebaseStatus(true, 'Data synced to Firebase successfully.');
    showToast('Data pushed to Firebase', 'success');
  } catch (err) {
    showToast('Sync to Firebase failed: ' + err.message, 'error');
  }
  showLoading(false);
}

async function syncFromFirebase() {
  showLoading(true, 'Loading from Firebase...');
  try {
    const snapshot = await db.ref('website/content').once('value');
    if (snapshot.exists()) {
      siteData = snapshot.val();
      if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
      populateAllForms();
      updateDashboard();
      updateFirebaseStatus(true, 'Data loaded from Firebase.');
      showToast('Data loaded from Firebase', 'success');
    } else {
      showToast('No data found in Firebase', 'error');
    }
  } catch (err) {
    showToast('Sync from Firebase failed: ' + err.message, 'error');
  }
  showLoading(false);
}

// ── Navigation ──
function showSection(id) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  event.target.closest('.sidebar-link')?.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', home: 'Home Page', projects: 'Projects',
    about: 'About Page', services: 'Services Page', contact: 'Contact Page',
    messages: 'Client Messages',
    footer: 'Footer', site: 'Site Settings'
  };
  document.getElementById('headerTitle').textContent = titles[id] || id;

  if (id === 'messages') {
    setupMessagesListener();
  }
}

// ── Populate All Forms ──
function populateAllForms() {
  if (!siteData) return;
  populateHome();
  populateProjects();
  populateAbout();
  populateServices();
  populateContact();
  populateFooter();
  populateSite();
}

// ═══════ HOME PAGE ═══════
function populateHome() {
  const h = siteData.home;
  if (!h) return;
  setValue('hero-badge', h.hero.badge);
  setValue('hero-title', h.hero.title_line1);
  setValue('hero-highlight', h.hero.title_highlight);
  setValue('hero-btn-primary', h.hero.btn_primary);
  setValue('hero-btn-secondary', h.hero.btn_secondary);
  renderHeroServices(h.hero.services || []);
  renderHeroSliderImages(h.hero.sliderImages || []);
  renderStats(h.stats || []);
  setValue('featured-label', h.featured.label);
  setValue('featured-title-line1', h.featured.title_line1);
  setValue('featured-title-em', h.featured.title_em);
  renderFeaturedCards(h.featured.cards || []);
  setValue('phil-label', h.philosophy.label);
  setValue('phil-title-line1', h.philosophy.title_line1);
  setValue('phil-title-em', h.philosophy.title_em);
  setValue('phil-text', h.philosophy.text);
  setValue('phil-image', h.philosophy.image || 'images/homepage5.jpeg');
  const philPrev = document.getElementById('phil-image-preview');
  if (philPrev) philPrev.src = h.philosophy.image || 'images/homepage5.jpeg';
  setValue('process-label', h.process.label);
  setValue('process-title-line1', h.process.title_line1);
  setValue('process-title-em', h.process.title_em);
  renderProcessSteps(h.process.steps || []);
  setValue('test-label', h.testimonial.label);
  
  if (!h.testimonial.items && h.testimonial.quote) {
    h.testimonial.items = [{ quote: h.testimonial.quote, author: h.testimonial.author }];
  }
  renderTestimonials(h.testimonial.items || []);
}

function renderHeroServices(services) {
  const container = document.getElementById('hero-services-tags');
  container.innerHTML = services.map((s, i) =>
    `<span class="tag">${s} <button onclick="removeHeroService(${i})">×</button></span>`
  ).join('');
}

function addHeroService() {
  const input = document.getElementById('hero-service-input');
  const val = input.value.trim();
  if (!val) return;
  if (!siteData.home.hero.services) siteData.home.hero.services = [];
  siteData.home.hero.services.push(val);
  renderHeroServices(siteData.home.hero.services);
  input.value = '';
}

function removeHeroService(i) {
  siteData.home.hero.services.splice(i, 1);
  renderHeroServices(siteData.home.hero.services);
}

const DEFAULT_HERO_PRESET_IMAGES = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80"
];

function getHeroSlideUrl(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object' && item.url) return String(item.url).trim();
  return '';
}

function getHeroSlideDuration(item) {
  if (item && typeof item === 'object') {
    const d = Number(item.duration);
    if (!isNaN(d) && d > 0) return d;
  }
  return 4; // default 4 seconds
}

function isPresetImage(item) {
  const url = getHeroSlideUrl(item);
  return DEFAULT_HERO_PRESET_IMAGES.includes(url);
}

function ensureHeroSliderNormalized() {
  if (!siteData.home) siteData.home = {};
  if (!siteData.home.hero) siteData.home.hero = {};
  if (!Array.isArray(siteData.home.hero.sliderImages)) {
    siteData.home.hero.sliderImages = [];
  } else {
    siteData.home.hero.sliderImages = siteData.home.hero.sliderImages.map(item => {
      if (typeof item === 'string') {
        return { url: item.trim(), duration: 4 };
      }
      if (item && typeof item === 'object') {
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        const dur = Number(item.duration);
        return { url, duration: !isNaN(dur) && dur > 0 ? dur : 4 };
      }
      return null;
    }).filter(item => item && item.url);
  }
}

function renderHeroSliderImages(images) {
  const container = document.getElementById('hero-slider-images');
  const countBadge = document.getElementById('hero-slider-active-count');
  const modeBadge = document.getElementById('hero-slider-mode-badge');
  const infoBanner = document.getElementById('hero-slider-info-banner');
  const presetList = document.getElementById('hero-preset-images-list');
  const restoreAllBtn = document.getElementById('btn-restore-all-presets');
  const presetLibraryBox = document.getElementById('hero-preset-library-box');

  if (!container) return;

  // Filter out any broken image reference
  const BROKEN_IMG_URL = "https://images.unsplash.com/photo-1600607687931-cebf57434778?auto=format&fit=crop&w=1600&q=80";
  if (siteData && siteData.home && siteData.home.hero && Array.isArray(siteData.home.hero.sliderImages)) {
    siteData.home.hero.sliderImages = siteData.home.hero.sliderImages.filter(img => getHeroSlideUrl(img) !== BROKEN_IMG_URL);
  }

  let activeImages = Array.isArray(images) && images.length > 0 
    ? images.filter(img => getHeroSlideUrl(img) !== BROKEN_IMG_URL && getHeroSlideUrl(img) !== '') 
    : [];
  
  // Check if any custom uploaded image is currently present in active images
  const hasCustomImages = activeImages.some(img => !isPresetImage(img));

  let displayImages = [];
  let isDefaultLockedState = false;

  if (activeImages.length === 0) {
    displayImages = DEFAULT_HERO_PRESET_IMAGES.map(url => ({ url, duration: 4 }));
    isDefaultLockedState = true;
  } else if (!hasCustomImages && activeImages.length === DEFAULT_HERO_PRESET_IMAGES.length) {
    displayImages = activeImages;
    isDefaultLockedState = true;
  } else {
    displayImages = activeImages;
    isDefaultLockedState = false;
  }

  if (countBadge) countBadge.textContent = displayImages.length;

  if (modeBadge) {
    if (isDefaultLockedState) {
      modeBadge.textContent = '🔒 Default Preset Mode';
      modeBadge.className = 'badge badge-locked';
    } else {
      modeBadge.textContent = '✨ Custom Slider Mode';
      modeBadge.className = 'badge badge-custom';
    }
  }

  if (infoBanner) {
    if (isDefaultLockedState) {
      infoBanner.style.background = 'rgba(255, 255, 255, 0.04)';
      infoBanner.style.border = '1px solid var(--border)';
      infoBanner.style.color = 'var(--text-secondary)';
      infoBanner.innerHTML = `<span>ℹ️ <strong>Default Presets Active:</strong> Website is showing default studio photos. Upload custom images above to replace or customize them.</span>`;
    } else {
      infoBanner.style.background = 'rgba(96, 165, 250, 0.08)';
      infoBanner.style.border = '1px solid rgba(96, 165, 250, 0.2)';
      infoBanner.style.color = 'var(--accent)';
      infoBanner.innerHTML = `<span>💡 <strong>Sequence & Duration:</strong> Reorder slides using handle (=) or ▲/▼. Adjust display duration per slide.</span>`;
    }
  }

  // Render Active Images
  if (displayImages.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">No active images in slider.</div>`;
  } else {
    container.innerHTML = displayImages.map((item, i) => {
      const url = getHeroSlideUrl(item);
      const duration = getHeroSlideDuration(item);
      const isPreset = isPresetImage(item);
      const badgeHtml = isPreset
        ? `<span class="badge-preset">Preset Default</span>`
        : `<span class="badge-custom">Custom Upload</span>`;

      let actionButtonHtml = '';
      if (isDefaultLockedState) {
        actionButtonHtml = `<span style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;" title="Upload custom image to customize or remove default images">🔒 Default</span>`;
      } else {
        actionButtonHtml = `<button class="btn btn-sm btn-outline-danger" style="color:var(--red);border-color:var(--red);padding:4px 10px;font-size:0.75rem;cursor:pointer;" onclick="removeHeroSliderImage(${i})" title="${isPreset ? 'Remove from active slider (stored in library below)' : 'Delete uploaded image'}">${isPreset ? '✕ Remove' : '🗑️ Delete'}</button>`;
      }

      const reorderButtonsHtml = isDefaultLockedState ? '' : `
        <button class="btn-reorder" title="Move Up" onclick="moveHeroSlide(${i}, -1)" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>▲</button>
        <button class="btn-reorder" title="Move Down" onclick="moveHeroSlide(${i}, 1)" ${i === displayImages.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>▼</button>
      `;

      const dragHandleHtml = isDefaultLockedState ? '' : `
        <div class="slider-drag-handle" title="Click & Drag (2 lines) to change sequence" data-index="${i}">
          <span class="drag-line"></span>
          <span class="drag-line"></span>
        </div>
      `;

      return `
        <div class="slider-img-item" id="hero-slide-item-${i}" data-index="${i}">
          ${dragHandleHtml}
          <img src="${escapeAttr(url)}" class="slider-img-thumb" alt="Hero Slide ${i+1}" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlIi8+PC9zdmc+';" />
          <div class="slider-img-info">
            <div class="slider-img-badges">
              <span style="font-weight:600;font-size:0.85rem;color:var(--text-primary);">Slide ${i + 1}</span>
              ${badgeHtml}
            </div>
            <div class="slider-img-url" title="${escapeAttr(url)}">${escapeHtml(url)}</div>
            <div class="slider-duration-control">
              <label class="slider-duration-label" title="Set how many seconds this image shows in hero slider">
                <span>⏱️ Show Time:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  class="slider-duration-input"
                  value="${duration}"
                  onchange="updateHeroSlideDuration(${i}, this.value)"
                />
                <span>sec</span>
              </label>
              <span style="font-size:0.72rem;color:var(--text-muted);">${duration} sec onscreen</span>
            </div>
          </div>
          <div class="slider-item-actions">
            ${reorderButtonsHtml}
            ${actionButtonHtml}
          </div>
        </div>
      `;
    }).join('');

    if (!isDefaultLockedState) {
      initHeroSliderDragAndDrop();
    }
  }

  // Render Preset Library (Removed Default Images)
  const currentActiveUrls = displayImages.map(item => getHeroSlideUrl(item));
  const removedPresets = DEFAULT_HERO_PRESET_IMAGES.filter(preset => !currentActiveUrls.includes(preset));

  if (presetLibraryBox) {
    if (removedPresets.length > 0) {
      if (restoreAllBtn) restoreAllBtn.style.display = 'inline-block';
      if (presetList) {
        presetList.innerHTML = removedPresets.map((preset, idx) => `
          <div class="slider-img-item" style="opacity:0.9;background:var(--surface-hover);">
            <img src="${escapeAttr(preset)}" class="slider-img-thumb" alt="Preset ${idx+1}" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlIi8+PC9zdmc+';" />
            <div class="slider-img-info">
              <div class="slider-img-badges">
                <span style="font-weight:600;font-size:0.85rem;color:var(--text-primary);">Default Studio Preset ${DEFAULT_HERO_PRESET_IMAGES.indexOf(preset) + 1}</span>
                <span class="badge-preset">Available to Add</span>
              </div>
              <div class="slider-img-url">${escapeHtml(preset)}</div>
            </div>
            <button class="btn-restore-preset" onclick="addHeroPresetBack('${escapeAttr(preset)}')">➕ Add Back to Slider</button>
          </div>
        `).join('');
      }
    } else {
      if (restoreAllBtn) restoreAllBtn.style.display = 'none';
      if (presetList) {
        presetList.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);padding:8px 0;">All default preset images are currently added in the slider.</div>`;
      }
    }
  }
}

let draggedHeroSlideIndex = null;
function initHeroSliderDragAndDrop() {
  const cards = document.querySelectorAll('#hero-slider-images .slider-img-item');
  cards.forEach(card => {
    const handle = card.querySelector('.slider-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => {
        card.setAttribute('draggable', 'true');
      });
      handle.addEventListener('touchstart', () => {
        card.setAttribute('draggable', 'true');
      }, { passive: true });
    }

    card.addEventListener('dragstart', (e) => {
      draggedHeroSlideIndex = parseInt(card.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(draggedHeroSlideIndex));
      card.classList.add('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!card.classList.contains('dragging')) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over');
      }
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetIndex = parseInt(card.dataset.index);
      if (draggedHeroSlideIndex !== null && !isNaN(draggedHeroSlideIndex) && draggedHeroSlideIndex !== targetIndex) {
        ensureHeroSliderNormalized();
        const [moved] = siteData.home.hero.sliderImages.splice(draggedHeroSlideIndex, 1);
        siteData.home.hero.sliderImages.splice(targetIndex, 0, moved);
        renderHeroSliderImages(siteData.home.hero.sliderImages);
        saveHeroSliderLive();
        showToast(`↔️ Slide sequence updated! (Moved to #${targetIndex + 1})`, 'success');
      }
    });

    card.addEventListener('dragend', () => {
      cards.forEach(c => {
        c.classList.remove('dragging', 'drag-over');
        c.setAttribute('draggable', 'false');
      });
      draggedHeroSlideIndex = null;
    });
  });
}

function moveHeroSlide(index, direction) {
  ensureHeroSliderNormalized();
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= siteData.home.hero.sliderImages.length) return;
  const [moved] = siteData.home.hero.sliderImages.splice(index, 1);
  siteData.home.hero.sliderImages.splice(targetIndex, 0, moved);
  renderHeroSliderImages(siteData.home.hero.sliderImages);
  saveHeroSliderLive();
  showToast(`↔️ Slide moved to #${targetIndex + 1}`, 'success');
}

function updateHeroSlideDuration(index, value) {
  ensureHeroSliderNormalized();
  let sec = parseInt(value, 10);
  if (isNaN(sec) || sec < 1) sec = 4;
  if (sec > 60) sec = 60;

  if (siteData.home.hero.sliderImages[index]) {
    siteData.home.hero.sliderImages[index].duration = sec;
    renderHeroSliderImages(siteData.home.hero.sliderImages);
    saveHeroSliderLive();
    showToast(`Slide ${index + 1} duration set to ${sec}s`, 'success');
  }
}

// ── In-Card Upload Progress Helpers ──
function getProgressCardHtml(id, label = 'Uploading image...') {
  return `
    <div id="${id}" class="upload-progress-card" style="display:none;">
      <div class="upload-progress-header">
        <div class="upload-progress-title">
          <span class="upload-spinner-mini"></span>
          <span class="upload-progress-label">${label}</span>
        </div>
        <span class="upload-progress-percent">0%</span>
      </div>
      <div class="upload-progress-bar-track">
        <div class="upload-progress-bar-fill" style="width: 0%;"></div>
      </div>
      <div class="upload-progress-status">
        <span class="upload-progress-detail">Connecting to Cloudinary...</span>
      </div>
    </div>
  `;
}

function ensureProgressCardMarkup(el, label = 'Uploading image...', detail = 'Connecting to Cloudinary...') {
  if (!el) return;
  if (!el.querySelector('.upload-progress-bar-fill')) {
    el.innerHTML = `
      <div class="upload-progress-header">
        <div class="upload-progress-title">
          <span class="upload-spinner-mini"></span>
          <span class="upload-progress-label">${escapeHtml(label || 'Uploading image...')}</span>
        </div>
        <span class="upload-progress-percent">0%</span>
      </div>
      <div class="upload-progress-bar-track">
        <div class="upload-progress-bar-fill" style="width: 0%;"></div>
      </div>
      <div class="upload-progress-status">
        <span class="upload-progress-detail">${escapeHtml(detail || 'Connecting to Cloudinary...')}</span>
      </div>
    `;
  }
}

function updateProgressCard(elOrId, percent, label, detail) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;

  ensureProgressCardMarkup(el, label, detail);

  // Clear any existing hide timeout so progress doesn't abruptly vanish mid-upload
  if (el._hideTimeout) {
    clearTimeout(el._hideTimeout);
    el._hideTimeout = null;
  }

  el.style.display = 'flex';
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  el.classList.remove('upload-finished');

  const percentEl = el.querySelector('.upload-progress-percent');
  const barEl = el.querySelector('.upload-progress-bar-fill');
  const labelEl = el.querySelector('.upload-progress-label');
  const detailEl = el.querySelector('.upload-progress-detail');
  const spinnerEl = el.querySelector('.upload-spinner-mini');

  const p = Math.min(100, Math.max(0, Math.round(percent)));
  if (percentEl) percentEl.textContent = p + '%';
  if (barEl) {
    barEl.style.width = p + '%';
    barEl.style.background = ''; // default vibrant gradient
  }
  if (label && labelEl) labelEl.textContent = label;
  if (detail && detailEl) detailEl.textContent = detail;
  if (spinnerEl && p < 100) spinnerEl.style.display = 'inline-block';

  if (p >= 100) {
    el.classList.add('upload-finished');
    if (spinnerEl) spinnerEl.style.display = 'none';
    if (labelEl) labelEl.innerHTML = '✓ Upload complete';
    if (detailEl) detailEl.textContent = detail || 'File processed successfully';
    if (barEl) {
      barEl.style.width = '100%';
      barEl.style.background = 'linear-gradient(90deg, #10B981 0%, #059669 100%)';
    }

    el._hideTimeout = setTimeout(() => {
      el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-4px)';
      setTimeout(() => {
        el.style.display = 'none';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        el.style.transition = '';
        el.classList.remove('upload-finished');
        if (spinnerEl) spinnerEl.style.display = 'inline-block';
        if (barEl) {
          barEl.style.width = '0%';
          barEl.style.background = '';
        }
        if (percentEl) percentEl.textContent = '0%';
        el._hideTimeout = null;
      }, 350);
    }, 1200);
  }
}

function hideProgressCard(elOrId) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  if (el._hideTimeout) {
    clearTimeout(el._hideTimeout);
    el._hideTimeout = null;
  }
  el.style.transition = 'opacity 0.25s ease';
  el.style.opacity = '0';
  setTimeout(() => {
    el.style.display = 'none';
    el.style.opacity = '1';
    el.style.transition = '';
    const barEl = el.querySelector('.upload-progress-bar-fill');
    const percentEl = el.querySelector('.upload-progress-percent');
    if (barEl) {
      barEl.style.width = '0%';
      barEl.style.background = '';
    }
    if (percentEl) percentEl.textContent = '0%';
  }, 250);
}

// ── Direct Signed Upload to Cloudinary with Real-Time Progress ──
async function uploadFileToCloudinary(file, folder = 'architecture_studio', onProgress = null) {
  if (!file) throw new Error('No file selected');

  // Step 1: Request signature from server
  let signData;
  try {
    if (typeof onProgress === 'function') onProgress(12);
    const signRes = await fetch(`${API}/cloudinary-sign?folder=${encodeURIComponent(folder)}`);
    if (!signRes.ok) throw new Error(`Signature error (status ${signRes.status})`);
    signData = await signRes.json();
    if (!signData.signature) throw new Error(signData.error || 'Failed to obtain upload signature');
  } catch (signErr) {
    console.warn('Direct upload signing failed, falling back to server relay:', signErr);
    return uploadViaServerRelay(file, folder, onProgress);
  }

  // Step 2: Upload file directly to Cloudinary endpoint via XHR for progress events
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signData.api_key);
  formData.append('timestamp', signData.timestamp);
  formData.append('signature', signData.signature);
  formData.append('folder', signData.folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloud_name}/image/upload`);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const rawPct = e.loaded / e.total;
          const pct = Math.min(95, Math.max(15, Math.round(15 + rawPct * 80)));
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      try {
        const uploadResult = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && uploadResult.secure_url) {
          if (typeof onProgress === 'function') onProgress(100);
          const optimizedUrl = uploadResult.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
          resolve(optimizedUrl);
        } else {
          const errText = uploadResult.error && uploadResult.error.message ? uploadResult.error.message : `Upload failed (${xhr.status})`;
          reject(new Error(errText));
        }
      } catch (err) {
        reject(new Error('Invalid response from Cloudinary'));
      }
    };

    xhr.onerror = () => {
      console.warn('Direct upload failed, trying server relay fallback...');
      uploadViaServerRelay(file, folder, onProgress).then(resolve).catch(reject);
    };

    xhr.send(formData);
  });
}

// Fallback upload via server with progress
async function uploadViaServerRelay(file, folder, onProgress = null) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/upload-cloudinary`);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const rawPct = e.loaded / e.total;
          const pct = Math.min(95, Math.max(15, Math.round(15 + rawPct * 80)));
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      const responseText = xhr.responseText;
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        if (xhr.status === 413 || responseText.toLowerCase().includes('request entity too large')) {
          return reject(new Error('Image file exceeds server limit'));
        }
        return reject(new Error(responseText.slice(0, 150) || `Server error (${xhr.status})`));
      }

      if (xhr.status >= 200 && xhr.status < 300 && result.success && result.url) {
        if (typeof onProgress === 'function') onProgress(100);
        resolve(result.url);
      } else {
        reject(new Error(result.error || `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

async function uploadHeroSliderFiles(files) {
  const fileList = Array.from(files || []);
  if (!fileList.length) return;

  ensureHeroSliderNormalized();
  const progressEl = document.getElementById('hero-slider-upload-progress');

  const totalFiles = fileList.length;
  let uploadCount = 0;
  updateProgressCard(progressEl, 8, totalFiles > 1 ? `Uploading slide 1 of ${totalFiles}` : 'Uploading slide...', fileList[0].name);
  try {
    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      const url = await uploadFileToCloudinary(file, 'hero_slider', (filePct) => {
        const overall = Math.round(((i + (filePct / 100)) / totalFiles) * 100);
        const label = totalFiles > 1 ? `Uploading slide ${i + 1} of ${totalFiles}` : 'Uploading slide...';
        updateProgressCard(progressEl, overall, label, file.name);
      });
      siteData.home.hero.sliderImages.push({ url, duration: 4 });
      uploadCount++;
    }

    updateProgressCard(progressEl, 100, 'Upload complete', `${uploadCount} slide(s) uploaded`);
    renderHeroSliderImages(siteData.home.hero.sliderImages);
    saveHeroSliderLive();
    showToast(uploadCount > 1 ? `${uploadCount} slides uploaded successfully` : 'Slide uploaded successfully', 'success');
  } catch (err) {
    console.error('Slider image upload error:', err);
    hideProgressCard(progressEl);
    showToast('Slider upload failed: ' + err.message, 'error');
  } finally {
    const fileInput = document.getElementById('hero-slider-file-input');
    if (fileInput) fileInput.value = '';
  }
}

function handleHeroSliderDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = e.currentTarget;
  if (dropzone) dropzone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    uploadHeroSliderFiles(e.dataTransfer.files);
  }
}

function removeHeroSliderImage(i) {
  ensureHeroSliderNormalized();

  if (!siteData.home?.hero?.sliderImages || !siteData.home.hero.sliderImages[i]) return;

  const removedItem = siteData.home.hero.sliderImages[i];
  const isPreset = isPresetImage(removedItem);
  const slideNum = i + 1;

  const confirmMsg = isPreset
    ? `Remove default preset slide ${slideNum} from active slider?`
    : `Are you sure you want to delete slide ${slideNum}?`;

  if (!confirm(confirmMsg)) {
    return; // User cancelled
  }

  siteData.home.hero.sliderImages.splice(i, 1);

  const hasCustom = siteData.home.hero.sliderImages.some(img => !isPresetImage(img));
  if (!hasCustom && siteData.home.hero.sliderImages.length === 0) {
    siteData.home.hero.sliderImages = [];
  }

  renderHeroSliderImages(siteData.home.hero.sliderImages);
  saveHeroSliderLive();
  showToast(isPreset ? `Slide ${slideNum} removed` : `Slide ${slideNum} deleted`, 'info');
}

function addHeroPresetBack(presetUrl) {
  ensureHeroSliderNormalized();
  const exists = siteData.home.hero.sliderImages.some(item => getHeroSlideUrl(item) === presetUrl);
  if (!exists) {
    siteData.home.hero.sliderImages.push({ url: presetUrl, duration: 4 });
  }
  renderHeroSliderImages(siteData.home.hero.sliderImages);
  saveHeroSliderLive();
  showToast('Preset restored to slider', 'success');
}

function restoreAllHeroPresets() {
  ensureHeroSliderNormalized();
  DEFAULT_HERO_PRESET_IMAGES.forEach(preset => {
    const exists = siteData.home.hero.sliderImages.some(item => getHeroSlideUrl(item) === preset);
    if (!exists) {
      siteData.home.hero.sliderImages.push({ url: preset, duration: 4 });
    }
  });
  renderHeroSliderImages(siteData.home.hero.sliderImages);
  saveHeroSliderLive();
  showToast('All presets restored', 'success');
}

let heroSliderLiveTimeout = null;
async function saveHeroSliderLive() {
  // 1. Instant sync to Firebase RTDB (Live reflection on website)
  try {
    if (typeof db !== 'undefined' && db) {
      const cleanSlides = JSON.parse(JSON.stringify(siteData.home.hero.sliderImages || []));
      await db.ref('website/content/home/hero/sliderImages').set(cleanSlides);
    }
  } catch (fbErr) {
    console.warn('Firebase hero slider sync failed:', fbErr);
  }

  // 2. Debounced save to local backend & disk
  clearTimeout(heroSliderLiveTimeout);
  heroSliderLiveTimeout = setTimeout(async () => {
    try {
      await fetch(`${API}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
      await fetch(`${API}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
    } catch (apiErr) {
      console.warn('Backend save failed:', apiErr);
    }
  }, 400);
}



function renderStats(stats) {
  const container = document.getElementById('stats-container');
  container.innerHTML = stats.map((s, i) => `
    <div class="repeater-item">
      <div class="repeater-header">
        <h4><span class="repeater-num">${i + 1}</span> Stat ${i + 1}</h4>
        <button class="btn-remove" onclick="removeStat(${i})">🗑️</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Number/Value</label>
          <input type="text" value="${escapeAttr(s.number)}" onchange="siteData.home.stats[${i}].number=this.value">
        </div>
        <div class="form-group">
          <label>Label</label>
          <input type="text" value="${escapeAttr(s.label)}" onchange="siteData.home.stats[${i}].label=this.value">
        </div>
      </div>
    </div>
  `).join('') + `<button class="btn btn-sm" onclick="addStat()">+ Add Stat</button>`;
}

function addStat() {
  if (!siteData.home.stats) siteData.home.stats = [];
  siteData.home.stats.push({ number: '', label: '' });
  renderStats(siteData.home.stats);
}

function removeStat(i) {
  siteData.home.stats.splice(i, 1);
  renderStats(siteData.home.stats);
}

function renderFeaturedCards(cards) {
  const container = document.getElementById('featured-cards-container');
  container.innerHTML = cards.map((c, i) => `
    <div class="repeater-item">
      <div class="repeater-header">
        <h4><span class="repeater-num">${i + 1}</span> ${c.title || 'Card ' + (i+1)}</h4>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Category</label>
          <input type="text" value="${escapeAttr(c.category)}" onchange="siteData.home.featured.cards[${i}].category=this.value">
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" value="${escapeAttr(c.title)}" onchange="siteData.home.featured.cards[${i}].title=this.value">
        </div>
        <div class="form-group">
          <label>Image Path / URL</label>
          <input type="text" value="${escapeAttr(c.image)}" onchange="siteData.home.featured.cards[${i}].image=this.value">
          <div style="margin-top:8px;">
            <label style="font-size:0.8rem;">Or Upload to Cloudinary:</label>
            <input type="file" accept="image/*" onchange="uploadFeaturedToCloudinary(this, ${i})" style="font-size:0.85rem; padding: 4px;">
            ${getProgressCardHtml('featured-upload-progress-' + i, 'Uploading featured image...')}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderProcessSteps(steps) {
  const container = document.getElementById('process-steps-container');
  container.innerHTML = steps.map((s, i) => `
    <div class="repeater-item">
      <div class="repeater-header">
        <h4><span class="repeater-num">${s.number}</span> ${s.title}</h4>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Number</label>
          <input type="text" value="${escapeAttr(s.number)}" onchange="siteData.home.process.steps[${i}].number=this.value">
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" value="${escapeAttr(s.title)}" onchange="siteData.home.process.steps[${i}].title=this.value">
        </div>
        <div class="form-group form-full">
          <label>Description</label>
          <textarea rows="2" onchange="siteData.home.process.steps[${i}].text=this.value">${escapeHtml(s.text)}</textarea>
        </div>
      </div>
    </div>
  `).join('');
}

function renderTestimonials(items) {
  const container = document.getElementById('test-items-container');
  container.innerHTML = items.map((t, i) => `
    <div class="repeater-item">
      <div class="repeater-header">
        <h4><span class="repeater-num">${i + 1}</span> Client Word ${i + 1}</h4>
        <button class="btn-remove" onclick="removeTestimonial(${i})">🗑️</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Author / Client Name</label>
          <input type="text" value="${escapeAttr(t.author)}" onchange="siteData.home.testimonial.items[${i}].author=this.value">
        </div>
        <div class="form-group form-full">
          <label>Quote</label>
          <textarea rows="3" onchange="siteData.home.testimonial.items[${i}].quote=this.value">${escapeHtml(t.quote)}</textarea>
        </div>
      </div>
    </div>
  `).join('') + `<button class="btn btn-sm" onclick="addTestimonial()">+ Add Client Word</button>`;
}

function addTestimonial() {
  if (!siteData.home.testimonial.items) siteData.home.testimonial.items = [];
  siteData.home.testimonial.items.push({ quote: '', author: '' });
  renderTestimonials(siteData.home.testimonial.items);
}

function removeTestimonial(i) {
  siteData.home.testimonial.items.splice(i, 1);
  renderTestimonials(siteData.home.testimonial.items);
}

// ═══════ PROJECTS ═══════
function ensureProjectsNormalized() {
  if (!siteData) siteData = {};
  if (!siteData.projects || !Array.isArray(siteData.projects)) {
    siteData.projects = [];
  }
  siteData.projects.forEach((p, idx) => {
    if (!p || typeof p !== 'object') {
      siteData.projects[idx] = {
        id: idx + 1,
        title: 'Project ' + (idx + 1),
        category: 'architecture',
        description: '',
        thumbnail: '',
        images: []
      };
      return;
    }
    if (p.id === undefined || p.id === null || isNaN(Number(p.id))) {
      p.id = idx + 1;
    }
    p.title = typeof p.title === 'string' ? p.title : (p.title ? String(p.title) : 'New Project');
    p.category = p.category || 'architecture';
    p.description = typeof p.description === 'string' ? p.description : '';
    p.thumbnail = typeof p.thumbnail === 'string' ? p.thumbnail : '';

    if (!Array.isArray(p.images)) {
      if (typeof p.images === 'string' && p.images.trim()) {
        p.images = p.images.split('\n').map(s => s.trim()).filter(Boolean);
      } else {
        p.images = [];
      }
    } else {
      p.images = p.images.filter(img => typeof img === 'string' && img.trim());
    }
  });
}

function populateProjects() {
  ensureProjectsNormalized();
  renderProjectsList();
}

function renderGalleryPreviewsHtml(images, projIndex) {
  if (!Array.isArray(images) || images.length === 0) {
    return '<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic; margin-top:6px;">No gallery images added yet. Upload photos below.</div>';
  }
  return `
    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
      ${images.map((imgUrl, imgIdx) => `
        <div style="position:relative; width:80px; height:60px; border-radius:6px; overflow:hidden; border:1px solid var(--border); background:var(--bg); flex-shrink:0;" title="${escapeAttr(imgUrl)}">
          <img src="${getImageUrl(imgUrl)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.opacity='0.3'" alt="">
          <button type="button" onclick="removeProjectGalleryImage(${projIndex}, ${imgIdx}, event)" style="position:absolute; top:3px; right:3px; background:rgba(239,68,68,0.88); color:#fff; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; box-shadow:0 1px 3px rgba(0,0,0,0.3);" title="Delete this image">✕</button>
        </div>
      `).join('')}
    </div>
  `;
}

function updateProjectField(projIndex, field, value) {
  ensureProjectsNormalized();
  if (!siteData.projects[projIndex]) return;
  siteData.projects[projIndex][field] = value;

  if (field === 'title') {
    const titleEl = document.querySelector(`#proj-card-${projIndex} .project-admin-info h4`);
    if (titleEl) {
      titleEl.innerHTML = `<span style="font-size:0.75rem;color:var(--text-muted);font-weight:normal;margin-right:6px;">#${projIndex + 1}</span>${escapeHtml(value || 'Untitled Project')}`;
    }
  } else if (field === 'category') {
    const catEl = document.querySelector(`#proj-card-${projIndex} .project-admin-info .cat`);
    if (catEl) {
      catEl.textContent = value === 'rekhatan' ? 'रेखाटने' : value.charAt(0).toUpperCase() + value.slice(1);
    }
  } else if (field === 'thumbnail') {
    const cardThumb = document.querySelector(`#proj-card-${projIndex} .project-admin-thumb img`);
    if (cardThumb) {
      cardThumb.src = getImageUrl(value);
      cardThumb.style.display = value ? 'block' : 'none';
    }
    const previewThumb = document.getElementById(`proj-thumb-preview-${projIndex}`);
    if (previewThumb) {
      previewThumb.src = getImageUrl(value);
      previewThumb.style.display = value ? 'block' : 'none';
    }
  }
}

function updateProjectGalleryFromText(projIndex, textValue) {
  ensureProjectsNormalized();
  if (!siteData.projects[projIndex]) return;
  const lines = textValue.split('\n').map(x => x.trim()).filter(Boolean);
  siteData.projects[projIndex].images = lines;
  const previewContainer = document.getElementById(`proj-gallery-preview-${projIndex}`);
  if (previewContainer) {
    previewContainer.innerHTML = renderGalleryPreviewsHtml(lines, projIndex);
  }
}

function removeProjectGalleryImage(projIndex, imgIndex, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  ensureProjectsNormalized();
  const proj = siteData.projects[projIndex];
  if (!proj || !Array.isArray(proj.images)) return;

  const confirmed = confirm('Are you sure you want to delete this image?');
  if (!confirmed) return;

  // Remove image from memory
  proj.images.splice(imgIndex, 1);

  // Update textarea and previews in place without re-rendering or closing card
  const textarea = document.getElementById(`proj-gallery-textarea-${projIndex}`);
  if (textarea) {
    textarea.value = proj.images.join('\n');
  }
  const previewContainer = document.getElementById(`proj-gallery-preview-${projIndex}`);
  if (previewContainer) {
    previewContainer.innerHTML = renderGalleryPreviewsHtml(proj.images, projIndex);
  }

  showToast('Image removed from gallery', 'info');
}

async function saveProjectDirect(projIndex) {
  ensureProjectsNormalized();
  showLoading(true, 'Saving project...');
  try {
    // 1. Instant sync to Firebase RTDB (Live reflection on website)
    if (typeof db !== 'undefined' && db) {
      const cleanProjects = JSON.parse(JSON.stringify(siteData.projects || []));
      await db.ref('website/content/projects').set(cleanProjects);
    }

    // 2. Save to local data.json
    await fetch(`${API}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteData)
    });

    // 3. Publish to HTML
    await fetch(`${API}/publish`, { method: 'POST' });

    updateDashboard();
    showToast('Project saved successfully', 'success');
  } catch (err) {
    console.error('Save project error:', err);
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderProjectsList() {
  ensureProjectsNormalized();
  const container = document.getElementById('projects-list');
  if (!container) return;
  const projects = siteData.projects || [];
  if (projects.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>No projects yet.</p></div>';
    return;
  }
  container.innerHTML = projects.map((p, i) => `
    <div class="project-admin-card" id="proj-card-${i}" data-index="${i}">
      <div class="project-admin-header">
        <div class="project-drag-handle" title="Click & Drag to reorder" data-index="${i}">
          <span class="drag-line"></span>
          <span class="drag-line"></span>
        </div>
        <div class="project-admin-thumb">
          <img src="${getImageUrl(p.thumbnail)}" onerror="this.style.display='none'" alt="">
        </div>
        <div class="project-admin-info">
          <h4><span style="font-size:0.75rem;color:var(--text-muted);font-weight:normal;margin-right:6px;">#${i + 1}</span>${escapeHtml(p.title)}</h4>
          <div class="cat">${p.category === 'rekhatan' ? 'रेखाटने' : p.category.charAt(0).toUpperCase() + p.category.slice(1)}</div>
        </div>
        <div class="project-admin-actions">
          <button class="btn-reorder" title="Move Up" onclick="moveProject(${i}, -1)" ${i === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>▲</button>
          <button class="btn-reorder" title="Move Down" onclick="moveProject(${i}, 1)" ${i === projects.length - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>▼</button>
          <button class="btn btn-sm btn-edit-proj" id="btn-edit-${i}" onclick="toggleProjectEdit(${i}, event)">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="removeProject(${i})">🗑️</button>
        </div>
      </div>
      <div class="collapsible-content" id="proj-edit-${i}">
        <div class="form-grid">
          <div class="form-group">
            <label>Title</label>
            <input type="text" value="${escapeAttr(p.title)}" oninput="updateProjectField(${i}, 'title', this.value)" onchange="updateProjectField(${i}, 'title', this.value)">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select onchange="updateProjectField(${i}, 'category', this.value)">
              <option value="architecture" ${p.category==='architecture'?'selected':''}>Architecture</option>
              <option value="interior" ${p.category==='interior'?'selected':''}>Interior</option>
              <option value="residential" ${p.category==='residential'?'selected':''}>Residential</option>
              <option value="renovation" ${p.category==='renovation'?'selected':''}>Renovation</option>
              <option value="rekhatan" ${p.category==='rekhatan'?'selected':''}>रेखाटने (Rekhatan)</option>
            </select>
          </div>
          <div class="form-group form-full">
            <label>Description</label>
            <textarea rows="2" oninput="updateProjectField(${i}, 'description', this.value)" onchange="updateProjectField(${i}, 'description', this.value)">${escapeHtml(p.description)}</textarea>
          </div>
          <div class="form-group">
            <label>Thumbnail Image Path / URL</label>
            <div style="display:flex; gap:10px; align-items:center;">
              <input id="proj-thumb-input-${i}" type="text" style="flex:1;" value="${escapeAttr(p.thumbnail)}" oninput="updateProjectField(${i}, 'thumbnail', this.value)" onchange="updateProjectField(${i}, 'thumbnail', this.value)">
              <div style="width:50px; height:38px; border-radius:4px; overflow:hidden; border:1px solid var(--border); background:var(--bg); flex-shrink:0;">
                <img id="proj-thumb-preview-${i}" src="${getImageUrl(p.thumbnail)}" style="width:100%; height:100%; object-fit:cover; display:${p.thumbnail ? 'block' : 'none'};" onerror="this.style.display='none'" alt="">
              </div>
            </div>
            <div style="margin-top:8px;">
              <label style="font-size:0.8rem;">Or Upload Thumbnail to Cloudinary:</label>
              <input type="file" accept="image/*" onchange="uploadThumbnailToCloudinary(this, ${i})" style="font-size:0.85rem; padding: 4px;">
              ${getProgressCardHtml('proj-thumb-progress-' + i, 'Uploading thumbnail...')}
            </div>
          </div>
          <div class="form-group form-full">
            <label>Gallery Images (one path per line)</label>
            <textarea id="proj-gallery-textarea-${i}" rows="3" oninput="updateProjectGalleryFromText(${i}, this.value)" onchange="updateProjectGalleryFromText(${i}, this.value)">${(p.images||[]).join('\n')}</textarea>
            
            <div id="proj-gallery-preview-${i}">
              ${renderGalleryPreviewsHtml(p.images || [], i)}
            </div>
          </div>
          <div class="form-group form-full">
            <label>Upload Gallery Images to Cloudinary (Single or Multiple)</label>
            <input type="file" accept="image/*" multiple onchange="uploadImageToCloudinary(this, ${i})">
            ${getProgressCardHtml('proj-gallery-progress-' + i, 'Uploading gallery image...')}
            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">You can select one or multiple images to add to the gallery.</p>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:12px; border-top:1px dashed var(--border-light); flex-wrap:wrap; gap:8px;">
          <span style="font-size:0.75rem; color:var(--text-muted);">Click '✕ Close' or press Esc to collapse</span>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-sm btn-primary" onclick="saveProjectDirect(${i})">💾 Save Project</button>
            <button type="button" class="btn btn-sm" onclick="closeAllProjectEdits()">✕ Close Edit</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  initProjectDragAndDrop();
}

let draggedProjectIndex = null;
function initProjectDragAndDrop() {
  const cards = document.querySelectorAll('.project-admin-card');
  cards.forEach(card => {
    const handle = card.querySelector('.project-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => {
        card.setAttribute('draggable', 'true');
      });
      handle.addEventListener('touchstart', () => {
        card.setAttribute('draggable', 'true');
      }, { passive: true });
    }

    card.addEventListener('dragstart', (e) => {
      draggedProjectIndex = parseInt(card.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(draggedProjectIndex));
      card.classList.add('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!card.classList.contains('dragging')) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', (e) => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over');
      }
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetIndex = parseInt(card.dataset.index);
      if (draggedProjectIndex !== null && !isNaN(draggedProjectIndex) && draggedProjectIndex !== targetIndex) {
        const [moved] = siteData.projects.splice(draggedProjectIndex, 1);
        siteData.projects.splice(targetIndex, 0, moved);
        renderProjectsList();
        saveProjectsSequenceLive();
      }
    });

    card.addEventListener('dragend', () => {
      cards.forEach(c => {
        c.classList.remove('dragging', 'drag-over');
        c.setAttribute('draggable', 'false');
      });
      draggedProjectIndex = null;
    });
  });
}

function moveProject(index, direction) {
  const targetIndex = index + direction;
  if (!siteData.projects || targetIndex < 0 || targetIndex >= siteData.projects.length) return;
  const [moved] = siteData.projects.splice(index, 1);
  siteData.projects.splice(targetIndex, 0, moved);
  renderProjectsList();
  saveProjectsSequenceLive();
}

let projectSequenceTimeout = null;
async function saveProjectsSequenceLive(silent = false) {
  ensureProjectsNormalized();
  if (!silent) showToast('Updating project sequence...', 'info');

  // 1. Instant sync to Firebase RTDB (Live reflection on website)
  try {
    if (typeof db !== 'undefined' && db) {
      const cleanProjects = JSON.parse(JSON.stringify(siteData.projects || []));
      await db.ref('website/content/projects').set(cleanProjects);
    }
  } catch (fbErr) {
    console.warn('Firebase sequence sync failed:', fbErr);
  }

  // 2. Debounced save to local/server data.json & publish
  if (projectSequenceTimeout) clearTimeout(projectSequenceTimeout);
  projectSequenceTimeout = setTimeout(async () => {
    try {
      await fetch(`${API}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
      await fetch(`${API}/publish`, { method: 'POST' });
    } catch (e) {
      console.warn('Server save failed:', e);
    }
    if (!silent) showToast('Project sequence updated', 'success');
    updateDashboard();
  }, 400);
}

function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path; // Firebase Storage or Cloudinary URL
  return `https://architectsohanmali.com/${path}`; // Fetch from live site
}

function openProjectEdit(i) {
  closeAllProjectEdits();
  const editEl = document.getElementById('proj-edit-' + i);
  const cardEl = document.getElementById('proj-card-' + i);
  const btnEl = document.getElementById('btn-edit-' + i);
  if (!editEl) return;

  editEl.classList.add('open');
  cardEl?.classList.add('is-editing');
  if (btnEl) {
    btnEl.innerHTML = '✕ Close';
    btnEl.classList.add('btn-editing-active');
  }
}

function toggleProjectEdit(i, event) {
  if (event) {
    event.stopPropagation();
  }
  const editEl = document.getElementById('proj-edit-' + i);
  const cardEl = document.getElementById('proj-card-' + i);
  const btnEl = document.getElementById('btn-edit-' + i);
  if (!editEl) return;

  const wasOpen = editEl.classList.contains('open');

  // Pehle kisi bhi dusre open project edit drawer ko band karo
  closeAllProjectEdits();

  if (!wasOpen) {
    editEl.classList.add('open');
    cardEl?.classList.add('is-editing');
    if (btnEl) {
      btnEl.innerHTML = '✕ Close';
      btnEl.classList.add('btn-editing-active');
    }
  }
}

function closeAllProjectEdits() {
  document.querySelectorAll('.collapsible-content.open').forEach(el => {
    el.classList.remove('open');
  });
  document.querySelectorAll('.project-admin-card.is-editing').forEach(card => {
    card.classList.remove('is-editing');
  });
  document.querySelectorAll('.btn-edit-proj').forEach(btn => {
    btn.innerHTML = '✏️ Edit';
    btn.classList.remove('btn-editing-active');
  });
}

// Click outside open project card to collapse edit drawer
document.addEventListener('click', (e) => {
  const openEdit = document.querySelector('.collapsible-content.open');
  if (!openEdit) return;

  // Don't close if clicked inside any project card or child element
  if (e.target && e.target.closest && e.target.closest('.project-admin-card')) {
    return;
  }

  // If element was detached from DOM (e.g. during an in-place action like delete), don't close
  if (!document.body.contains(e.target)) {
    return;
  }

  closeAllProjectEdits();
});

// Esc key dabane par bhi open edit drawer collapse ho jaye
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllProjectEdits();
  }
});

function addProject() {
  ensureProjectsNormalized();
  const maxId = siteData.projects.reduce((max, p) => {
    const idNum = Number(p && p.id);
    return !isNaN(idNum) && idNum > max ? idNum : max;
  }, 0);
  const newId = maxId + 1;

  // Place newly added project at the TOP (#1) so it's immediately prominent
  siteData.projects.unshift({
    id: newId,
    title: 'New Project',
    category: 'architecture',
    description: 'Project description here.',
    thumbnail: '',
    images: []
  });
  renderProjectsList();
  openProjectEdit(0);
  // Do NOT sync to live website yet — will sync when user clicks "Save Project"
  showToast('New project created', 'success');
}

function removeProject(i) {
  const p = (siteData.projects || [])[i];
  const pTitle = (p && p.title) ? `"${p.title}"` : 'this project';
  if (confirm(`Are you sure you want to delete ${pTitle}?`)) {
    siteData.projects.splice(i, 1);
    renderProjectsList();
    saveProjectsSequenceLive();
    updateDashboard();
    showToast('Project deleted successfully', 'success');
  }
}

// ── Cloudinary Upload ──
async function uploadImageToCloudinary(input, projIndex) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  ensureProjectsNormalized();
  const proj = siteData.projects && siteData.projects[projIndex];
  if (!proj) {
    showToast('Project not found', 'error');
    return;
  }

  const progressEl = document.getElementById(`proj-gallery-progress-${projIndex}`);
  const folder = getProjectFolder(proj.category);
  const totalFiles = files.length;
  let uploadedCount = 0;

  // Immediate visual feedback on file selection
  const initialLabel = totalFiles > 1 ? `Uploading 1 of ${totalFiles}` : 'Uploading image...';
  updateProgressCard(progressEl, 8, initialLabel, `Preparing ${files[0].name}...`);

  try {
    if (!Array.isArray(proj.images)) {
      proj.images = [];
    }

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const url = await uploadFileToCloudinary(file, folder, (filePct) => {
        const overall = Math.round(((i + (filePct / 100)) / totalFiles) * 100);
        const label = totalFiles > 1 ? `Uploading ${i + 1} of ${totalFiles}` : 'Uploading image...';
        updateProgressCard(progressEl, overall, label, file.name);
      });
      proj.images.push(url);
      uploadedCount++;
    }

    updateProgressCard(progressEl, 100, 'Upload complete', `${uploadedCount} image(s) processed`);

    // Update textarea and visual preview in place without re-rendering or closing card
    const textarea = document.getElementById(`proj-gallery-textarea-${projIndex}`);
    if (textarea) {
      textarea.value = proj.images.join('\n');
    }
    const previewContainer = document.getElementById(`proj-gallery-preview-${projIndex}`);
    if (previewContainer) {
      previewContainer.innerHTML = renderGalleryPreviewsHtml(proj.images, projIndex);
    }

    // Changes remain in draft state until user clicks "Save Project"
    showToast(uploadedCount > 1 ? `${uploadedCount} images uploaded successfully` : 'Image uploaded successfully', 'success');
  } catch (err) {
    console.error('Upload error:', err);
    hideProgressCard(progressEl);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

async function uploadThumbnailToCloudinary(input, projIndex) {
  const file = input.files[0];
  if (!file) return;

  ensureProjectsNormalized();
  const proj = siteData.projects && siteData.projects[projIndex];
  if (!proj) {
    showToast('Project not found', 'error');
    return;
  }

  const progressEl = document.getElementById(`proj-thumb-progress-${projIndex}`);
  updateProgressCard(progressEl, 8, 'Uploading thumbnail...', file.name);

  try {
    const url = await uploadFileToCloudinary(file, getProjectFolder(proj.category), (pct) => {
      updateProgressCard(progressEl, pct, 'Uploading thumbnail...', file.name);
    });
    proj.thumbnail = url;
    updateProgressCard(progressEl, 100, 'Upload complete', 'Thumbnail ready');

    // Update thumbnail input and preview in place without re-rendering or closing card
    const thumbInput = document.getElementById(`proj-thumb-input-${projIndex}`);
    if (thumbInput) thumbInput.value = url;

    const thumbPreview = document.getElementById(`proj-thumb-preview-${projIndex}`);
    if (thumbPreview) {
      thumbPreview.src = getImageUrl(url);
      thumbPreview.style.display = 'block';
    }

    const cardThumb = document.querySelector(`#proj-card-${projIndex} .project-admin-thumb img`);
    if (cardThumb) {
      cardThumb.src = getImageUrl(url);
      cardThumb.style.display = 'block';
    }

    showToast('Thumbnail uploaded successfully', 'success');
  } catch (err) {
    console.error('Thumbnail upload error:', err);
    hideProgressCard(progressEl);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

async function uploadFeaturedToCloudinary(input, cardIndex) {
  const file = input.files[0];
  if (!file) return;
  const progressEl = document.getElementById(`featured-upload-progress-${cardIndex}`);
  updateProgressCard(progressEl, 8, 'Uploading featured image...', file.name);

  try {
    const url = await uploadFileToCloudinary(file, 'featured', (pct) => {
      updateProgressCard(progressEl, pct, 'Uploading featured image...', file.name);
    });
    siteData.home.featured.cards[cardIndex].image = url;
    updateProgressCard(progressEl, 100, 'Upload complete', 'Image ready');
    populateHome();
    showToast('Image uploaded successfully', 'success');
  } catch (err) {
    hideProgressCard(progressEl);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

async function uploadPhilosophyImage(input) {
  const file = input.files[0];
  if (!file) return;
  const progressEl = document.getElementById('phil-upload-progress');
  updateProgressCard(progressEl, 8, 'Uploading philosophy image...', file.name);

  try {
    const url = await uploadFileToCloudinary(file, 'philosophy', (pct) => {
      updateProgressCard(progressEl, pct, 'Uploading philosophy image...', file.name);
    });
    if (!siteData.home.philosophy) siteData.home.philosophy = {};
    siteData.home.philosophy.image = url;
    setValue('phil-image', url);
    const prev = document.getElementById('phil-image-preview');
    if (prev) prev.src = url;
    updateProgressCard(progressEl, 100, 'Upload complete', 'Image ready');
    showToast('Image uploaded successfully', 'success');
  } catch (err) {
    hideProgressCard(progressEl);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

async function uploadAboutImage(input) {
  const file = input.files[0];
  if (!file) return;
  const progressEl = document.getElementById('about-upload-progress');
  updateProgressCard(progressEl, 8, 'Uploading sketch photo...', file.name);

  try {
    const url = await uploadFileToCloudinary(file, 'about', (pct) => {
      updateProgressCard(progressEl, pct, 'Uploading sketch photo...', file.name);
    });
    if (!siteData.about) siteData.about = {};
    siteData.about.image = url;
    setValue('about-image', url);
    const prev = document.getElementById('about-image-preview');
    if (prev) prev.src = url;
    updateProgressCard(progressEl, 100, 'Upload complete', 'Photo ready');
    showToast('Photo uploaded successfully', 'success');
  } catch (err) {
    hideProgressCard(progressEl);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

function getProjectFolder(category) {
  const map = { architecture: 'arch', interior: 'interior', residential: 'red', renovation: 'ren', rekhatan: 'paint' };
  return map[category] || 'images';
}

async function uploadFounderImage(input) {
  const file = input.files[0];
  if (!file) return;
  const progressEl = document.getElementById('founder-upload-progress');
  updateProgressCard(progressEl, 8, 'Uploading portrait...', file.name);

  try {
    const url = await uploadFileToCloudinary(file, 'founder', (pct) => {
      updateProgressCard(progressEl, pct, 'Uploading portrait...', file.name);
    });
    if (!siteData.about) siteData.about = {};
    if (!siteData.about.founder) siteData.about.founder = {};
    siteData.about.founder.image = url;
    setValue('founder-image', url);
    const prev = document.getElementById('founder-image-preview');
    if (prev) prev.src = url;
    updateProgressCard(progressEl, 100, 'Upload complete', 'Photo ready');
    showToast('Photo uploaded successfully', 'success');
  } catch (err) {
    hideProgressCard(progressEl);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

async function uploadTeamMemberImage(input, index) {
  const file = input.files[0];
  if (!file) return;

  try {
    const url = await uploadFileToCloudinary(file, 'team');
    if (!siteData.about) siteData.about = {};
    if (!siteData.about.team) siteData.about.team = { members: [] };
    if (!siteData.about.team.members) siteData.about.team.members = [];
    if (siteData.about.team.members[index]) {
      siteData.about.team.members[index].image = url;
    }
    renderTeamMembers(siteData.about.team.members);
    showToast('Photo uploaded successfully', 'success');
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

// ═══════ ABOUT ═══════
function populateAbout() {
  const a = siteData.about;
  if (!a) return;
  setValue('about-image', a.image || '');
  const aboutPreview = document.getElementById('about-image-preview');
  if (aboutPreview) aboutPreview.src = a.image || 'images/placeholder.jpg';
  setValue('about-label', a.label);
  setValue('about-lead', a.lead);
  setValue('about-text1', a.text1);
  setValue('about-text2', a.text2);
  const statsContainer = document.getElementById('about-stats-container');
  statsContainer.innerHTML = (a.stats || []).map((s, i) => `
    <div class="repeater-item" style="display:inline-block;width:30%;margin-right:3%;vertical-align:top;">
      <div class="form-group"><label>Number</label>
        <input type="text" value="${escapeAttr(s.number)}" onchange="siteData.about.stats[${i}].number=this.value">
      </div>
      <div class="form-group"><label>Label</label>
        <input type="text" value="${escapeAttr(s.label)}" onchange="siteData.about.stats[${i}].label=this.value">
      </div>
    </div>
  `).join('');
  setValue('principles-label', a.principles ? a.principles.label : '');
  setValue('principles-title-line1', a.principles ? a.principles.title_line1 : '');
  setValue('principles-title-em', a.principles ? a.principles.title_em : '');
  if (!a.principles) a.principles = { items: [] };
  if (!a.principles.items) a.principles.items = [];
  renderPrinciples(a.principles.items);

  // ── Founder Spotlight ──
  const f = a.founder || {
    name: "Ar. Sohan Mali",
    role: "Founder & Principal Architect",
    credentials: "B.Arch, COA Registered Architect",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
    quote: "Architecture is not merely about creating structures; it is the art of sculpting spaces that elevate human consciousness and create enduring memories.",
    bio: "With over a decade of dedicated architectural practice, Ar. Sohan Mali has spearheaded benchmark residential, commercial, and heritage restoration projects across Maharashtra and beyond. Guided by the philosophy of timeless aesthetics and functional purity, his work seamlessly bridges traditional craftsmanship with contemporary innovation."
  };
  siteData.about.founder = f;
  setValue('founder-name', f.name || '');
  setValue('founder-role', f.role || '');
  setValue('founder-credentials', f.credentials || '');
  setValue('founder-image', f.image || '');
  setValue('founder-quote', f.quote || '');
  setValue('founder-bio', f.bio || '');
  const founderPreview = document.getElementById('founder-image-preview');
  if (founderPreview) {
    founderPreview.src = f.image || 'images/placeholder.jpg';
  }

  // ── Team Members ──
  const t = a.team || {
    label: "The Studio",
    title_line1: "Minds Behind the",
    title_em: "Architecture",
    description: "Our multidisciplinary studio brings together passionate architects, interior designers, and visualization specialists united by a commitment to spatial excellence and refined craftsmanship.",
    members: [
      {
        name: "Ar. Ananya Deshmukh",
        role: "Senior Associate Architect",
        experience: "8+ Years Exp.",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
        bio: "Specializes in sustainable residential architecture, climate-responsive design, and master spatial planning."
      },
      {
        name: "Rahul Verma",
        role: "Lead Interior Designer",
        experience: "6+ Years Exp.",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
        bio: "Master of bespoke materiality, custom millwork, and warm, minimalist luxury interiors."
      },
      {
        name: "Sneha Kulkarni",
        role: "3D Architectural Visualizer",
        experience: "5+ Years Exp.",
        image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
        bio: "Brings spatial blueprints to life with photorealistic rendering, lighting choreography, and digital walkthroughs."
      },
      {
        name: "Vikram Rathore",
        role: "Project & Site Engineer",
        experience: "7+ Years Exp.",
        image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80",
        bio: "Ensures design intent translates flawlessly on site through rigorous engineering oversight and quality control."
      }
    ]
  };
  siteData.about.team = t;
  setValue('team-label', t.label || '');
  setValue('team-title-line1', t.title_line1 || '');
  setValue('team-title-em', t.title_em || '');
  setValue('team-description', t.description || '');

  renderTeamMembers(t.members || []);
}

function renderTeamMembers(members) {
  const container = document.getElementById('team-members-container');
  if (!container) return;
  if (!members || members.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:24px;"><p>No team members added yet. Click "+ Add Team Member" to create one.</p></div>';
    return;
  }
  container.innerHTML = members.map((m, i) => `
    <div class="repeater-item" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px;background:var(--bg-secondary);">
      <div class="repeater-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;font-size:0.95rem;display:flex;align-items:center;gap:8px;">
          <span class="repeater-num" style="background:var(--primary);color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;">${i + 1}</span>
          ${escapeHtml(m.name || 'Member ' + (i + 1))}
          ${m.role ? `<span style="font-weight:normal;font-size:0.8rem;color:var(--text-muted);">— ${escapeHtml(m.role)}</span>` : ''}
        </h4>
        <button class="btn btn-sm btn-danger" onclick="removeTeamMember(${i})" title="Remove Member">🗑️ Remove</button>
      </div>

      <div style="display:flex;gap:16px;margin-bottom:12px;align-items:flex-start;flex-wrap:wrap;">
        <img id="team-img-preview-${i}" src="${escapeAttr(m.image || 'images/placeholder.jpg')}" style="width:70px;height:85px;object-fit:cover;border-radius:6px;border:1px solid var(--border);background:var(--bg-card);" onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlIi8+PC9zdmc+';" />
        <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:0.8rem;font-weight:600;">Member Photo</label>
          <div style="display:flex;gap:8px;">
            <input type="text" value="${escapeAttr(m.image || '')}" onchange="siteData.about.team.members[${i}].image=this.value; const el=document.getElementById('team-img-preview-${i}'); if(el) el.src=this.value;" placeholder="Image URL / Cloudinary URL" style="flex:1;">
            <label class="btn btn-sm btn-primary" style="margin:0;cursor:pointer;white-space:nowrap;color:#ffffff !important;">
              📁 Upload Photo
              <input type="file" accept="image/*" onchange="uploadTeamMemberImage(this, ${i})" style="display:none;">
            </label>
          </div>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" value="${escapeAttr(m.name || '')}" onchange="siteData.about.team.members[${i}].name=this.value" placeholder="e.g. Ar. Ananya Deshmukh">
        </div>
        <div class="form-group">
          <label>Role / Designation</label>
          <input type="text" value="${escapeAttr(m.role || '')}" onchange="siteData.about.team.members[${i}].role=this.value" placeholder="e.g. Senior Associate Architect">
        </div>
        <div class="form-group form-full">
          <label>Experience Badge (Optional)</label>
          <input type="text" value="${escapeAttr(m.experience || '')}" onchange="siteData.about.team.members[${i}].experience=this.value" placeholder="e.g. 8+ Years Exp.">
        </div>
        <div class="form-group form-full">
          <label>Bio / Specialization</label>
          <textarea rows="2" onchange="siteData.about.team.members[${i}].bio=this.value" placeholder="Brief description of their architectural expertise...">${escapeHtml(m.bio || '')}</textarea>
        </div>
      </div>
    </div>
  `).join('');
}

function addTeamMember() {
  if (!siteData.about) siteData.about = {};
  if (!siteData.about.team) siteData.about.team = { members: [] };
  if (!siteData.about.team.members) siteData.about.team.members = [];
  siteData.about.team.members.push({
    name: 'New Team Member',
    role: 'Associate Architect',
    experience: '3+ Years Exp.',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    bio: 'Dedicated to architectural design and spatial innovation.'
  });
  renderTeamMembers(siteData.about.team.members);
  showToast('➕ New team member card added! Fill in their details and click Save.', 'info');
}

function removeTeamMember(i) {
  const m = siteData.about?.team?.members?.[i];
  const mName = (m && m.name) ? `"${m.name}"` : 'this team member';
  if (confirm(`Are you sure you want to remove ${mName}?`)) {
    siteData.about.team.members.splice(i, 1);
    renderTeamMembers(siteData.about.team.members);
    showToast('Team member removed from list', 'info');
  }
}

// ── Principles Logic ──
function renderPrinciples(items) {
  const container = document.getElementById('principles-container');
  if (!container) return;
  container.innerHTML = items.map((p, i) => `
    <div class="repeater-item">
      <div class="repeater-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h4><span class="repeater-num">${i + 1}</span> ${escapeHtml(p.title || 'New Principle')}</h4>
        <button class="btn btn-sm btn-danger" onclick="removePrinciple(${i})" style="padding:4px 8px;font-size:0.8rem;background:var(--danger);color:#fff;border:none;border-radius:4px;cursor:pointer;">🗑️ Remove</button>
      </div>
      <div class="form-group"><label>Title</label>
        <input type="text" value="${escapeAttr(p.title)}" onchange="siteData.about.principles.items[${i}].title=this.value">
      </div>
      <div class="form-group"><label>Description</label>
        <textarea rows="3" onchange="siteData.about.principles.items[${i}].text=this.value">${escapeHtml(p.text)}</textarea>
      </div>
    </div>
  `).join('');
}

function addPrinciple() {
  if (!siteData.about) siteData.about = {};
  if (!siteData.about.principles) siteData.about.principles = { items: [] };
  if (!siteData.about.principles.items) siteData.about.principles.items = [];
  siteData.about.principles.items.push({
    title: "New Principle",
    text: "Description goes here..."
  });
  renderPrinciples(siteData.about.principles.items);
  showToast('➕ New principle added!', 'info');
}

function removePrinciple(index) {
  if (confirm("Are you sure you want to remove this principle?")) {
    if (siteData.about && siteData.about.principles && siteData.about.principles.items) {
      siteData.about.principles.items.splice(index, 1);
      renderPrinciples(siteData.about.principles.items);
      showToast('Principle removed', 'info');
    }
  }
}

async function uploadAboutImage(input) {
  const file = input.files[0];
  if (!file) return;
  showLoading(true);
  try {
    const url = await uploadFileToCloudinary(file, 'about');
    if (!siteData.about) siteData.about = {};
    siteData.about.image = url;
    setValue('about-image', url);
    const preview = document.getElementById('about-image-preview');
    if (preview) preview.src = url;
    showToast('☁️ About image uploaded successfully!', 'success');
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    input.value = '';
    showLoading(false);
  }
}

// ═══════ SERVICES ═══════
function populateServices() {
  const s = siteData.services;
  if (!s) return;
  setValue('svc-page-label', s.label);
  setValue('svc-page-title-line1', s.title_line1);
  setValue('svc-page-title-em', s.title_em);
  setValue('svc-page-desc', s.description);

  renderServices(s.items || []);

  if (s.cta) {
    setValue('cta-label', s.cta.label);
    setValue('cta-title-line1', s.cta.title_line1);
    setValue('cta-title-line2', s.cta.title_line2);
    setValue('cta-title-em', s.cta.title_em);
    setValue('cta-text', s.cta.text);
    setValue('cta-button', s.cta.button);
  }
}

function renderServices(items) {
  const container = document.getElementById('services-container');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:24px;"><p>No services added yet. Click "+ Add Service" to create one.</p></div>';
    return;
  }
  container.innerHTML = items.map((svc, i) => `
    <div class="repeater-item" id="service-card-${i}" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px;background:var(--bg-secondary);">
      <div class="repeater-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="margin:0;font-size:0.95rem;display:flex;align-items:center;gap:8px;">
          <span class="repeater-num" style="background:var(--primary);color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;">${escapeHtml(svc.number || (i < 9 ? '0' + (i + 1) : String(i + 1)))}</span>
          <span id="service-title-display-${i}">${escapeHtml(svc.title || 'Service ' + (i + 1))}</span>
          <span id="service-icon-display-${i}" style="font-size:1.1rem;margin-left:4px;">${svc.icon ? escapeHtml(svc.icon) : ''}</span>
        </h4>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeService(${i})" title="Remove Service" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">🗑️ Remove</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Number</label>
          <input type="text" value="${escapeAttr(svc.number || '')}" oninput="siteData.services.items[${i}].number=this.value" placeholder="e.g. 01">
        </div>
        <div class="form-group">
          <label>Icon (emoji / symbol)</label>
          <input type="text" value="${escapeAttr(svc.icon || '')}" oninput="siteData.services.items[${i}].icon=this.value; const ic=document.getElementById('service-icon-display-${i}'); if(ic) ic.textContent=this.value;" placeholder="e.g. 🏛️, 📐, ✦, ◈, 🌿">
        </div>
        <div class="form-group form-full">
          <label>Title</label>
          <input type="text" value="${escapeAttr(svc.title || '')}" oninput="siteData.services.items[${i}].title=this.value; const td=document.getElementById('service-title-display-${i}'); if(td) td.textContent=this.value || ('Service ' + (${i} + 1));" placeholder="e.g. Architectural Planning">
        </div>
        <div class="form-group form-full">
          <label>Description</label>
          <textarea rows="3" oninput="siteData.services.items[${i}].text=this.value" placeholder="Detailed service description...">${escapeHtml(svc.text || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label>Features / Deliverables (one per line)</label>
          <textarea rows="4" oninput="siteData.services.items[${i}].features=this.value.split('\\n').filter(x=>x.trim())" placeholder="Feature 1\\nFeature 2\\nFeature 3">${(svc.features || []).join('\n')}</textarea>
        </div>
      </div>
    </div>
  `).join('');
}

function addService() {
  if (!siteData.services) siteData.services = {};
  if (!siteData.services.items) siteData.services.items = [];
  const nextCount = siteData.services.items.length + 1;
  const nextNum = nextCount < 10 ? '0' + nextCount : String(nextCount);
  const sampleIcons = ['🏛️', '📐', '✦', '◈', '🌿', '💡', '🏗️', '🎨', '⚙️', '🔍'];
  const nextIcon = sampleIcons[(nextCount - 1) % sampleIcons.length];

  siteData.services.items.push({
    number: nextNum,
    icon: nextIcon,
    title: 'New Service ' + nextNum,
    text: 'We deliver comprehensive architectural solutions crafted with precision and innovative design principles.',
    features: [
      'Initial consultation & spatial assessment',
      'Concept schematic design & drafting',
      'Material specification & coordination',
      'Final project execution & handover'
    ]
  });

  renderServices(siteData.services.items);
  updateDashboard();
  showToast('➕ New service #' + nextNum + ' added! Edit details and click Save.', 'info');
}

function removeService(i) {
  if (!siteData.services || !Array.isArray(siteData.services.items)) {
    console.error('siteData.services.items is not available');
    return;
  }
  const svc = siteData.services.items[i];
  const svcTitle = (svc && svc.title) ? `"${svc.title}"` : 'this service';

  if (window.confirm(`Are you sure you want to remove ${svcTitle}?`)) {
    siteData.services.items.splice(i, 1);
    renderServices(siteData.services.items);
    updateDashboard();
    showToast('Service removed successfully. Click "Save Services" to apply changes.', 'success');
  }
}

window.addService = addService;
window.removeService = removeService;

// ═══════ CONTACT ═══════
function populateContact() {
  const c = siteData.contact;
  if (!c) return;
  setValue('contact-label', c.label);
  setValue('contact-lead', c.lead);
  setValue('contact-email', c.email);
  setValue('contact-phone', c.phone);
  setValue('contact-studios', c.studios);
  setValue('contact-service-options', (c.service_options || []).join('\n'));
  setValue('contact-budget-options', (c.budget_options || []).join('\n'));
}

// ═══════ MESSAGES ═══════
let messagesListener = null;
let initialMessagesLoaded = false;
let messagesCount = 0;

function setupMessagesListener() {
  if (messagesListener) return; // Only setup once
  
  const container = document.getElementById('messages-list');
  if (container) {
    container.innerHTML = '<div class="empty-state"><div class="spinner" style="margin: 0 auto; display:block;"></div><p>Loading messages...</p></div>';
  }

  const messagesRef = db.ref('website/messages');
  messagesListener = messagesRef.on('value', (snapshot) => {
    const listContainer = document.getElementById('messages-list');
    
    if (snapshot.exists()) {
      const messagesObj = snapshot.val();
      const messagesArr = Object.entries(messagesObj).map(([id, data]) => ({ id, ...data }));
      messagesArr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      // Notify if new message arrived after initial load
      if (initialMessagesLoaded && messagesArr.length > messagesCount) {
        showToast('💬 Naya client message receive hua hai!', 'success');
        playNotification();
      }
      
      messagesCount = messagesArr.length;
      initialMessagesLoaded = true;
      
      if (!listContainer) return;

      if (messagesArr.length === 0) {
        listContainer.innerHTML = '<div class="empty-state"><div class="icon">💬</div><p>No messages yet.</p></div>';
        return;
      }

      listContainer.innerHTML = messagesArr.map(m => {
        const date = m.createdAt ? new Date(m.createdAt).toLocaleString() : 'Unknown Date';
        const initial = (m.firstName || '?')[0].toUpperCase();
        return `
        <div class="message-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); overflow: hidden; transition: transform 0.2s;">
          <div class="message-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.2);">
                ${initial}
              </div>
              <div>
                <h3 style="margin: 0 0 4px 0; font-size: 1.15rem; color: #0f172a; font-weight: 700;">${escapeHtml(m.firstName || '')} ${escapeHtml(m.lastName || '')}</h3> 
                <a href="mailto:${escapeAttr(m.email)}" style="color: #64748b; font-size: 0.9rem; text-decoration: none; transition: color 0.2s; display: inline-block;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#64748b'">${escapeHtml(m.email)}</a>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px; font-weight: 600;">${date}</div>
              <button class="btn btn-sm" onclick="deleteMessage('${m.id}')" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 6px; background-color: #fee2e2; color: #ef4444; border: 1px solid #fecaca; cursor: pointer; transition: all 0.2s; font-weight: 600;" onmouseover="this.style.backgroundColor='#fecaca'" onmouseout="this.style.backgroundColor='#fee2e2'">🗑️ Delete</button>
            </div>
          </div>
          <div class="message-card-body" style="padding: 24px;">
            <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
              <span style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">📌 Service: ${escapeHtml(m.service || 'N/A')}</span>
              <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">💰 Budget: ${escapeHtml(m.budget || 'N/A')}</span>
            </div>
            <div style="color: #334155; font-size: 1rem; line-height: 1.7; white-space: pre-wrap; background: #ffffff; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">${escapeHtml(m.message || '')}</div>
          </div>
        </div>
        `;
      }).join('');
    } else {
      initialMessagesLoaded = true;
      messagesCount = 0;
      if (listContainer) {
        listContainer.innerHTML = '<div class="empty-state"><div class="icon">💬</div><p>No messages yet.</p></div>';
      }
    }
  });
}

async function deleteMessage(id) {
  if (!confirm("Are you sure you want to delete this message?")) return;
  try {
    await db.ref('website/messages/' + id).remove();
    showToast('Message deleted', 'success');
  } catch (err) {
    showToast('Failed to delete message: ' + err.message, 'error');
  }
}

// ═══════ FOOTER ═══════
function populateFooter() {
  const f = siteData.footer;
  if (!f) return;
  setValue('footer-logo', f.logo);
  setValue('footer-tagline', f.tagline);
  setValue('footer-copyright', f.copyright);
  setValue('footer-crafted', f.crafted);
  setValue('footer-email', f.email);
  setValue('footer-phone', f.phone);
  setValue('footer-locations', f.locations);
  setValue('footer-social', (f.social || []).join('\n'));
}

// ═══════ SITE SETTINGS ═══════
function populateSite() {
  const s = siteData.site;
  if (!s) return;
  setValue('site-logo', s.logo);
  setValue('site-nav-cta', s.nav_cta);
}

// ═══════ SAVE SECTION (Firebase + Local) ═══════
async function saveSection(section) {
  collectFormData(section);
  showLoading(true);
  try {
    // Save to Firebase RTDB
    try {
      const cleanData = JSON.parse(JSON.stringify(siteData));
      await db.ref('website/content').set(cleanData);
    } catch (fbErr) {
      console.warn('Firebase save failed, proceeding with local save:', fbErr);
    }
    
    // Also save to local data.json as backup
    await fetch(`${API}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteData)
    });

    // Publish to HTML to make initial loading INSTANT for the website!
    await fetch(`${API}/publish`, { method: 'POST' });

    showToast(section.charAt(0).toUpperCase() + section.slice(1) + ' saved successfully', 'success');
    updateDashboard();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
  showLoading(false);
}

function collectFormData(section) {
  switch (section) {
    case 'projects':
      if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
      break;
    case 'home':
      siteData.home.hero.badge = getValue('hero-badge');
      siteData.home.hero.title_line1 = getValue('hero-title');
      siteData.home.hero.title_highlight = getValue('hero-highlight');
      siteData.home.hero.btn_primary = getValue('hero-btn-primary');
      siteData.home.hero.btn_secondary = getValue('hero-btn-secondary');
      siteData.home.featured.label = getValue('featured-label');
      siteData.home.featured.title_line1 = getValue('featured-title-line1');
      siteData.home.featured.title_em = getValue('featured-title-em');
      siteData.home.philosophy.label = getValue('phil-label');
      siteData.home.philosophy.title_line1 = getValue('phil-title-line1');
      siteData.home.philosophy.title_em = getValue('phil-title-em');
      siteData.home.philosophy.text = getValue('phil-text');
      siteData.home.philosophy.image = getValue('phil-image');
      siteData.home.process.label = getValue('process-label');
      siteData.home.process.title_line1 = getValue('process-title-line1');
      siteData.home.process.title_em = getValue('process-title-em');
      siteData.home.testimonial.label = getValue('test-label');
      break;
    case 'about':
      siteData.about.image = getValue('about-image');
      siteData.about.label = getValue('about-label');
      siteData.about.lead = getValue('about-lead');
      siteData.about.text1 = getValue('about-text1');
      siteData.about.text2 = getValue('about-text2');
      if (!siteData.about.principles) siteData.about.principles = { items: [] };
      siteData.about.principles.label = getValue('principles-label');
      siteData.about.principles.title_line1 = getValue('principles-title-line1');
      siteData.about.principles.title_em = getValue('principles-title-em');

      if (!siteData.about.founder) siteData.about.founder = {};
      siteData.about.founder.name = getValue('founder-name');
      siteData.about.founder.role = getValue('founder-role');
      siteData.about.founder.credentials = getValue('founder-credentials');
      siteData.about.founder.image = getValue('founder-image');
      siteData.about.founder.quote = getValue('founder-quote');
      siteData.about.founder.bio = getValue('founder-bio');

      if (!siteData.about.team) siteData.about.team = { members: [] };
      siteData.about.team.label = getValue('team-label');
      siteData.about.team.title_line1 = getValue('team-title-line1');
      siteData.about.team.title_em = getValue('team-title-em');
      siteData.about.team.description = getValue('team-description');
      break;
    case 'services':
      siteData.services.label = getValue('svc-page-label');
      siteData.services.title_line1 = getValue('svc-page-title-line1');
      siteData.services.title_em = getValue('svc-page-title-em');
      siteData.services.description = getValue('svc-page-desc');
      siteData.services.cta = {
        label: getValue('cta-label'), title_line1: getValue('cta-title-line1'),
        title_line2: getValue('cta-title-line2'), title_em: getValue('cta-title-em'),
        text: getValue('cta-text'), button: getValue('cta-button')
      };
      break;
    case 'contact':
      siteData.contact.label = getValue('contact-label');
      siteData.contact.lead = getValue('contact-lead');
      siteData.contact.email = getValue('contact-email');
      siteData.contact.phone = getValue('contact-phone');
      siteData.contact.studios = getValue('contact-studios');
      siteData.contact.service_options = getValue('contact-service-options').split('\n').filter(x => x.trim());
      siteData.contact.budget_options = getValue('contact-budget-options').split('\n').filter(x => x.trim());
      break;
    case 'footer':
      siteData.footer.logo = getValue('footer-logo');
      siteData.footer.tagline = getValue('footer-tagline');
      siteData.footer.copyright = getValue('footer-copyright');
      siteData.footer.crafted = getValue('footer-crafted');
      siteData.footer.email = getValue('footer-email');
      siteData.footer.phone = getValue('footer-phone');
      siteData.footer.locations = getValue('footer-locations');
      siteData.footer.social = getValue('footer-social').split('\n').filter(x => x.trim());
      break;
    case 'site':
      siteData.site.logo = getValue('site-logo');
      siteData.site.nav_cta = getValue('site-nav-cta');
      break;
  }
}

function collectAllFormData() {
  ['home', 'about', 'services', 'contact', 'footer', 'site'].forEach(s => collectFormData(s));
  if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
}

// ═══════ PUBLISH (Firebase → HTML) ═══════
async function publishSite() {
  collectAllFormData();
  if (typeof ensureProjectsNormalized === 'function') ensureProjectsNormalized();
  showLoading(true, 'Publishing changes...');
  try {
    // Save to Firebase first
    try {
      await db.ref('website/content').set(siteData);
    } catch (fbErr) {
      console.warn('Firebase save failed, proceeding with local save:', fbErr);
    }

    // Save to local data.json
    await fetch(`${API}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteData)
    });

    // Publish to HTML
    const res = await fetch(`${API}/publish`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Website published successfully', 'success');
    } else {
      showToast('Publish failed: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (err) {
    showToast('Publish failed: ' + err.message, 'error');
  }
  showLoading(false);
}

// ═══════ DASHBOARD ═══════
function updateDashboard() {
  document.getElementById('dashProjects').textContent = (siteData.projects || []).length;
  document.getElementById('dashServices').textContent = (siteData.services?.items || []).length;
  document.getElementById('dashStats').textContent = (siteData.home?.stats || []).length;
}

// ═══════ UTILITIES ═══════
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function showLoading(show, text = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingOverlayText');
  if (textEl && text) textEl.textContent = text;
  if (overlay) overlay.classList.toggle('show', show);
}
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3000);
}
