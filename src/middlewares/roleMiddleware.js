/**
 * Role-Based Access Control Middleware
 * Penggunaan: roleGuard('ADMIN'), roleGuard('OWNER', 'ADMIN')
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Akses ditolak. Hanya ${allowedRoles.join(' / ')} yang diizinkan`,
      });
    }

    next();
  };
};

module.exports = { roleGuard };
