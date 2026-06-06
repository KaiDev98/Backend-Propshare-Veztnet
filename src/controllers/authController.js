const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const userService = require('../services/userService');
const { User }   = require('../models'); 

// Token reset disimpan di memory sementara
const resetTokens = new Map();

// ─── Helper: Generate JWT ─────────────────────────────────────────────
const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── Helper: Nodemailer transporter ──────────────────────────────────
const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

// ─── POST /api/auth/register ──────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        status:  'error',
        message: 'Email, password, dan nama lengkap wajib diisi',
      });
    }

    const existing = await userService.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        status:  'error',
        message: 'Email sudah terdaftar',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await userService.createUser({
      email,
      password: hashedPassword,
      fullName,
      role: role || 'INVESTOR',
    });

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(201).json({
      status:  'success',
      message: 'Registrasi berhasil',
      data: {
        token,
        user: {
          id:       user.id,
          email:    user.email,
          fullName: user.fullName,
          role:     user.role,
        },
      },
    });
  } catch (error) {
    console.error('[register]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status:  'error',
        message: 'Email dan password wajib diisi',
      });
    }

    const user = await userService.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        status:  'error',
        message: 'Email atau password salah',
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        status:  'error',
        message: 'Akun Anda telah ditangguhkan. Silakan hubungi admin.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status:  'error',
        message: 'Email atau password salah',
      });
    }

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(200).json({
      status:  'success',
      message: 'Login berhasil',
      data: {
        token,
        user: {
          id:            user.id,
          email:         user.email,
          fullName:      user.fullName,
          role:          user.role,
          walletAddress: user.walletAddress ?? null,
        },
      },
    });
  } catch (error) {
    console.error('[login]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/auth/google ────────────────────────────────────────────
const googleLogin = async (req, res) => {
  try {
    const { token, role } = req.body;

    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Token Google wajib diisi' });
    }

    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({ status: 'error', message: 'Token Google tidak valid' });
    }

    const { email, name, sub: googleId } = await googleRes.json();

    if (!email) {
      return res.status(401).json({ status: 'error', message: 'Gagal mendapatkan email dari Google' });
    }

    // ✅ Prisma: prisma.user.findUnique → Sequelize: User.findOne
    let user = await User.findOne({ where: { email } });

    if (user) {
      if (role && user.role !== role.toUpperCase()) {
        return res.status(409).json({
          status:  'error',
          message: `Akun ini sudah terdaftar sebagai ${user.role}`,
        });
      }
    } else {
      // ✅ Prisma: prisma.user.create → Sequelize: User.create
      user = await User.create({
        email,
        fullName: name,
        role:     role ? role.toUpperCase() : 'INVESTOR',
        password: await bcrypt.hash(googleId, 12),
      });
    }

    const jwtToken = generateToken({ id: user.id, role: user.role });

    return res.status(200).json({
      status: 'success',
      data: {
        token: jwtToken,
        user: {
          id:            user.id,
          email:         user.email,
          fullName:      user.fullName,
          role:          user.role,
          walletAddress: user.walletAddress ?? null,
        },
      },
    });
  } catch (err) {
    console.error('[googleLogin]', err);
    return res.status(401).json({ status: 'error', message: 'Token Google tidak valid' });
  }
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email wajib diisi' });
    }

    // ✅ Prisma: prisma.user.findUnique → Sequelize: User.findOne
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Email tidak terdaftar' });
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000;
    resetTokens.set(token, { email: email.toLowerCase(), expires });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from:    `"PropShare Campus" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: 'Reset Password - PropShare Campus',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color:#EC5B13">Reset Password</h2>
          <p>Halo <b>${user.fullName}</b>,</p>
          <p>Kami menerima permintaan reset password untuk akun PropShare kamu.</p>
          
            href="${resetUrl}"
            style="display:inline-block;margin:20px 0;padding:14px 28px;background:#EC5B13;color:white;font-weight:bold;border-radius:10px;text-decoration:none;"
          >
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:12px;">
            Link ini hanya berlaku selama <b>15 menit</b>.<br/>
            Jika kamu tidak meminta reset password, abaikan email ini.
          </p>
          <hr style="border-color:#f1f5f9" />
          <p style="color:#94a3b8;font-size:11px;">© 2026 PropShare Campus</p>
        </div>
      `,
    });

    return res.status(200).json({
      status:  'success',
      message: 'Link reset password telah dikirim ke email kamu',
    });
  } catch (error) {
    console.error('[forgotPassword]', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim email. Coba lagi.' });
  }
};

// ─── GET /api/auth/verify-reset-token?token=xxx ───────────────────────
const verifyResetToken = (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Token wajib diisi' });
    }

    const data = resetTokens.get(token);

    if (!data) {
      return res.status(400).json({ status: 'error', message: 'Token tidak valid' });
    }

    if (data.expires < Date.now()) {
      resetTokens.delete(token);
      return res.status(400).json({ status: 'error', message: 'Token sudah kadaluarsa' });
    }

    return res.status(200).json({ status: 'success', message: 'Token valid' });
  } catch (error) {
    console.error('[verifyResetToken]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/auth/reset-password ───────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Token dan password baru wajib diisi' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ status: 'error', message: 'Password minimal 6 karakter' });
    }

    const data = resetTokens.get(token);

    if (!data) {
      return res.status(400).json({ status: 'error', message: 'Token tidak valid' });
    }

    if (data.expires < Date.now()) {
      resetTokens.delete(token);
      return res.status(400).json({ status: 'error', message: 'Token sudah kadaluarsa. Minta link baru.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    // ✅ Prisma: prisma.user.update({ where, data }) → Sequelize: User.update(data, { where })
    await User.update(
      { password: hashed },
      { where: { email: data.email } }
    );

    resetTokens.delete(token);

    return res.status(200).json({
      status:  'success',
      message: 'Password berhasil diperbarui',
    });
  } catch (error) {
    console.error('[resetPassword]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────
module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  verifyResetToken,
  resetPassword,
};