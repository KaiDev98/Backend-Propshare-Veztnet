const express    = require('express');
const router     = express.Router();
const { Op }     = require('sequelize');
const { MarketplaceListing, Investment, Property, PropertyImage, User } = require('../models');
const { protect, roleGuard } = require('../middlewares/authMiddleware');

// ─── IMPORT SECURITY GATE ───────────────────────────────────────────────────
const { verifyOnChain } = require('../utils/web3Helper');

// ─── GET /api/listings — semua listing OPEN ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { propertyId, search = '' } = req.query;

    const where = { status: 'OPEN' };
    if (propertyId) where.propertyId = propertyId;

    const listings = await MarketplaceListing.findAll({
      where,
      include: [
        {
          model:      User,
          as:         'seller',
          attributes: ['id', 'fullName', 'walletAddress'],
        },
        {
          model:   Property,
          as:      'property',
          ...(search ? {
            where: {
              [Op.or]: [
                { title:    { [Op.iLike]: `%${search}%` } },
                { location: { [Op.iLike]: `%${search}%` } },
              ],
            },
          } : {}),
          include: [
            { model: PropertyImage, as: 'images', limit: 1 },
            { model: User, as: 'owner', attributes: ['fullName'] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ status: 'success', data: listings, total: listings.length });
  } catch (err) {
    console.error('[listings GET]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/listings/my — listing milik investor sendiri ───────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const listings = await MarketplaceListing.findAll({
      where:   { sellerId: req.user.id },
      include: [
        {
          model:   Property,
          as:      'property',
          include: [{ model: PropertyImage, as: 'images', limit: 1 }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ status: 'success', data: listings });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /api/listings — buat listing baru ───────────────────────────────────
router.post('/', protect, roleGuard('INVESTOR', 'TENANT', 'OWNER'), async (req, res) => {
  try {
    const { propertyId, tokenAmount, pricePerToken } = req.body;

    if (!propertyId || !tokenAmount || !pricePerToken) {
      return res.status(400).json({
        status:  'error',
        message: 'propertyId, tokenAmount, dan pricePerToken wajib diisi',
      });
    }
    if (parseInt(tokenAmount) <= 0 || parseFloat(pricePerToken) <= 0) {
      return res.status(400).json({
        status:  'error',
        message: 'Jumlah token dan harga harus lebih dari 0',
      });
    }

    const investment = await Investment.findOne({
      where: { investorId: req.user.id, propertyId },
    });

    if (!investment || (investment.tokenAmount ?? 0) < parseInt(tokenAmount)) {
      return res.status(400).json({
        status:  'error',
        message: 'Token tidak mencukupi untuk dijual',
      });
    }

    const existing = await MarketplaceListing.findOne({
      where: { sellerId: req.user.id, propertyId, status: 'OPEN' },
    });
    if (existing) {
      return res.status(400).json({
        status:  'error',
        message: 'Kamu sudah punya listing aktif untuk properti ini. Batalkan dulu sebelum membuat listing baru.',
      });
    }

    const listing = await MarketplaceListing.create({
      sellerId:      req.user.id,
      propertyId,
      tokenAmount:   parseInt(tokenAmount),
      pricePerToken: parseFloat(pricePerToken),
      totalPrice:    parseInt(tokenAmount) * parseFloat(pricePerToken),
      status:        'OPEN',
    });

    const result = await MarketplaceListing.findOne({
      where:   { id: listing.id },
      include: [{ model: Property, as: 'property', attributes: ['title'] }],
    });

    return res.status(201).json({
      status:  'success',
      message: `Berhasil listing ${tokenAmount} token untuk dijual`,
      data:    result,
    });
  } catch (err) {
    console.error('[listings POST]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/listings/:id/cancel — batalkan listing ───────────────────────
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const listing = await MarketplaceListing.findOne({ where: { id: req.params.id } });

    if (!listing)
      return res.status(404).json({ status: 'error', message: 'Listing tidak ditemukan' });
    if (listing.sellerId !== req.user.id)
      return res.status(403).json({ status: 'error', message: 'Bukan listing kamu' });
    if (listing.status !== 'OPEN')
      return res.status(400).json({ status: 'error', message: 'Listing sudah tidak aktif' });

    await listing.update({ status: 'CANCELLED' });

    return res.json({ status: 'success', message: 'Listing dibatalkan', data: listing });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /api/listings/:id/buy — Beli token dari listing (DENGAN SECURITY GATE) ───
router.post('/:id/buy', protect, async (req, res) => {
  try {
    const { txHash } = req.body;

    // --- SECURITY GATE: VERIFIKASI ON-CHAIN ---
    if (!txHash) {
      return res.status(400).json({ status: 'error', message: 'txHash (bukti transaksi) wajib disertakan' });
    }

    const isLegit = await verifyOnChain(txHash);
    if (!isLegit) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Transaksi tidak valid atau tidak ditemukan di jaringan blockchain Sepolia.' 
      });
    }
    // ------------------------------------------

    const listing = await MarketplaceListing.findOne({
      where: { id: req.params.id },
      include: [{ model: User, as: 'seller' }],
    });

    // 1. Validasi Dasar Database
    if (!listing)
      return res.status(404).json({ status: 'error', message: 'Listing tidak ditemukan' });
    if (listing.status !== 'OPEN')
      return res.status(400).json({ status: 'error', message: 'Listing sudah tidak tersedia atau sudah terjual' });
    if (listing.sellerId === req.user.id)
      return res.status(400).json({ status: 'error', message: 'Tidak bisa membeli listing milik sendiri' });

    // 2. Jalankan Operasi Update Listing
    await listing.update({ status: 'SOLD', txHash: txHash });

    // 3. Kurangi token dari Portfolio Penjual
    await Investment.decrement('tokenAmount', {
      by: listing.tokenAmount,
      where: { investorId: listing.sellerId, propertyId: listing.propertyId },
    });

    // 4. Update / Create Portfolio Pembeli
    const buyerInv = await Investment.findOne({
      where: { investorId: req.user.id, propertyId: listing.propertyId },
    });

    if (buyerInv) {
      // Akumulasi token jika pembeli sudah punya investasi di properti ini sebelumnya
      await buyerInv.update({
        tokenAmount: buyerInv.tokenAmount + parseInt(listing.tokenAmount),
        totalPaid:   parseFloat(buyerInv.totalPaid) + parseFloat(listing.totalPrice),
        txHash:      txHash, 
      });
    } else {
      // Buat record investasi baru jika pembeli pertama kali beli di properti ini
      await Investment.create({
        investorId:  req.user.id,
        propertyId:  listing.propertyId,
        tokenAmount: listing.tokenAmount,
        totalPaid:   listing.totalPrice,
        status:      'ACTIVE',
        txHash:      txHash,
      });
    }

    return res.json({
      status: 'success',
      message: 'Pembelian terverifikasi Blockchain! Kepemilikan token telah berpindah tangan.',
      data: {
        listingId: listing.id,
        newOwnerId: req.user.id,
        tokenAmount: listing.tokenAmount,
        txHash: txHash
      },
    });
  } catch (err) {
    console.error('[listings buy error]', err);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem saat memproses pembelian' });
  }
}); 

module.exports = router;