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
const PORT = process.env.PORT || 3000;

// Setup AppData for data.json
const APPDATA = process.env.APPDATA || process.env.HOME;
const APP_DIR = path.join(APPDATA, 'Architecture Admin Panel');
if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

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
    if (fs.existsSync(path.join(p, 'index.html'))) return p;
  }
  return path.join(exeDir, 'smdark'); // Fallback to next to the exe
}

const WEBSITE_DIR = findWebsiteDir();
const WEBSITE_HTML = path.join(WEBSITE_DIR, 'index.html');
const DATA_FILE = path.join(APP_DIR, 'data.json');

// Copy initial data if it doesn't exist in AppData
if (!fs.existsSync(DATA_FILE)) {
  const localData = path.join(__dirname, 'data.json');
  if (fs.existsSync(localData)) {
    const dataContent = fs.readFileSync(localData, 'utf8');
    fs.writeFileSync(DATA_FILE, dataContent, 'utf8');
  } else {
    fs.writeFileSync(DATA_FILE, '{}', 'utf8');
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Serve website images for preview in admin
app.use('/website-assets', express.static(WEBSITE_DIR));

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || 'images';
    const dest = path.join(WEBSITE_DIR, folder);
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// ── API: Get content ──
app.get('/api/content', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data.json' });
  }
});

// ── API: Save content ──
app.put('/api/content', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true, message: 'Content saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save data.json' });
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
    // Inject Cloudinary auto-optimization parameters into the URL
    const optimizedUrl = result.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    res.json({ success: true, url: optimizedUrl });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Failed to upload to Cloudinary' });
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
      // Gracefully skip local HTML update if source code is not provided to the client
      return res.json({ success: true, message: 'Data saved. Local HTML not updated (source code hidden).' });
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
    home.find('.process-step').each(function (i) {
      if (data.home.process.steps[i]) {
        $(this).find('.step-num').text(data.home.process.steps[i].number);
        $(this).find('.step-title').text(data.home.process.steps[i].title);
        $(this).find('.step-text').text(data.home.process.steps[i].text);
      }
    });

    // Testimonial
    home.find('.testimonial .section-label').text(data.home.testimonial.label);
    home.find('.testimonial-quote').text(`"${data.home.testimonial.quote}"`);
    home.find('.testimonial-author').text(data.home.testimonial.author);

    // ── PROJECTS PAGE ──
    const projPage = $('#page-projects');
    let projCardsHtml = '';
    const delays = ['', ' reveal-delay-1', ' reveal-delay-2'];

    data.projects.forEach((proj, i) => {
      const delayClass = delays[i % 3];
      const thumbClass = `pv-proj-${proj.id}`;
      const imagesJson = JSON.stringify(proj.images).replace(/"/g, "'");
      projCardsHtml += `
      <div class="proj-card reveal${delayClass}" data-cat="${proj.category}">
        <div class="proj-img">
          <div class="proj-img-inner ${thumbClass}"></div>
          <div class="proj-img-overlay" onclick="openProjectModal(
            '${proj.title.replace(/'/g, "\\'")}',
            '${proj.category === 'rekhatan' ? 'रेखाटने' : proj.category.charAt(0).toUpperCase() + proj.category.slice(1)}',
            '${proj.description.replace(/'/g, "\\'")}',
            ${imagesJson}
          )">
            <span class="proj-view">View Project</span>
          </div>
        </div>
        <div class="proj-info">
          <div class="proj-cat">${proj.category === 'rekhatan' ? 'रेखाटने' : proj.category.charAt(0).toUpperCase() + proj.category.slice(1)}</div>
          <div class="proj-title">${proj.title}</div>
        </div>
      </div>`;
    });
    projPage.find('.projects-grid').html(projCardsHtml);

    // Update project thumbnail CSS
    let styleContent = $('style').html();
    // Remove old pv-proj- styles
    styleContent = styleContent.replace(/\.pv-proj-\d+\s*\{[^}]*\}/g, '');
    // Add new thumbnail styles
    let newProjStyles = '\n    /* Project thumbnails (auto-generated) */\n';
    data.projects.forEach(proj => {
      newProjStyles += `    .pv-proj-${proj.id} { background-image: url('${proj.thumbnail}'); background-size: cover; background-position: center; }\n`;
    });
    styleContent += newProjStyles;
    $('style').html(styleContent);

    // ── ABOUT PAGE ──
    const aboutPage = $('#page-about');
    aboutPage.find('.section-label').first().text(data.about.label);
    aboutPage.find('.about-lead').text(data.about.lead);
    const aboutTexts = aboutPage.find('.about-text');
    if (aboutTexts.eq(0).length) aboutTexts.eq(0).text(data.about.text1);
    if (aboutTexts.eq(1).length) aboutTexts.eq(1).text(data.about.text2);

    aboutPage.find('.about-val').each(function (i) {
      if (data.about.stats[i]) {
        $(this).find('.about-val-num').text(data.about.stats[i].number);
        $(this).find('.about-val-label').text(data.about.stats[i].label);
      }
    });

    // About principles
    const principlesSection = aboutPage.find('.about-story');
    const storySticky = principlesSection.find('.about-story-sticky');
    storySticky.find('.section-label').text(data.about.principles.label);
    storySticky.find('.section-title').html(
      `${data.about.principles.title_line1}<br><em>${data.about.principles.title_em}</em>`
    );

    // ── SERVICES PAGE ──
    const svcPage = $('#page-services');
    svcPage.find('.services-hero .section-label').text(data.services.label);
    svcPage.find('.services-hero .section-title').html(
      `${data.services.title_line1} <em>${data.services.title_em}</em>`
    );

    svcPage.find('.svc-card').each(function (i) {
      if (data.services.items[i]) {
        const svc = data.services.items[i];
        $(this).find('.svc-num').text(svc.number);
        $(this).find('.svc-icon').text(svc.icon);
        $(this).find('.svc-title').text(svc.title);
        $(this).find('.svc-text').text(svc.text);
        const featContainer = $(this).find('.svc-features');
        featContainer.html(svc.features.map(f => `<div class="svc-feat">${f}</div>`).join('\n            '));
      }
    });

    // Services CTA
    svcPage.find('.services-cta .section-label').text(data.services.cta.label);
    svcPage.find('.services-cta .section-title').html(
      `${data.services.cta.title_line1}<br>${data.services.cta.title_line2} <em>${data.services.cta.title_em}</em>`
    );

    // ── CONTACT PAGE ──
    const contactPage = $('#page-contact');
    contactPage.find('.section-label').first().text(data.contact.label);
    contactPage.find('.contact-lead').text(data.contact.lead);

    const contactDetails = contactPage.find('.contact-detail');
    if (contactDetails.eq(0).length) contactDetails.eq(0).find('span').text(data.contact.email);
    if (contactDetails.eq(1).length) contactDetails.eq(1).find('span').text(data.contact.studios);
    if (contactDetails.eq(2).length) contactDetails.eq(2).find('span').text(data.contact.phone);

    // Service options in form
    const svcSelect = contactPage.find('select').first();
    let svcOptionsHtml = '<option value="" disabled selected>Select a service</option>';
    data.contact.service_options.forEach(opt => {
      svcOptionsHtml += `<option>${opt}</option>`;
    });
    svcSelect.html(svcOptionsHtml);

    // Budget options in form
    const budgetSelect = contactPage.find('select').last();
    let budgetOptionsHtml = '<option value="" disabled selected>Estimated budget range</option>';
    data.contact.budget_options.forEach(opt => {
      budgetOptionsHtml += `<option>${opt}</option>`;
    });
    budgetSelect.html(budgetOptionsHtml);

    // ── FOOTER (all pages) ──
    $('footer').each(function () {
      $(this).find('.footer-logo').text(data.footer.logo);
      $(this).find('.footer-tagline').text(data.footer.tagline);
      const copies = $(this).find('.footer-copy');
      if (copies.eq(0).length) copies.eq(0).text(data.footer.copyright);
      if (copies.eq(1).length) copies.eq(1).text(data.footer.crafted);

      // Contact column
      const contactCol = $(this).find('.footer-col').filter(function() { return $(this).find('h4').text().trim() === 'Contact'; });
      if (contactCol.length) {
        contactCol.find('ul').html(`
            <li>${data.footer.email || ''}</li>
            <li>${data.footer.phone || ''}</li>
            <li>${data.footer.locations || ''}</li>
        `);
      }

      // Follow column
      const followCol = $(this).find('.footer-col').filter(function() { return $(this).find('h4').text().trim() === 'Follow'; });
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

// Start server
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`\n  ┌─────────────────────────────────────────┐`);
  console.log(`  │                                         │`);
  console.log(`  │   🏛  Architecture Admin Panel          │`);
  console.log(`  │   Running at http://localhost:${port}       │`);
  console.log(`  │                                         │`);
  console.log(`  │   Website: ${WEBSITE_DIR}`);
  console.log(`  │                                         │`);
  console.log(`  └─────────────────────────────────────────┘\n`);
});

module.exports = server;
