const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const cheerio = require('cheerio');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dqnf1fel9',
  api_key: '346288771123847',
  api_secret: '4gvrLIM4Hqzr8cB011_0qRrNzFc'
});

const app = express();

// Setup AppData / writable storage for data.json
const isVercel = Boolean(process.env.VERCEL);
const APPDATA = process.env.APPDATA || (process.env.HOME ? path.join(process.env.HOME, '.config') : '/tmp');
let APP_DIR = path.join(APPDATA, 'Architecture Admin Panel');
try {
  if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
} catch (err) {
  APP_DIR = '/tmp';
}

function findWebsiteDir() {
  const exeDir = path.dirname(process.execPath);
  const possiblePaths = [
    path.join(exeDir, 'smdark'),
    path.join(process.cwd(), 'smdark'),
    path.join(process.cwd(), '../sohanmail/smdark'),
    path.join(process.cwd(), '../../sohanmail/smdark'),
    path.join('d:', 'sohanmail', 'smdark'),
    path.join('c:', 'sohanmail', 'smdark')
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(path.join(p, 'index.html'))) return p;
    } catch (e) {}
  }
  return path.join(process.cwd(), 'smdark');
}

const WEBSITE_DIR = findWebsiteDir();
const WEBSITE_HTML = path.join(WEBSITE_DIR, 'index.html');
const DATA_FILE = path.join(APP_DIR, 'data.json');

// Copy initial data if it doesn't exist in AppData
try {
  if (!fs.existsSync(DATA_FILE)) {
    const localData = path.join(__dirname, 'public', 'data.json');
    if (fs.existsSync(localData)) {
      const dataContent = fs.readFileSync(localData, 'utf8');
      fs.writeFileSync(DATA_FILE, dataContent, 'utf8');
    }
  }
} catch (e) {
  console.log('Initial data copy skipped or running in read-only environment');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve website images for preview in admin
if (fs.existsSync(WEBSITE_DIR)) {
  app.use('/website-assets', express.static(WEBSITE_DIR));
}

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || 'images';
    const dest = isVercel ? '/tmp' : path.join(WEBSITE_DIR, folder);
    try {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    } catch (e) {}
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// ── API: Get content ──
app.get('/api/content', (req, res) => {
  try {
    let raw;
    if (fs.existsSync(DATA_FILE)) {
      raw = fs.readFileSync(DATA_FILE, 'utf8');
    } else if (fs.existsSync(path.join(__dirname, 'public', 'data.json'))) {
      raw = fs.readFileSync(path.join(__dirname, 'public', 'data.json'), 'utf8');
    } else {
      raw = '{}';
    }
    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data.json: ' + err.message });
  }
});

// ── API: Save content ──
app.put('/api/content', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    }
    res.json({ success: true, message: 'Content saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save data.json: ' + err.message });
  }
});

// ── API: Upload image ──
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const folder = req.body.folder || 'images';
  res.json({
    success: true,
    path: `${folder}/${req.file.filename}`,
    filename: req.file.filename
  });
});

// ── API: Upload to Cloudinary ──
app.post('/api/upload-cloudinary', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const folder = req.body.folder || 'architecture_studio';
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: folder
    });
    // Clean up temporary local file if possible
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    // Inject Cloudinary auto-optimization parameters into the URL
    const optimizedUrl = result.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    res.json({ success: true, url: optimizedUrl });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload to Cloudinary: ' + error.message });
  }
});

// ── API: List images in a folder ──
app.get('/api/images/:folder', (req, res) => {
  const folder = req.params.folder;
  const dir = path.join(WEBSITE_DIR, folder);
  try {
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
    res.json(files.map(f => `${folder}/${f}`));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// ── API: Publish to HTML ──
app.post('/api/publish', (req, res) => {
  try {
    if (!fs.existsSync(WEBSITE_HTML)) {
      return res.json({ success: true, message: 'Data synced with Firebase. HTML publish is only for local desktop use.' });
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const html = fs.readFileSync(WEBSITE_HTML, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    // ── HOME PAGE ──
    const home = $('#page-home');

    // Hero
    home.find('.hero-badge').text(data.home.hero.badge);
    home.find('.hero-title').html(
      `${data.home.hero.title_line1}<br>That <span class="highlight-text">${data.home.hero.title_highlight}</span>`
    );
    home.find('.hero-sub').html(
      data.home.hero.services.map((s, i) =>
        i < data.home.hero.services.length - 1 ? `${s} <span>·</span> ` : s
      ).join('')
    );
    home.find('.btn-primary span').text(data.home.hero.btn_primary);
    home.find('.btn-secondary').text(data.home.hero.btn_secondary);

    // Stats
    let statsHtml = '';
    const statDelays = ['', ' reveal-delay-1', ' reveal-delay-2', ' reveal-delay-3', ' reveal-delay-4'];
    if (data.home && data.home.stats) {
      data.home.stats.forEach((stat, i) => {
        const delay = statDelays[i % statDelays.length];
        statsHtml += `
      <div class="stat-item reveal${delay}">
        <div class="stat-num">${stat.number}</div>
        <div class="stat-label">${stat.label}</div>
      </div>`;
      });
      home.find('.stats-strip').html(statsHtml);
    }

    // Featured
    home.find('.featured .section-label').text(data.home.featured.label);
    home.find('.featured .section-title').html(
      `${data.home.featured.title_line1}<br><em>${data.home.featured.title_em}</em>`
    );
    home.find('.feat-card').each(function (i) {
      if (data.home.featured.cards[i]) {
        $(this).find('.feat-card-cat').text(data.home.featured.cards[i].category);
        $(this).find('.feat-card-title').text(data.home.featured.cards[i].title);
      }
    });

    // Philosophy
    home.find('.philosophy .section-label').text(data.home.philosophy.label);
    home.find('.philosophy .section-title').html(
      `${data.home.philosophy.title_line1}<br><em>${data.home.philosophy.title_em}</em>`
    );
    home.find('.philosophy-text').text(data.home.philosophy.text);

    // Process
    home.find('.process .section-label').text(data.home.process.label);
    home.find('.process .section-title').html(
      `${data.home.process.title_line1} <em>${data.home.process.title_em}</em>`
    );
    home.find('.process-steps').html(
      data.home.process.steps.map((step, i) => `
      <div class="process-step reveal${statDelays[i % statDelays.length]}">
        ${i > 0 ? '<div class="step-dot"></div>' : ''}
        <div class="step-num">${step.number}</div>
        <div class="step-title">${step.title}</div>
        <div class="step-text">${step.text}</div>
      </div>`).join('')
    );

    // Testimonial
    home.find('.testimonial .section-label').text(data.home.testimonial.label);
    home.find('.testimonial-quote').text(`“${data.home.testimonial.quote}”`);
    home.find('.testimonial-author').text(data.home.testimonial.author);

    // ── PROJECTS PAGE ──
    const projects = $('#page-projects');
    projects.find('.projects-grid').html(
      data.projects.map((p, i) => `
      <div class="proj-card reveal visible" data-cat="${p.category}">
        <div class="proj-img">
          <div class="proj-img-inner" style="background-image:url('${p.thumbnail}')"></div>
          <div class="proj-img-overlay" onclick="openProjectModal('${p.title.replace(/'/g, "\\'")}', '${p.category}', '${p.description.replace(/'/g, "\\'")}', ${JSON.stringify(p.images || []).replace(/"/g, '&quot;')})">
            <span class="proj-view">View Project</span>
          </div>
        </div>
        <div class="proj-info">
          <div class="proj-cat">${p.category}</div>
          <div class="proj-title">${p.title}</div>
        </div>
      </div>`).join('')
    );

    // ── ABOUT PAGE ──
    const about = $('#page-about');
    about.find('.about-hero .section-label').text(data.about.label);
    about.find('.about-lead').text(data.about.lead);
    about.find('.about-text').eq(0).text(data.about.text1);
    about.find('.about-text').eq(1).text(data.about.text2);
    if (data.about.image) {
      about.find('.about-hero-visual').css('background-image', `url('${data.about.image}')`);
    }
    if (data.about.stats) {
      about.find('.about-values').html(
        data.about.stats.map(s => `
        <div class="about-val">
          <div class="about-val-num">${s.number}</div>
          <div class="about-val-label">${s.label}</div>
        </div>`).join('')
      );
    }
    about.find('.about-story .section-label').text(data.about.principles.label);
    about.find('.about-story .section-title').html(
      `${data.about.principles.title_line1}<br><em>${data.about.principles.title_em}</em>`
    );

    // ── SERVICES PAGE ──
    const services = $('#page-services');
    services.find('.services-hero .section-label').text(data.services.label);
    services.find('.services-hero .section-title').html(
      `${data.services.title_line1} <em>${data.services.title_em}</em>`
    );
    services.find('.services-description').text(data.services.description);
    services.find('.services-grid').html(
      data.services.items.map((svc, i) => `
      <div class="svc-card reveal${statDelays[i % statDelays.length]}">
        <div class="svc-num">${svc.number}</div>
        <div class="svc-icon svc-icon-${i + 1}">${svc.icon}</div>
        <div class="svc-title">${svc.title}</div>
        <div class="svc-text">${svc.text}</div>
        <div class="svc-features">
          ${svc.features.map(f => `<div class="svc-feat">${f}</div>`).join('')}
        </div>
      </div>`).join('')
    );

    // Services CTA
    services.find('.services-cta .section-label').text(data.services.cta.label);
    services.find('.services-cta .section-title').html(
      `${data.services.cta.title_line1}<br>${data.services.cta.title_line2} <em>${data.services.cta.title_em}</em>`
    );
    services.find('.services-cta p').text(data.services.cta.text);
    services.find('.services-cta .btn-primary span').text(data.services.cta.button);

    // ── CONTACT PAGE ──
    const contact = $('#page-contact');
    contact.find('.contact-info-sticky .section-label').text(data.contact.label);
    contact.find('.contact-lead').text(data.contact.lead);

    const contactDetails = contact.find('.contact-details');
    contactDetails.find('.contact-detail').eq(0).find('span').text(data.contact.email);
    contactDetails.find('.contact-detail').eq(1).find('span').text(data.contact.studios);
    contactDetails.find('.contact-detail').eq(2).find('span').text(data.contact.phone);

    // ── FOOTER (all pages) ──
    $('footer').each(function () {
      $(this).find('.footer-logo').text(data.footer.logo);
      $(this).find('.footer-tagline').text(data.footer.tagline);
      $(this).find('.footer-copy').eq(0).text(data.footer.copyright);
      $(this).find('.footer-copy').eq(1).text(data.footer.crafted);

      // Contact column
      const contactCol = $(this).find('.footer-col').filter(function () { return $(this).find('h4').text().trim() === 'Contact'; });
      if (contactCol.length) {
        contactCol.find('li').eq(0).text(data.footer.email);
        contactCol.find('li').eq(1).text(data.footer.phone);
        contactCol.find('li').eq(2).text(data.footer.locations);
      }

      // Follow column
      const followCol = $(this).find('.footer-col').filter(function () { return $(this).find('h4').text().trim() === 'Follow'; });
      if (followCol.length && data.footer.social) {
        followCol.find('ul').html(data.footer.social.map(s => `<li>${s}</li>`).join(''));
      }
    });

    // ── NAV ──
    $('.nav-logo').text(data.site.logo);
    $('.nav-cta').text(data.site.nav_cta);

    // Write updated HTML
    fs.writeFileSync(WEBSITE_HTML, $.html(), 'utf8');

    res.json({ success: true, message: 'Website published successfully!' });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish: ' + err.message });
  }
});

// Start server locally (when not running inside Vercel serverless environment)
let server;
if (!isVercel) {
  const port = process.env.PORT || 3000;
  server = app.listen(port, () => {
    console.log(`\n  ┌─────────────────────────────────────────┐`);
    console.log(`  │                                         │`);
    console.log(`  │   🏛  Architecture Admin Panel          │`);
    console.log(`  │   Running at http://localhost:${port}       │`);
    console.log(`  │                                         │`);
    console.log(`  └─────────────────────────────────────────┘\n`);
  });
}

module.exports = isVercel ? app : (server || app);
