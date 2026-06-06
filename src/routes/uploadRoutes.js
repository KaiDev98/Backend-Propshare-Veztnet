const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const FormData = require('form-data');
const multer   = require('multer');
const { protect } = require('../middlewares/authMiddleware');

// Simpan file di memory sementara, tidak perlu simpan ke disk
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload/ipfs
router.post('/ipfs', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'File wajib diupload' });
    }

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
    });

    // ✅ Pinata API v2 — file tampil di dashboard Public
    formData.append('name',    req.file.originalname);
    formData.append('network', 'public');

    const response = await axios.post(
      'https://uploads.pinata.cloud/v3/files', // ✅ endpoint v2
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.PINATA_JWT}`, // ✅ pakai JWT
        },
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
      }
    );

    // ✅ Response v2 strukturnya berbeda dari v1
    const cid = response.data.data.cid;

    return res.status(200).json({
      status: 'success',
      data: {
        cid,
        url: `${process.env.PINATA_GATEWAY_URL}/ipfs/${cid}`,
      },
    });

  } catch (error) {
    console.error('[uploadIPFS]', error.response?.data || error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal upload ke IPFS',
    });
  }
});

module.exports = router;