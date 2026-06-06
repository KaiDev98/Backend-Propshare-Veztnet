const express      = require('express');
const router       = express.Router();
const { Property } = require('../models');
const {
  getAllProperties,
  getInvestorMarketplace, // ✅ baru
  getTenantMarketplace,   // ✅ baru
  getPropertyById,
  createProperty,
  updatePropertyStatus,
  claimFunds,
  getMyListings,
  uploadPropertyImages,
  deletePropertyImage,
  investProperty,
} = require('../controllers/propertyController');
const { protect }   = require('../middlewares/authMiddleware');
const { roleGuard } = require('../middlewares/roleMiddleware');

// ─── Marketplace routes — HARUS di atas /:id agar tidak tertangkap sbg param ──
// Investor: hanya tampilkan properti ACTIVE (sedang fundraising)
router.get('/marketplace/investor', getInvestorMarketplace);

// Tenant: hanya tampilkan properti READY_TO_RENT dan FULLY_OCCUPIED
router.get('/marketplace/tenant', getTenantMarketplace);

// ─── Owner — route SPESIFIK harus di atas /:id ───────────────────────────────
router.get('/my-listings',            protect, roleGuard('OWNER'), getMyListings);
router.post('/',                      protect, roleGuard('OWNER'), createProperty);
router.post('/:id/images',            protect, roleGuard('OWNER'), uploadPropertyImages);
router.delete('/:id/images/:imageId', protect, roleGuard('OWNER'), deletePropertyImage);

// ─── Owner — klaim dana setelah properti READY_TO_RENT ────────────────────────
router.patch('/:id/claim', protect, roleGuard('OWNER'), async (req, res) => {
  try {
    const { id }                            = req.params;
    const { txHash, amount, walletAddress } = req.body;

    const property = await Property.findOne({
      where: { id, ownerId: req.user.id },
    });

    if (!property) {
      return res.status(404).json({
        status:  'error',
        message: 'Properti tidak ditemukan atau bukan milik kamu',
      });
    }

    if (property.isClaimed) {
      return res.status(400).json({
        status:  'error',
        message: 'Dana sudah pernah diklaim sebelumnya',
      });
    }

    // ✅ Hanya properti yang sudah READY_TO_RENT atau FULLY_OCCUPIED yang bisa diklaim
    const claimableStatuses = ['READY_TO_RENT', 'FUNDED', 'FULLY_OCCUPIED'];
    if (!claimableStatuses.includes(property.status)) {
      return res.status(400).json({
        status:  'error',
        message: 'Properti belum memenuhi syarat penarikan (funding belum 100%)',
      });
    }

    await property.update({
      isClaimed:     true,
      claimedAt:     new Date(),
      claimedTxHash: txHash ?? null,
    });

    console.log(`[CLAIM] Property ${id} | Owner: ${req.user.id} | TX: ${txHash} | Amount: ${amount}`);

    return res.json({
      status:  'success',
      message: 'Dana berhasil diklaim',
      data:    property,
    });
  } catch (err) {
    console.error('[properties/claim]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Investor — beli token properti ──────────────────────────────────────────
router.post('/:id/invest', protect, investProperty);

// ─── Admin — kelola semua properti ───────────────────────────────────────────
router.get('/',              protect, roleGuard('ADMIN'), getAllProperties);
router.patch('/:id/status',  protect, roleGuard('ADMIN'), updatePropertyStatus);

// ─── Public — detail properti — HARUS PALING BAWAH ───────────────────────────
router.get('/:id', getPropertyById);

module.exports = router;