const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const {
  sequelize,
  User, Property, PropertyImage, Room,
  Rental, Payment, Investment, Dividend,
  Report, Review, Notification, MarketplaceListing,
} = require('../models');
const { protect, roleGuard } = require('../middlewares/authMiddleware');
const { ethers } = require('ethers');
const { notifyKycVerified, notifyKycRejected, createNotification } = require('../utils/notificationHelper');

// ─── Blockchain helpers ───────────────────────────────────────────────────────
const FUNDING_ABI = [
  'function registerProperty(string propertyId, address owner, uint256 fundingTarget, uint256 totalTokens) external',
  'function markAsFunded(string propertyId) external',
  'function properties(string) external view returns (string,address,uint256,uint256,uint256,uint256,bool,bool,uint256)',
];

const getAdminContract = () => {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  return new ethers.Contract(process.env.FUNDING_CONTRACT_ADDRESS, FUNDING_ABI, signer);
};

const registerPropertyOnChain = async (property) => {
  try {
    if (!process.env.FUNDING_CONTRACT_ADDRESS || !process.env.DEPLOYER_PRIVATE_KEY || !process.env.SEPOLIA_RPC_URL) {
      console.warn('[Chain] ENV tidak lengkap, skip register on-chain'); return null;
    }
    if (!property.owner?.walletAddress) {
      console.warn(`[Chain] Owner ${property.ownerId} belum punya wallet, skip`); return null;
    }
    const contract  = getAdminContract();
    const existing  = await contract.properties(property.id);
    if (existing[8] > 0n) { console.log(`[Chain] Property ${property.id} sudah terdaftar, skip`); return null; }

    const fundingInWei = ethers.parseEther((property.fundingTarget / 1_000_000).toFixed(6));
    const tx = await contract.registerProperty(property.id, property.owner.walletAddress, fundingInWei, property.totalTokens);
    await tx.wait(1);
    console.log(`[Chain] ✅ Registered! TX: ${tx.hash}`);
    return tx.hash;
  } catch (err) { console.error('[registerPropertyOnChain]', err.message); return null; }
};

const markPropertyFundedOnChain = async (propertyId) => {
  try {
    if (!process.env.FUNDING_CONTRACT_ADDRESS || !process.env.DEPLOYER_PRIVATE_KEY || !process.env.SEPOLIA_RPC_URL) {
      console.warn('[Chain] ENV tidak lengkap, skip markAsFunded'); return null;
    }
    const contract = getAdminContract();
    const existing = await contract.properties(propertyId);
    if (existing[8] === 0n) { console.warn(`[Chain] Property ${propertyId} belum terdaftar, skip`); return null; }
    if (existing[6])        { console.log(`[Chain] Property ${propertyId} sudah funded, skip`); return null; }

    const tx = await contract.markAsFunded(propertyId);
    await tx.wait(1);
    console.log(`[Chain] ✅ Marked as funded! TX: ${tx.hash}`);
    return tx.hash;
  } catch (err) { console.error('[markPropertyFundedOnChain]', err.message); return null; }
};

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { search = '', page = 1, limit = 200 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = search ? {
      [Op.or]: [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email:    { [Op.iLike]: `%${search}%` } },
      ],
    } : {};

    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      offset,
      limit:      parseInt(limit),
      order:      [['createdAt', 'DESC']],
      attributes: ['id', 'fullName', 'email', 'role', 'phone', 'avatar',
                   'walletAddress', 'kycStatus', 'kycDocumentUrl', 'isSuspended', 'createdAt'],
    });

    return res.json({ status: 'success', data: users, total });
  } catch (err) {
    console.error('[admin/users GET]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/admin/users/:id/verify ───────────────────────────────────────
router.patch('/users/:id/verify', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
    }

    await User.update({ kycStatus: status }, { where: { id } });
    const user = await User.findOne({
      where:      { id },
      attributes: ['id', 'fullName', 'email', 'kycStatus'],
    });

    if (status === 'VERIFIED') await notifyKycVerified(id);
    if (status === 'REJECTED') await notifyKycRejected(id);

    return res.json({ status: 'success', data: user });
  } catch (err) {
    console.error('[admin/users/verify]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/admin/users/:id/suspend ──────────────────────────────────────
router.patch('/users/:id/suspend', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { id }          = req.params;
    const { isSuspended } = req.body;

    if (typeof isSuspended !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'isSuspended harus boolean' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ status: 'error', message: 'Tidak bisa suspend akun sendiri' });
    }

    await User.update({ isSuspended }, { where: { id } });
    const user = await User.findOne({
      where:      { id },
      attributes: ['id', 'fullName', 'email', 'isSuspended'],
    });

    await createNotification(id, 'SYSTEM',
      isSuspended ? 'Akun Disuspend' : 'Akun Diaktifkan Kembali ✅',
      isSuspended ? 'Akun kamu telah disuspend oleh admin.' : 'Akun kamu telah diaktifkan kembali.'
    );

    return res.json({
      status:  'success',
      message: `User berhasil ${isSuspended ? 'disuspend' : 'diaktifkan kembali'}`,
      data:    user,
    });
  } catch (err) {
    console.error('[admin/users/suspend]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ status: 'error', message: 'Tidak bisa menghapus akun sendiri' });
    }

    const user = await User.findOne({ where: { id } });
    if (!user) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });

    await sequelize.transaction(async (t) => {
      // Cari rental IDs dulu untuk hapus payments
      const rentals   = await Rental.findAll({ where: { tenantId: id }, attributes: ['id'], transaction: t });
      const rentalIds = rentals.map(r => r.id);

      await Notification.destroy({ where: { userId: id }, transaction: t });
      await Review.destroy({ where: { tenantId: id }, transaction: t });

      if (rentalIds.length > 0) {
        await Payment.destroy({ where: { rentalId: { [Op.in]: rentalIds } }, transaction: t });
      }

      await Rental.destroy({ where: { tenantId: id }, transaction: t });
      await Investment.destroy({ where: { investorId: id }, transaction: t });
      await MarketplaceListing.destroy({ where: { sellerId: id }, transaction: t });
      await Dividend.destroy({ where: { investorId: id }, transaction: t });
      await User.destroy({ where: { id }, transaction: t });
    });

    return res.json({
      status:  'success',
      message: `User ${user.fullName} (${user.email}) berhasil dihapus permanen`,
    });
  } catch (err) {
    console.error('[admin/users DELETE]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/admin/properties/:id/verify ──────────────────────────────────
router.patch('/properties/:id/verify', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
    }

    const existingProp = await Property.findOne({
      where:   { id },
      include: [{ model: User, as: 'owner', attributes: ['id', 'walletAddress', 'fullName'] }],
    });

    if (!existingProp) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }

    await Property.update({ status }, { where: { id } });
    const prop = await Property.findOne({
      where:      { id },
      attributes: ['id', 'title', 'status', 'ownerId'],
    });

    if (status === 'ACTIVE') {
      registerPropertyOnChain(existingProp)
        .then(async (txHash) => {
          if (txHash) {
            await Property.update({ contractAddress: process.env.FUNDING_CONTRACT_ADDRESS }, { where: { id } });
            console.log(`[Chain] contractAddress saved for ${id}`);
          }
        })
        .catch(err => console.error('[Chain] register failed:', err.message));

      await createNotification(prop.ownerId, 'SYSTEM',
        'Properti Disetujui! 🏠',
        `Properti "${prop.title}" telah diverifikasi dan sedang didaftarkan ke blockchain.`
      );
    } else if (status === 'INACTIVE') {
      await createNotification(prop.ownerId, 'SYSTEM',
        'Properti Dinonaktifkan',
        `Properti "${prop.title}" dinonaktifkan oleh admin.`
      );
    }

    return res.json({ status: 'success', data: prop });
  } catch (err) {
    console.error('[admin/properties/verify]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── PATCH /api/admin/properties/:id/mark-funded ─────────────────────────────
router.patch('/properties/:id/mark-funded', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const prop = await Property.findOne({
      where:      { id },
      attributes: ['id', 'title', 'ownerId', 'currentFunding', 'fundingTarget'],
    });

    if (!prop) return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });

    const txHash = await markPropertyFundedOnChain(id);
    await Property.update({ status: 'FUNDED' }, { where: { id } });

    await createNotification(prop.ownerId, 'PAYMENT',
      'Properti Fully Funded! 🎉',
      `Properti "${prop.title}" telah mencapai target funding. Dana siap untuk ditarik.`
    );

    return res.json({
      status:  'success',
      message: 'Properti berhasil di-mark sebagai funded',
      data:    { txHash },
    });
  } catch (err) {
    console.error('[admin/properties/mark-funded]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── DELETE /api/admin/properties/:id ────────────────────────────────────────
router.delete('/properties/:id', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const prop = await Property.findOne({ where: { id } });
    if (!prop) return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });

    await sequelize.transaction(async (t) => {
      // Cari room & rental IDs dulu untuk hapus payments
      const rooms     = await Room.findAll({ where: { propertyId: id }, attributes: ['id'], transaction: t });
      const roomIds   = rooms.map(r => r.id);
      const rentals   = roomIds.length > 0
        ? await Rental.findAll({ where: { roomId: { [Op.in]: roomIds } }, attributes: ['id'], transaction: t })
        : [];
      const rentalIds = rentals.map(r => r.id);

      await Review.destroy({ where: { propertyId: id }, transaction: t });

      if (rentalIds.length > 0) {
        await Payment.destroy({ where: { rentalId: { [Op.in]: rentalIds } }, transaction: t });
      }
      if (roomIds.length > 0) {
        await Rental.destroy({ where: { roomId: { [Op.in]: roomIds } }, transaction: t });
      }

      await Room.destroy({ where: { propertyId: id }, transaction: t });
      await Investment.destroy({ where: { propertyId: id }, transaction: t });
      await MarketplaceListing.destroy({ where: { propertyId: id }, transaction: t });
      await PropertyImage.destroy({ where: { propertyId: id }, transaction: t });
      await Dividend.destroy({ where: { propertyId: id }, transaction: t });
      await Report.destroy({ where: { propertyId: id }, transaction: t });
      await Property.destroy({ where: { id }, transaction: t });
    });

    return res.json({
      status:  'success',
      message: `Properti "${prop.title}" berhasil dihapus permanen`,
    });
  } catch (err) {
    console.error('[admin/properties DELETE]', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const [totalUsers, totalProps, totalRentals, totalPayments] = await Promise.all([
      User.count(),
      Property.count(),
      Rental.count(),
      Payment.count({ where: { status: 'VERIFIED' } }),
    ]);

    return res.json({
      status: 'success',
      data:   { totalUsers, totalProps, totalRentals, totalPayments },
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;