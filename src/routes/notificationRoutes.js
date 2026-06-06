const express        = require('express');
const router         = express.Router();
const { Notification } = require('../models');
const { protect }    = require('../middlewares/authMiddleware');

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    return res.json({ status: 'success', data: notifications });
  } catch (err) {
    console.error('[notifications GET]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notif = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!notif)
      return res.status(404).json({ status: 'error', message: 'Notifikasi tidak ditemukan' });

    await notif.update({ isRead: true, readAt: new Date() });

    return res.json({ status: 'success', data: notif });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );
    return res.json({ status: 'success', message: 'Semua notifikasi ditandai sudah dibaca' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.destroy({
      where: { id: req.params.id, userId: req.user.id },
    });
    return res.json({ status: 'success', message: 'Notifikasi dihapus' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;