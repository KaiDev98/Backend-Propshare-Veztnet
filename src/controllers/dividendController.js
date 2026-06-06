const { Payment, Property, Investment, Dividend, Rental, Room } = require('../models'); // ✅ tambah Rental, Room
const { Op }      = require('sequelize');
const sequelize   = require('../config/db');

// ─── PATCH /api/payments/:id/verify ──────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!['SUCCESS', 'FAILED'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status harus SUCCESS atau FAILED' });
    }

    const payment = await Payment.findByPk(id, {
      include: [{
        model:   Rental,
        as:      'rental',          // ✅ tambah as
        include: [{
          model:   Room,
          as:      'room',          // ✅ tambah as
          include: [{
            model: Property,
            as:    'property',      // ✅ tambah as
          }],
        }],
      }],
    });

    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Pembayaran tidak ditemukan' });
    }

    // ✅ akses relasi pakai alias lowercase
    if (payment.rental.room.property.ownerId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }

    await Payment.update({ status }, { where: { id } });
    const updatedPayment = await Payment.findByPk(id);

    return res.status(200).json({
      status:  'success',
      message: `Pembayaran berhasil di-${status === 'SUCCESS' ? 'verifikasi' : 'tolak'}`,
      data:    updatedPayment,
    });
  } catch (error) {
    console.error('[verifyPayment]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/dividends/distribute ──────────────────────────────────────────
const distributeDividend = async (req, res) => {
  try {
    const { propertyId, paymentId, txHash } = req.body;

    if (!propertyId || !paymentId || !txHash) {
      return res.status(400).json({
        status:  'error',
        message: 'propertyId, paymentId, dan txHash wajib diisi',
      });
    }

    const payment = await Payment.findByPk(paymentId);
    if (!payment || payment.status !== 'SUCCESS') {
      return res.status(400).json({
        status:  'error',
        message: 'Pembayaran tidak valid atau belum diverifikasi',
      });
    }
    if (payment.isDistributed) {
      return res.status(409).json({
        status:  'error',
        message: 'Dividen sudah pernah didistribusikan',
      });
    }

    const property = await Property.findByPk(propertyId, {
      include: [{
        model: Investment,
        as:    'investments',       // ✅ tambah as
      }],
    });

    if (!property || property.investments.length === 0) {
      return res.status(404).json({
        status:  'error',
        message: 'Tidak ada investor untuk properti ini',
      });
    }

    const totalTokens    = property.investments.reduce((s, i) => s + i.tokenAmount, 0);
    const dividendAmount = payment.amount * 0.8;

    const dividendRecords = property.investments.map((inv) => ({
      investorId: inv.investorId,
      propertyId,
      amount:     (inv.tokenAmount / totalTokens) * dividendAmount,
      txHash,
      status:     'PENDING',
    }));

    await sequelize.transaction(async (t) => {
      await Dividend.bulkCreate(dividendRecords, { transaction: t });
      await Payment.update(
        { isDistributed: true },
        { where: { id: paymentId }, transaction: t }
      );
    });

    return res.status(201).json({
      status:  'success',
      message: `Dividen berhasil didistribusikan ke ${dividendRecords.length} investor`,
      data: {
        totalDistributed: dividendAmount,
        investorCount:    dividendRecords.length,
      },
    });
  } catch (error) {
    console.error('[distributeDividend]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/dividends/history ───────────────────────────────────────────────
const getDividendHistory = async (req, res) => {
  try {
    const dividends = await Dividend.findAll({
      where:   { investorId: req.user.id },
      include: [{
        model:      Property,
        as:         'property',     // ✅ tambah as
        attributes: ['id', 'title', 'location'],
      }],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ status: 'success', data: dividends });
  } catch (error) {
    console.error('[getDividendHistory]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/dividends/claim-all ───────────────────────────────────────────
const claimDividends = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status:  'error',
        message: 'Tidak ada dividend yang dipilih',
      });
    }

    const validDividends = await Dividend.findAll({
      where: {
        id:         { [Op.in]: ids },
        investorId: req.user.id,
        status:     'PENDING',
      },
    });

    if (validDividends.length === 0) {
      return res.status(400).json({
        status:  'error',
        message: 'Tidak ada dividend valid untuk diklaim',
      });
    }

    const validIds    = validDividends.map((d) => d.id);
    const totalAmount = validDividends.reduce((sum, d) => sum + d.amount, 0);

    await Dividend.update(
      { status: 'CLAIMED', claimedAt: new Date() },
      { where: { id: { [Op.in]: validIds } } }
    );

    return res.status(200).json({
      status:  'success',
      message: 'Dividend berhasil diklaim',
      data: {
        claimedCount: validIds.length,
        totalAmount,
      },
    });
  } catch (error) {
    console.error('[claimDividends]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

module.exports = { verifyPayment, distributeDividend, getDividendHistory, claimDividends };