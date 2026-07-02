const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp' : __dirname);

const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomUUID().replace(/-/g, '');
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น'));
    }
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());

// GET all images (sorted newest first)
app.get('/api/images', (req, res) => {
  db.find({}).sort({ createdAt: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
    const result = docs.map(doc => ({
      id: doc._id,
      name: doc.name,
      filename: doc.filename,
      url: `/uploads/${doc.filename}`,
      createdAt: doc.createdAt
    }));
    res.json(result);
  });
});

// POST upload new image
app.post('/api/images', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'ไฟล์ขนาดใหญ่เกินไป (สูงสุด 20MB)' });
      }
      return res.status(400).json({ error: err.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพ' });
    }
    const name = (req.body.name && req.body.name.trim()) || req.file.originalname;
    const doc = { name, filename: req.file.filename, createdAt: new Date() };
    db.insert(doc, (insertErr, newDoc) => {
      if (insertErr) {
        fs.unlinkSync(path.join(uploadsDir, req.file.filename));
        return res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จ' });
      }
      res.json({
        id: newDoc._id,
        name: newDoc.name,
        filename: newDoc.filename,
        url: `/uploads/${newDoc.filename}`,
        createdAt: newDoc.createdAt
      });
    });
  });
});

// DELETE image by id
app.delete('/api/images/:id', (req, res) => {
  const { id } = req.params;
  db.findOne({ _id: id }, (err, doc) => {
    if (err || !doc) {
      return res.status(404).json({ error: 'ไม่พบรูปภาพ' });
    }
    const filePath = path.join(uploadsDir, doc.filename);
    db.remove({ _id: id }, {}, (removeErr) => {
      if (removeErr) return res.status(500).json({ error: 'ลบข้อมูลไม่สำเร็จ' });
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ success: true });
    });
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Image Viewer System running at http://localhost:${PORT}`);
  });
}

module.exports = app;
