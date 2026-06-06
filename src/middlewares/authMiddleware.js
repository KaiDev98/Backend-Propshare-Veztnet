const jwt   = require('jsonwebtoken');
const { User } = require('../models');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status:  'error',
        message: 'Akses ditolak. Token tidak ditemukan',
      });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Prisma: findUnique({ where, select }) → Sequelize: findByPk({ attributes })
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'walletAddress', 'isSuspended'],
    });

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        status:  'error',
        message: 'Akun kamu telah disuspend. Hubungi admin untuk bantuan.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: 'error', message: 'Token tidak valid' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Token sudah kedaluwarsa' });
    }
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status:  'error',
        message: `Akses ditolak. Anda tidak memiliki role yang diizinkan (${allowedRoles.join(', ')})`,
      });
    }
    next();
  };
};

module.exports = { protect, roleGuard };