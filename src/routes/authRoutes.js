const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const { Op }       = require('sequelize');
const { User }     = require('../models');
const { login, register, googleLogin, forgotPassword, verifyResetToken, resetPassword } = require('../controllers/authController');
const { protect, roleGuard } = require('../middlewares/authMiddleware');
const userController = require('../controllers/userController');

const upload = multer({ dest: 'uploads/' });

// ─── Public ───────────────────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login',    login);
router.post('/google',   googleLogin);

// ─── Protected ────────────────────────────────────────────────────────────────
router.get('/users/profile',    protect, userController.getProfile);
router.put('/users/profile',    protect, userController.updateProfile);
router.patch('/users/wallet',   protect, userController.updateWallet);
router.post('/users/kyc',       protect, userController.uploadKyc);

router.post('/forgot-password',    forgotPassword);
router.get('/verify-reset-token',  verifyResetToken);
router.post('/reset-password',     resetPassword);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get('/users', protect, roleGuard('ADMIN'), async (req, res) => {
  try {
    const users = await User.findAll({
      order:      [['createdAt', 'DESC']],
      attributes: ['id', 'fullName', 'email', 'role', 'isSuspended',
                   'phone', 'avatar', 'walletAddress', 'kycStatus', 'createdAt'],
    });
    return res.json({ status: 'success', data: users, total: users.length });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;