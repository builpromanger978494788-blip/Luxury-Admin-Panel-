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
      firebaseConnected = true;
      updateFirebaseStatus(true, 'Connected to Firebase. Data loaded from RTDB.');
    } else {
      // First time — load from local data.json and push to RTDB
      const res = await fetch(`${API}/content`);
      siteData = await res.json();
      await db.ref('website/content').set(siteData);
      firebaseConnected = true;
      updateFirebaseStatus(true, 'First sync complete! Data pushed to RTDB.');
      showToast('🔥 Data synced to Firebase successfully!', 'success');
    }
  } catch (err) {
    console.error('Firebase error, falling back to local:', err);
    try {
      const res = await fetch(`${API}/content`);
      siteData = await res.json();
      updateFirebaseStatus(false, 'Firebase unavailable. Using local data.');
    } catch (e) {
      showToast('Failed to load content from any source.', 'error');
      showLoading(false);
      return;
    }
  }
  populateAllForms();
  updateDashboard();
  setupMessagesListener();
  showLoading(false);
}

// ── Firebase Status UI ──
function updateFirebaseStatus(connected, message) {
  const badge = document.getElementById('firebaseStatus');
  const msg = document.getElementById('firebaseMsg');
  if (connected) {
    badge.textContent = '✓ Connected';
    badge.style.background = '#ecfdf5';
    badge.style.color = '#10b981';
  } else {
    badge.textContent = '✕ Offline';
    badge.style.background = '#fef2f2';
    badge.style.color = '#ef4444';
  }
  if (msg) msg.textContent = message;
}

// ── Sync Functions ──
async function syncToFirebase() {
  showLoading(true);
  try {
    collectAllFormData();
    await db.ref('website/content').set(siteData);
    firebaseConnected = true;
    updateFirebaseStatus(true, 'Data synced to Firebase successfully!');
    showToast('🔄 Local data pushed to Firebase!', 'success');
  } catch (err) {
    showToast('Sync to Firebase failed: ' + err.message, 'error');
  }
  showLoading(false);
}

async function syncFromFirebase() {
  showLoading(true);
  try {
    const snapshot = await db.ref('website/content').once('value');
    if (snapshot.exists()) {
      siteData = snapshot.val();
      populateAllForms();
      updateDashboard();
      updateFirebaseStatus(true, 'Data loaded from Firebase!');
      showToast('📥 Data pulled from Firebase!', 'success');
    } else {
      showToast('No data found in Firebase.', 'error');
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
  renderStats(h.stats || []);
  setValue('featured-label', h.featured.label);
  setValue('featured-title-line1', h.featured.title_line1);
  setValue('featured-title-em', h.featured.title_em);
  renderFeaturedCards(h.featured.cards || []);
  setValue('phil-label', h.philosophy.label);
  setValue('phil-title-line1', h.philosophy.title_line1);
  setValue('phil-title-em', h.philosophy.title_em);
  setValue('phil-text', h.philosophy.text);
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
function populateProjects() { renderProjectsList(); }

function renderProjectsList() {
  const container = document.getElementById('projects-list');
  const projects = siteData.projects || [];
  if (projects.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>No projects yet.</p></div>';
    return;
  }
  container.innerHTML = projects.map((p, i) => `
    <div class="project-admin-card" id="proj-card-${i}">
      <div class="project-admin-header">
        <div class="project-admin-thumb">
          <img src="${getImageUrl(p.thumbnail)}" onerror="this.style.display='none'" alt="">
        </div>
        <div class="project-admin-info">
          <h4>${escapeHtml(p.title)}</h4>
          <div class="cat">${p.category === 'rekhatan' ? 'रेखाटने' : p.category.charAt(0).toUpperCase() + p.category.slice(1)}</div>
        </div>
        <div class="project-admin-actions">
          <button class="btn btn-sm" onclick="toggleProjectEdit(${i})">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="removeProject(${i})">🗑️</button>
        </div>
      </div>
      <div class="collapsible-content" id="proj-edit-${i}">
        <div class="form-grid">
          <div class="form-group">
            <label>Title</label>
            <input type="text" value="${escapeAttr(p.title)}" onchange="siteData.projects[${i}].title=this.value">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select onchange="siteData.projects[${i}].category=this.value">
              <option value="architecture" ${p.category==='architecture'?'selected':''}>Architecture</option>
              <option value="interior" ${p.category==='interior'?'selected':''}>Interior</option>
              <option value="residential" ${p.category==='residential'?'selected':''}>Residential</option>
              <option value="renovation" ${p.category==='renovation'?'selected':''}>Renovation</option>
              <option value="rekhatan" ${p.category==='rekhatan'?'selected':''}>रेखाटने (Rekhatan)</option>
            </select>
          </div>
          <div class="form-group form-full">
            <label>Description</label>
            <textarea rows="2" onchange="siteData.projects[${i}].description=this.value">${escapeHtml(p.description)}</textarea>
          </div>
          <div class="form-group">
            <label>Thumbnail Image Path / URL</label>
            <input type="text" value="${escapeAttr(p.thumbnail)}" onchange="siteData.projects[${i}].thumbnail=this.value">
            <div style="margin-top:8px;">
              <label style="font-size:0.8rem;">Or Upload to Cloudinary:</label>
              <input type="file" accept="image/*" onchange="uploadThumbnailToCloudinary(this, ${i})" style="font-size:0.85rem; padding: 4px;">
            </div>
          </div>
          <div class="form-group form-full">
            <label>Gallery Images (one path per line)</label>
            <textarea rows="4" onchange="siteData.projects[${i}].images=this.value.split('\\n').filter(x=>x.trim())">${(p.images||[]).join('\n')}</textarea>
          </div>
          <div class="form-group form-full">
            <label>Upload Gallery Image to Cloudinary</label>
            <input type="file" accept="image/*" onchange="uploadImageToCloudinary(this, ${i})">
            <p style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Image will be uploaded to Cloudinary</p>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path; // Firebase Storage URL
  return `https://architectsohanmali.com/${path}`; // Fetch from live site
}

function toggleProjectEdit(i) {
  document.getElementById('proj-edit-' + i).classList.toggle('open');
}

function addProject() {
  if (!siteData.projects) siteData.projects = [];
  const newId = siteData.projects.length > 0
    ? Math.max(...siteData.projects.map(p => p.id)) + 1 : 1;
  siteData.projects.push({
    id: newId, title: 'New Project', category: 'architecture',
    description: 'Project description here.', thumbnail: '', images: []
  });
  renderProjectsList();
  toggleProjectEdit(siteData.projects.length - 1);
  showToast('New project added.', 'success');
}

function removeProject(i) {
  if (confirm('Delete this project?')) {
    siteData.projects.splice(i, 1);
    renderProjectsList();
    showToast('Project removed', 'success');
  }
}

// ── Cloudinary Upload ──
async function uploadImageToCloudinary(input, projIndex) {
  const file = input.files[0];
  if (!file) return;
  showLoading(true);
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', getProjectFolder(siteData.projects[projIndex].category));

    const response = await fetch(`${API}/upload-cloudinary`, {
      method: 'POST',
      body: formData
    });
    const result = await response.json();

    if (result.success) {
      siteData.projects[projIndex].images.push(result.url);
      renderProjectsList();
      toggleProjectEdit(projIndex);
      showToast('☁️ Image uploaded to Cloudinary!', 'success');
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed: ' + err.message, 'error');
  }
  showLoading(false);
}

async function uploadThumbnailToCloudinary(input, projIndex) {
  const file = input.files[0];
  if (!file) return;
  showLoading(true);
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', getProjectFolder(siteData.projects[projIndex].category));

    const response = await fetch(`${API}/upload-cloudinary`, { method: 'POST', body: formData });
    const result = await response.json();

    if (result.success) {
      siteData.projects[projIndex].thumbnail = result.url;
      renderProjectsList();
      toggleProjectEdit(projIndex);
      showToast('☁️ Thumbnail uploaded!', 'success');
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  }
  showLoading(false);
}

async function uploadFeaturedToCloudinary(input, cardIndex) {
  const file = input.files[0];
  if (!file) return;
  showLoading(true);
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', 'featured');

    const response = await fetch(`${API}/upload-cloudinary`, { method: 'POST', body: formData });
    const result = await response.json();

    if (result.success) {
      siteData.home.featured.cards[cardIndex].image = result.url;
      populateHome();
      showToast('☁️ Featured Image uploaded!', 'success');
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  }
  showLoading(false);
}

function getProjectFolder(category) {
  const map = { architecture: 'arch', interior: 'interior', residential: 'red', renovation: 'ren', rekhatan: 'paint' };
  return map[category] || 'images';
}

// ═══════ ABOUT ═══════
function populateAbout() {
  const a = siteData.about;
  if (!a) return;
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
  setValue('principles-label', a.principles.label);
  setValue('principles-title-line1', a.principles.title_line1);
  setValue('principles-title-em', a.principles.title_em);
  const prinContainer = document.getElementById('principles-container');
  prinContainer.innerHTML = (a.principles.items || []).map((p, i) => `
    <div class="repeater-item">
      <div class="repeater-header"><h4><span class="repeater-num">${i + 1}</span> ${p.title}</h4></div>
      <div class="form-group"><label>Title</label>
        <input type="text" value="${escapeAttr(p.title)}" onchange="siteData.about.principles.items[${i}].title=this.value">
      </div>
      <div class="form-group"><label>Description</label>
        <textarea rows="3" onchange="siteData.about.principles.items[${i}].text=this.value">${escapeHtml(p.text)}</textarea>
      </div>
    </div>
  `).join('');
}

// ═══════ SERVICES ═══════
function populateServices() {
  const s = siteData.services;
  if (!s) return;
  setValue('svc-page-label', s.label);
  setValue('svc-page-title-line1', s.title_line1);
  setValue('svc-page-title-em', s.title_em);
  setValue('svc-page-desc', s.description);
  const container = document.getElementById('services-container');
  container.innerHTML = (s.items || []).map((svc, i) => `
    <div class="repeater-item">
      <div class="repeater-header"><h4><span class="repeater-num">${svc.number}</span> ${svc.title}</h4></div>
      <div class="form-grid">
        <div class="form-group"><label>Number</label>
          <input type="text" value="${escapeAttr(svc.number)}" onchange="siteData.services.items[${i}].number=this.value"></div>
        <div class="form-group"><label>Icon (emoji)</label>
          <input type="text" value="${escapeAttr(svc.icon)}" onchange="siteData.services.items[${i}].icon=this.value"></div>
        <div class="form-group"><label>Title</label>
          <input type="text" value="${escapeAttr(svc.title)}" onchange="siteData.services.items[${i}].title=this.value"></div>
        <div class="form-group form-full"><label>Description</label>
          <textarea rows="2" onchange="siteData.services.items[${i}].text=this.value">${escapeHtml(svc.text)}</textarea></div>
        <div class="form-group form-full"><label>Features (one per line)</label>
          <textarea rows="4" onchange="siteData.services.items[${i}].features=this.value.split('\\n').filter(x=>x.trim())">${(svc.features||[]).join('\n')}</textarea></div>
      </div>
    </div>
  `).join('');
  if (s.cta) {
    setValue('cta-label', s.cta.label);
    setValue('cta-title-line1', s.cta.title_line1);
    setValue('cta-title-line2', s.cta.title_line2);
    setValue('cta-title-em', s.cta.title_em);
    setValue('cta-text', s.cta.text);
    setValue('cta-button', s.cta.button);
  }
}

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
      await db.ref('website/content').set(siteData);
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

    showToast('✓ ' + section.charAt(0).toUpperCase() + section.slice(1) + ' saved! Website updated instantly.', 'success');
    updateDashboard();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
  showLoading(false);
}

function collectFormData(section) {
  switch (section) {
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
      siteData.home.process.label = getValue('process-label');
      siteData.home.process.title_line1 = getValue('process-title-line1');
      siteData.home.process.title_em = getValue('process-title-em');
      siteData.home.testimonial.label = getValue('test-label');
      break;
    case 'about':
      siteData.about.label = getValue('about-label');
      siteData.about.lead = getValue('about-lead');
      siteData.about.text1 = getValue('about-text1');
      siteData.about.text2 = getValue('about-text2');
      siteData.about.principles.label = getValue('principles-label');
      siteData.about.principles.title_line1 = getValue('principles-title-line1');
      siteData.about.principles.title_em = getValue('principles-title-em');
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
}

// ═══════ PUBLISH (Firebase → HTML) ═══════
async function publishSite() {
  collectAllFormData();
  showLoading(true);
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
      showToast('🚀 Published! Firebase + HTML updated!', 'success');
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
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('show', show);
}
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => toast.classList.remove('show'), 3500);
}
