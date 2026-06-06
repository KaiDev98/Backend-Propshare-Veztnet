const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const FormData = require('form-data');
const multer   = require('multer');
const { Op }   = require('sequelize');

const { Review, Rental, Property, Room, User } = require('../models');
const { protect } = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'), false);
  },
});

// ─── Helper: upload buffer ke Pinata IPFS ────────────────────────────────────
async function uploadToIPFS(fileBuffer, originalname, mimetype) {
  const formData = new FormData();
  formData.append('file', fileBuffer, { filename: originalname, contentType: mimetype });
  formData.append('name',    originalname);
  formData.append('network', 'public');

  const response = await axios.post(
    'https://uploads.pinata.cloud/v3/files',
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    }
  );

  const cid = response.data.data.cid;
  return `${process.env.PINATA_GATEWAY_URL}/ipfs/${cid}`;
}

// ─── POST /api/reviews ────────────────────────────────────────────────────────
router.post('/', protect, upload.single('photo'), async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { rentalId, maintenance, communication, cleanliness, comment } = req.body;

    if (!rentalId || !maintenance || !communication || !cleanliness || !comment?.trim()) {
      return res.status(400).json({
        status:  'error',
        message: 'rentalId, semua rating bintang, dan komentar wajib diisi',
      });
    }

    const maint = parseInt(maintenance);
    const comm  = parseInt(communication);
    const clean = parseInt(cleanliness);

    if ([maint, comm, clean].some(v => v < 1 || v > 5 || isNaN(v))) {
      return res.status(400).json({
        status:  'error',
        message: 'Rating harus berupa angka antara 1–5',
      });
    }

    // ── Cek rental milik tenant & ambil propertyId ─────────────────────────
    const rental = await Rental.findOne({
      where: { id: rentalId, tenantId },
      include: [
        {
          model: Room,
          as:    'room',
          include: [{ model: Property, as: 'property' }],
        },
        { model: Property, as: 'property' },
      ],
    });

    if (!rental) {
      return res.status(404).json({
        status:  'error',
        message: 'Data sewa tidak ditemukan atau bukan milikmu',
      });
    }

    const propertyId = rental.propertyId ?? rental.room?.propertyId;
    if (!propertyId) {
      return res.status(400).json({
        status:  'error',
        message: 'Properti terkait sewa tidak ditemukan',
      });
    }

    // ── Cegah review duplikat ──────────────────────────────────────────────
    const existing = await Review.findOne({ where: { rentalId, tenantId } });
    if (existing) {
      return res.status(409).json({
        status:  'error',
        message: 'Kamu sudah pernah memberikan ulasan untuk sewa ini',
      });
    }

    // ── Upload foto ke IPFS jika ada ───────────────────────────────────────
    let photoUrl = null;
    if (req.file) {
      try {
        photoUrl = await uploadToIPFS(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
      } catch (ipfsErr) {
        console.error('[reviewRoutes] IPFS upload gagal:', ipfsErr.response?.data || ipfsErr.message);
        return res.status(502).json({
          status:  'error',
          message: 'Gagal mengupload foto ke IPFS, coba lagi',
        });
      }
    }

    // ── Simpan ke database ─────────────────────────────────────────────────
    const avgRating = parseFloat(((maint + comm + clean) / 3).toFixed(2));

    const review = await Review.create({
      rentalId,
      tenantId,
      propertyId,
      maintenance:   maint,
      communication: comm,
      cleanliness:   clean,
      avgRating,
      comment:       comment.trim(),
      photoUrl,
    });

    return res.status(201).json({
      status:  'success',
      message: 'Ulasan berhasil disimpan',
      data:    review,
    });

  } catch (err) {
    console.error('[reviewRoutes] POST /reviews:', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server' });
  }
});

// ─── GET /api/reviews/property/:propertyId ────────────────────────────────────
router.get('/property/:propertyId', async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where:   { propertyId: req.params.propertyId },
      order:   [['createdAt', 'DESC']],
      include: [
        {
          model:      User,
          as:         'tenant',
          attributes: ['fullName', 'avatar'],
        },
      ],
    });

    return res.json({ status: 'success', data: reviews });
  } catch (err) {
    console.error('[reviewRoutes] GET /reviews/property:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil ulasan' });
  }
});

// ─── GET /api/reviews/owner ───────────────────────────────────────────────────
router.get('/owner', protect, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { propertyId, minRating, unanswered, page = 1, limit = 10 } = req.query;

    // Ambil semua propertyId milik owner
    const ownerProperties = await Property.findAll({
      where:      { ownerId },
      attributes: ['id'],
    });
    const ownerPropertyIds = ownerProperties.map(p => p.id);

    if (ownerPropertyIds.length === 0) {
      return res.json({
        status: 'success',
        data:   [],
        meta:   { total: 0, page: 1, totalPages: 0 },
      });
    }

    // Build where clause
    const where = {
      propertyId: { [Op.in]: propertyId ? [propertyId] : ownerPropertyIds },
    };

    if (minRating)           where.avgRating  = { [Op.gte]: parseFloat(minRating) };
    if (unanswered === 'true') where.ownerReply = null;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: reviews, count: total } = await Review.findAndCountAll({
      where,
      order:  [['createdAt', 'DESC']],
      offset,
      limit:  parseInt(limit),
      include: [
        {
          model:      User,
          as:         'tenant',
          attributes: ['fullName', 'avatar'],
        },
        {
          model:      Property,
          as:         'property',
          attributes: ['title', 'location'],
        },
        {
          model:   Rental,
          as:      'rental',
          include: [
            {
              model:      Room,
              as:         'room',
              attributes: ['roomNumber'],
            },
          ],
        },
      ],
    });

    // Stats ringkasan dari semua review owner
    const allReviews = await Review.findAll({
      where:      { propertyId: { [Op.in]: ownerPropertyIds } },
      attributes: ['avgRating', 'ownerReply'],
    });

    const totalReviews    = allReviews.length;
    const portfolioRating = totalReviews > 0
      ? (allReviews.reduce((sum, r) => sum + r.avgRating, 0) / totalReviews).toFixed(1)
      : 0;
    const unansweredCount = allReviews.filter(r => !r.ownerReply).length;

    return res.json({
      status: 'success',
      data:   reviews,
      meta: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      stats: {
        portfolioRating: parseFloat(portfolioRating),
        totalReviews,
        unansweredCount,
      },
    });
  } catch (err) {
    console.error('[reviewRoutes] GET /reviews/owner:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil ulasan' });
  }
});

// ─── PATCH /api/reviews/:id/reply ─────────────────────────────────────────────
router.patch('/:id/reply', protect, async (req, res) => {
  try {
    const ownerId  = req.user.id;
    const { reply } = req.body;

    if (!reply?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Balasan tidak boleh kosong' });
    }

    const review = await Review.findOne({
      where:   { id: req.params.id },
      include: [
        {
          model:      Property,
          as:         'property',
          attributes: ['ownerId'],
        },
      ],
    });

    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Ulasan tidak ditemukan' });
    }
    if (review.property.ownerId !== ownerId) {
      return res.status(403).json({ status: 'error', message: 'Tidak diizinkan membalas ulasan ini' });
    }

    await review.update({ ownerReply: reply.trim(), repliedAt: new Date() });

    return res.json({ status: 'success', data: review });
  } catch (err) {
    console.error('[reviewRoutes] PATCH /reviews/:id/reply:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan balasan' });
  }
});

// ─── GET /api/reviews/my-reviews ─────────────────────────────────────────────
router.get('/my-reviews', protect, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { hasReply, page = 1, limit = 6 } = req.query;

    const where = { tenantId };
    if (hasReply === 'true')  where.ownerReply = { [Op.ne]: null };
    if (hasReply === 'false') where.ownerReply = null;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: reviews, count: total } = await Review.findAndCountAll({
      where,
      order:  [['createdAt', 'DESC']],
      offset,
      limit:  parseInt(limit),
      include: [
        {
          model:      Property,
          as:         'property',
          attributes: ['title', 'location'],
        },
        {
          model:   Rental,
          as:      'rental',
          include: [
            {
              model:      Room,
              as:         'room',
              attributes: ['roomNumber'],
            },
          ],
        },
      ],
    });

    // Stats dari semua ulasan tenant
    const allReviews = await Review.findAll({
      where:      { tenantId },
      attributes: ['avgRating', 'ownerReply'],
    });

    const totalReviews = allReviews.length;
    const repliedCount = allReviews.filter(r => r.ownerReply).length;
    const avgRating    = totalReviews > 0
      ? parseFloat((allReviews.reduce((s, r) => s + r.avgRating, 0) / totalReviews).toFixed(1))
      : 0;

    return res.json({
      status: 'success',
      data:   reviews,
      meta: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      stats: { totalReviews, repliedCount, avgRating },
    });
  } catch (err) {
    console.error('[reviewRoutes] GET /reviews/my-reviews:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil ulasan' });
  }
});

// ─── DELETE /api/reviews/:id ──────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const tenantId = req.user.id;

    const review = await Review.findOne({ where: { id: req.params.id } });

    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Ulasan tidak ditemukan' });
    }
    if (review.tenantId !== tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tidak diizinkan menghapus ulasan ini' });
    }

    await review.destroy();

    return res.json({ status: 'success', message: 'Ulasan berhasil dihapus' });
  } catch (err) {
    console.error('[reviewRoutes] DELETE /reviews/:id:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal menghapus ulasan' });
  }
});

module.exports = router;