const { User, Property } = require('../models');
const { Op }             = require('sequelize');

// ─── GET /api/auth/users/profile ─────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        'id', 'email', 'fullName', 'role', 'walletAddress',
        'phone', 'avatar', 'dateOfBirth', 'emergencyName',
        'emergencyPhone', 'emergencyRel', 'reputationScore',
        'createdAt', 'isSuspended', 'kycStatus', 'kycDocumentUrl',
      ],
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    // ✅ Prisma: _count.select.properties → Sequelize: hitung manual dengan count()
    const listedProperties = await Property.count({ where: { ownerId: req.user.id } });

    return res.status(200).json({
      status: 'success',
      data: {
        ...user.toJSON(),
        listedProperties,
      },
    });
  } catch (error) {
    console.error('[getProfile]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/auth/users (admin — list semua user) ────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        'id', 'email', 'fullName', 'role', 'walletAddress',
        'phone', 'avatar', 'createdAt', 'isSuspended',
        'kycStatus', 'kycDocumentUrl',
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    console.error('[getAllUsers]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── PUT /api/auth/users/profile ─────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const {
      fullName, phone, dateOfBirth,
      emergencyName, emergencyPhone, emergencyRel, avatarUrl,
    } = req.body;

    const avatar = req.file ? req.file.path : (avatarUrl || req.body.avatar || null);

    const updateData = {};
    if (fullName       !== undefined) updateData.fullName       = fullName;
    if (phone          !== undefined) updateData.phone          = phone          || null;
    if (avatar)                       updateData.avatar         = avatar;
    if (dateOfBirth    !== undefined) updateData.dateOfBirth    = dateOfBirth    ? new Date(dateOfBirth) : null;
    if (emergencyName  !== undefined) updateData.emergencyName  = emergencyName  || null;
    if (emergencyPhone !== undefined) updateData.emergencyPhone = emergencyPhone || null;
    if (emergencyRel   !== undefined) updateData.emergencyRel   = emergencyRel   || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ status: 'error', message: 'Tidak ada data yang diperbarui' });
    }

    // ✅ Prisma: update({ where, data, select }) → Sequelize: update() lalu findByPk()
    await User.update(updateData, { where: { id: req.user.id } });

    const user = await User.findByPk(req.user.id, {
      attributes: [
        'id', 'email', 'fullName', 'role', 'phone', 'avatar',
        'walletAddress', 'dateOfBirth', 'emergencyName',
        'emergencyPhone', 'emergencyRel', 'kycStatus', 'kycDocumentUrl',
      ],
    });

    return res.status(200).json({
      status:  'success',
      message: 'Profil berhasil diperbarui',
      data:    user,
    });
  } catch (error) {
    console.error('[updateProfile]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/auth/users/kyc ─────────────────────────────────────────────────
const uploadKyc = async (req, res) => {
  try {
    const { kycDocumentUrl } = req.body;

    if (!kycDocumentUrl) {
      return res.status(400).json({ status: 'error', message: 'URL Dokumen wajib dikirim' });
    }

    await User.update(
      { kycStatus: 'UNDER_REVIEW', kycDocumentUrl },
      { where: { id: req.user.id } }
    );

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: ['id', 'kycStatus', 'kycDocumentUrl'],
    });

    return res.status(200).json({ status: 'success', data: updatedUser });
  } catch (error) {
    console.error('[uploadKyc]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── PATCH /api/admin/users/:id/suspend ──────────────────────────────────────
const suspendUser = async (req, res) => {
  try {
    const { id }          = req.params;
    const { isSuspended } = req.body;

    await User.update({ isSuspended }, { where: { id } });
    const updatedUser = await User.findByPk(id);

    return res.json({
      status:  'success',
      message: isSuspended ? 'Akun berhasil di-suspend' : 'Akun diaktifkan kembali',
      data:    updatedUser,
    });
  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Prisma: user.delete → Sequelize: User.destroy
    const deleted = await User.destroy({ where: { id } });

    if (deleted === 0) {
      return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    return res.json({ status: 'success', message: 'Akun user berhasil dihapus secara permanen' });
  } catch (error) {
    console.error('[deleteUser]', error);
    return res.status(400).json({ status: 'error', message: 'Gagal menghapus user atau user tidak ditemukan' });
  }
};

// ─── PUT /api/auth/users/wallet ───────────────────────────────────────────────
const updateWallet = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !walletAddress.startsWith('0x')) {
      return res.status(400).json({ status: 'error', message: 'Wallet address tidak valid' });
    }

    // ✅ Prisma: findFirst({ where: { NOT: { id } } }) → Sequelize: findOne + Op.ne
    const existing = await User.findOne({
      where: {
        walletAddress,
        id: { [Op.ne]: req.user.id }, // ✅ Op.ne = not equal
      },
    });
    if (existing) {
      return res.status(409).json({ status: 'error', message: 'Wallet sudah terdaftar di akun lain' });
    }

    await User.update({ walletAddress }, { where: { id: req.user.id } });

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'walletAddress', 'fullName'],
    });

    return res.status(200).json({
      status:  'success',
      message: 'Wallet berhasil dihubungkan',
      data:    user,
    });
  } catch (error) {
    console.error('[updateWallet]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── PATCH /api/admin/users/:id/verify (verifikasi KYC oleh admin) ────────────
const verifyKyc = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        status:  'error',
        message: 'Status tidak valid. Gunakan VERIFIED atau REJECTED.',
      });
    }

    await User.update({ kycStatus: status }, { where: { id } });

    const updatedUser = await User.findByPk(id, {
      attributes: ['id', 'fullName', 'email', 'kycStatus'],
    });

    return res.json({
      status:  'success',
      message: status === 'VERIFIED' ? 'KYC berhasil diverifikasi' : 'KYC ditolak',
      data:    updatedUser,
    });
  } catch (error) {
    console.error('[verifyKyc]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getProfile,
  getAllUsers,
  updateProfile,
  uploadKyc,
  suspendUser,
  deleteUser,
  updateWallet,
  verifyKyc,
};