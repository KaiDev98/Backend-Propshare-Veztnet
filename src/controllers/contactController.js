const { Resend } = require('resend');

const sendGuestMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'PropShare <onboarding@resend.dev>', // pakai ini dulu sebelum verify domain
      to: 'muhammadrifkirusli@gmail.com',
      replyTo: email,
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
    });

    return res.status(200).json({ status: 'success', message: 'Pesan berhasil dikirim!' });

  } catch (error) {
    console.error('[sendGuestMessage]', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan' });
  }
};

module.exports = { sendGuestMessage };