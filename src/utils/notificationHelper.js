// utils/notificationHelper.js
const { Notification } = require('../models');

/**
 * Buat satu notifikasi
 * @param {string} userId   - ID user penerima
 * @param {string} type     - KYC | DIVIDEND | MARKET | SYSTEM | PAYMENT | RENTAL
 * @param {string} title    - Judul notifikasi
 * @param {string} message  - Isi pesan
 */
async function createNotification(userId, type, title, message) {
  try {
    return await Notification.create({ userId, type, title, message });
  } catch (err) {
    console.error('[createNotification]', err.message);
    return null;
  }
}

/**
 * Buat notifikasi ke banyak user sekaligus
 * @param {string[]} userIds
 */
async function createNotificationBulk(userIds, type, title, message) {
  try {
    return await Notification.bulkCreate(
      userIds.map(userId => ({ userId, type, title, message })),
      { ignoreDuplicates: true }   // setara skipDuplicates di Prisma
    );
  } catch (err) {
    console.error('[createNotificationBulk]', err.message);
    return null;
  }
}

// ─── Preset helpers ───────────────────────────────────────────────────────────

const notifyKycVerified = (userId) =>
  createNotification(userId, 'KYC', 'KYC Approved! ✅',
    'Identitas kamu telah diverifikasi. Kamu sekarang bisa berinvestasi di semua properti PropShare.');

const notifyKycRejected = (userId) =>
  createNotification(userId, 'KYC', 'KYC Ditolak',
    'Maaf, verifikasi identitas kamu ditolak. Hubungi admin untuk info lebih lanjut.');

const notifyInvestmentSuccess = (userId, propertyTitle, tokenAmount, totalPaid) =>
  createNotification(userId, 'MARKET',
    `Investasi Berhasil di ${propertyTitle}`,
    `${tokenAmount.toLocaleString()} token PROP senilai Rp ${totalPaid.toLocaleString('id-ID')} berhasil dibeli.`);

const notifyDividendAvailable = (userId, propertyTitle, amount) =>
  createNotification(userId, 'DIVIDEND',
    'Dividend Tersedia! 💰',
    `Rp ${amount.toLocaleString('id-ID')} dari properti "${propertyTitle}" siap diklaim di portfolio kamu.`);

const notifyPaymentVerified = (userId, month, year, amount) =>
  createNotification(userId, 'SYSTEM',
    'Pembayaran Dikonfirmasi ✅',
    `Pembayaran sewa bulan ${month}/${year} sebesar Rp ${amount.toLocaleString('id-ID')} telah diverifikasi.`);

const notifyRentalApproved = (userId, propertyTitle) =>
  createNotification(userId, 'SYSTEM',
    'Pengajuan Sewa Disetujui! 🏠',
    `Pengajuan kamu untuk "${propertyTitle}" telah disetujui. Silakan lakukan pembayaran pertama.`);

const notifyListingSold = (userId, propertyTitle, tokenAmount, totalPrice) =>
  createNotification(userId, 'MARKET',
    'Token Kamu Terjual! 🎉',
    `${tokenAmount.toLocaleString()} token "${propertyTitle}" berhasil dijual seharga Rp ${totalPrice.toLocaleString('id-ID')}.`);

const notifyTokenPurchased = (userId, propertyTitle, tokenAmount) =>
  createNotification(userId, 'MARKET',
    'Pembelian Token Berhasil! 🪙',
    `${tokenAmount.toLocaleString()} token "${propertyTitle}" berhasil ditambahkan ke portfolio kamu.`);

module.exports = {
  createNotification,
  createNotificationBulk,
  notifyKycVerified,
  notifyKycRejected,
  notifyInvestmentSuccess,
  notifyDividendAvailable,
  notifyPaymentVerified,
  notifyRentalApproved,
  notifyListingSold,
  notifyTokenPurchased,
};