require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { sequelize } = require('./models'); // ← GANTI dari config/db ke models
const routes     = require('./routes/index');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Global Middlewares ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: `Route ${req.method} ${req.path} tidak ditemukan` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database terhubung');

    await sequelize.sync({ force: false });
    console.log('✅ Model tersinkronisasi');

    app.listen(PORT, () => {
      console.log(`🚀 PropShare API berjalan di http://localhost:${PORT}`);
      console.log(`📖 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Gagal terhubung ke database:', error);
    process.exit(1);
  }
};

start();

module.exports = app;