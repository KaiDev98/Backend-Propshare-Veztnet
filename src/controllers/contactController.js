// controllers/contactController.js
const nodemailer = require('nodemailer');

const sendGuestMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validasi input
    if (!name || !email || !message) {
      return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
    }

    // 1. Konfigurasi Transporter (Sama seperti sebelumnya)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Email pengirim (bisa email kamu)
        pass: process.env.EMAIL_PASS, // App Password Gmail (16 digit)
      },
    });

    // 2. Format Email yang masuk ke Inbox kamu
    const mailOptions = {
      from: `"${name}" <${process.env.EMAIL_USER}>`, // Tampilkan nama pengirim
      to: 'muhammadrifkirusli@gmail.com', // Email tujuan (Inbox kamu)
      replyTo: email, // PENTING: Agar saat kamu klik "Balas/Reply" di Gmail, balasan langsung ke email si guest
      subject: `Pesan Baru dari Guest: ${name} - PropShare Campus`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #EC5B13;">Pesan Baru dari PropShare Campus</h2>
          <p><strong>Nama:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Pesan:</strong></p>
          <p style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 5px;">${message}</p>
        </div>
      `,
    };

    // 3. Kirim Email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      status: 'success', 
      message: 'Pesan berhasil dikirim!' 
    });

  } catch (error) {
    console.error('[sendGuestMessage]', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan' });
  }
};

module.exports = { sendGuestMessage };