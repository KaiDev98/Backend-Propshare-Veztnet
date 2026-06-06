const express = require('express');
const router  = express.Router();

// ─── Import Routes & Controllers ──────────────────────────────────────────────
const authRoutes       = require('./authRoutes');
const propertyRoutes   = require('./propertyRoutes');
const investmentRoutes = require('./investmentRoutes');
const dividendRoutes   = require('./dividendRoutes');
const uploadRoutes     = require('./uploadRoutes');
const reportRoutes     = require('./reportRoutes');

const rentalRoutes  = require('./rentalRoutes');   
const paymentRoutes = require('./paymentRoutes');  
const roomRoutes    = require('./roomRoutes');     
const adminRoutes   = require('./adminRoutes'); 
const reviewRoutes  = require('./reviewRoutes');
const listingRoutes = require('./marketplaceListingRoutes');
const notificationRoutes = require("./notificationRoutes");

// Controller untuk fitur Hubungi Kami
const { sendGuestMessage } = require('../controllers/contactController');

// ─── Mount Routes ─────────────────────────────────────────────────────────────
router.use('/auth',        authRoutes);
router.use('/properties',  propertyRoutes);
router.use('/investments', investmentRoutes);
router.use('/dividends',   dividendRoutes);
router.use('/upload',      uploadRoutes);
router.use('/reports',     reportRoutes);

router.use('/rentals',  rentalRoutes);   
router.use('/payments', paymentRoutes);  
router.use('/rooms',    roomRoutes);     
router.use('/admin',    adminRoutes); 

router.use('/listings', listingRoutes);
router.use('/api/rooms', roomRoutes); 
router.use('/notifications', notificationRoutes);
router.use('/reviews', reviewRoutes);

// ─── Endpoint Form Kontak (Guest) ─────────────────────────────────────────────
router.post('/contact', sendGuestMessage);

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.status(200).json({
    status:    'success',
    message:   'PropShare API is running 🚀',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;