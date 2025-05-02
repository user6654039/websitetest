require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const sharp = require('sharp');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const imageDataPath = path.join(__dirname, 'imageData.json');
const aboutDataPath = path.join(__dirname, 'aboutData.json');

// Middleware setup
app.set('trust proxy', 1);
app.use(bodyParser.json({ limit: '2gb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2gb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again later.'
});

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'verySecretKey',
  resave: false,
  saveUninitialized: true,
  cookie: {
    sameSite: 'lax',
    secure: false // Set to true in production if using HTTPS
  }
}));

// CSP headers
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;"
  );
  next();
});

// Helper: Auth
function authRequired(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.status(401).send('Unauthorized');
}

// Helper: File upload
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024, files: 100 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg'];
    const mimeOk = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    const extOk = validExts.includes(ext);
    cb(null, mimeOk || extOk);
  }
});

// Helpers
async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

  const newPath = filePath.replace(/(\.\w+)$/, '.webp');
  await sharp(filePath).resize({ width: 1920 }).webp({ quality: 70 }).toFile(newPath);
  fs.unlinkSync(filePath);
  return path.basename(newPath);
}

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function sanitize(str) {
  return String(str || '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// === Auth Routes ===
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.loggedIn = true;
    return res.redirect('/control');
  }
  res.send('❌ Invalid credentials');
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});
app.get('/api/session', (req, res) => {
  res.json({ loggedIn: req.session.loggedIn === true });
});

// === Control Panel ===
app.get('/control', authRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'control.html'));
});
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// === API ===
app.get('/api/images', (_, res) => {
  const all = readJSON(imageDataPath);
  const flat = Object.values(all).flat();
  res.json(flat);
});
app.get('/api/about', (_, res) => res.json(readJSON(aboutDataPath)));

// === Upload ===
app.post('/upload', authRequired, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'extraImages', maxCount: 100 }
]), async (req, res) => {
  const { section, text_lt = '', text_en = '', editIndex, fulltext_lt = '', fulltext_en = '' } = req.body;
  const files = req.files;
  let newMainFilename = null;
  let compressedExtras = [];

  if (files?.image?.[0]) {
    const fullPath = path.join(__dirname, files.image[0].path);
    newMainFilename = await compressImage(fullPath);
  }

  if (files?.extraImages?.length) {
    for (const img of files.extraImages) {
      const fullPath = path.join(__dirname, img.path);
      const ext = path.extname(fullPath).toLowerCase();
    
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        const compressed = await compressImage(fullPath);
        if (compressed) compressedExtras.push('/uploads/' + compressed);
      } else {
        // Assume video or other valid file, keep original
        compressedExtras.push('/uploads/' + path.basename(fullPath));
      }
    }
    
  }

  let allImages = readJSON(imageDataPath);
let images = allImages[section] || [];
  let original = null;
  let idx = -1;

  if (editIndex !== undefined && editIndex !== '') {
    idx = parseInt(editIndex);
    if (!isNaN(idx) && idx >= 0 && idx < images.length) {
      original = images[idx];
    } else {
      idx = -1;
    }
  }

  let extraImages = [];
  if (req.body.existingExtraImages) {
    extraImages = Array.isArray(req.body.existingExtraImages)
      ? req.body.existingExtraImages
      : [req.body.existingExtraImages];
  }

  if (original?.extraImages?.length) {
    const removed = original.extraImages.filter(old => !extraImages.includes(old));
    removed.forEach(pathToRemove => {
      const filePath = path.join(__dirname, pathToRemove);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  }

  extraImages = extraImages.concat(compressedExtras);

  const newEntry = {
    section: section || (original?.section ?? 'main'),
    text_lt: sanitize(text_lt),
    text_en: sanitize(text_en),
    fulltext: {
      lt: sanitize(fulltext_lt),
      en: sanitize(fulltext_en)
    },
    url: newMainFilename ? '/uploads/' + newMainFilename : (original?.url || ''),
    extraImages
  };

  if (idx >= 0) images[idx] = newEntry;
  else images.push(newEntry);

  allImages[section] = images;
writeJSON(imageDataPath, allImages);

  res.redirect(`/control?tab=${newEntry.section}`);
});

// === Upload Hero Section (Multiple Images) ===
app.post('/upload-multiple-hero', authRequired, upload.array('images', 50), async (req, res) => {
  const files = req.files;
  const section = 'hero';

  if (!files || !files.length) return res.status(400).send('No files uploaded.');

  let allImages = readJSON(imageDataPath);
let images = allImages.hero || [];


  for (const file of files) {
    const filePath = path.join(__dirname, file.path);
    const filename = await compressImage(filePath);
    images.push({
      section,
      url: '/uploads/' + filename,
      text_lt: '',
      text_en: '',
      fulltext: { lt: '', en: '' },
      extraImages: []
    });
  }

  allImages.hero = images;
  writeJSON(imageDataPath, allImages);
  
  res.redirect('/control?tab=main');
});

// === Delete Image Entry ===
app.post('/delete', authRequired, (req, res) => {
  const index = parseInt(req.body.index);
  const section = req.body.section || 'main';

  let allImages = readJSON(imageDataPath);
  let images = allImages[section] || [];

  const removed = images.splice(index, 1)[0];

  if (removed) {
    if (removed.url?.includes('/uploads/')) {
      const mainPath = path.join(__dirname, removed.url);
      if (fs.existsSync(mainPath)) fs.unlinkSync(mainPath);
    }
    if (Array.isArray(removed.extraImages)) {
      removed.extraImages.forEach(extra => {
        const extraPath = path.join(__dirname, extra);
        if (fs.existsSync(extraPath)) fs.unlinkSync(extraPath);
      });
    }
  }

  allImages[section] = images;
  writeJSON(imageDataPath, allImages);

  res.redirect(`/control?tab=${section}`);
});


// === About Upload ===
app.post('/uploadAbout', authRequired, upload.single('image'), (req, res) => {
  const { title = '', text_lt = '', text_en = '', editIndex } = req.body;
  const file = req.file ? '/uploads/' + req.file.filename : null;
  let about = readJSON(aboutDataPath);

  const newSection = {
    title: sanitize(title),
    text_lt: sanitize(text_lt),
    text_en: sanitize(text_en),
    image: file || (editIndex ? about[editIndex]?.image : ''),
  };

  if (editIndex !== undefined && editIndex !== '') {
    about[editIndex] = newSection;
  } else {
    about.push(newSection);
  }

  writeJSON(aboutDataPath, about);
  res.redirect('/control?tab=about');
});

// === Delete About Section ===
app.post('/deleteAbout', authRequired, (req, res) => {
  const index = parseInt(req.body.index);
  const about = readJSON(aboutDataPath);
  const removed = about.splice(index, 1)[0];

  if (removed?.image?.includes('/uploads/')) {
    fs.unlink(path.join(__dirname, removed.image), () => {
      writeJSON(aboutDataPath, about);
      res.redirect('/control?tab=about');
    });
  } else {
    writeJSON(aboutDataPath, about);
    res.redirect('/control?tab=about');
  }
});

// === Error Handling ===
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('Only image and video files')) {
    res.status(400).send('Upload failed: Only image and video files are allowed.');
  } else {
    next(err);
  }
});

// === Start Server ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
