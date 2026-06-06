const express = require('express');
const router  = express.Router();
const { getRoomsByProperty, createRoom } = require('../controllers/rentalController');
const { protect }   = require('../middlewares/authMiddleware');
const { roleGuard } = require('../middlewares/roleMiddleware');

// GET /api/rooms/:propertyId (Public atau Protected tergantung kebutuhan)
router.get('/:propertyId', getRoomsByProperty);

// POST /api/rooms 
// KITA UBAH DISINI: Izinkan OWNER dan ADMIN
router.post('/', protect, roleGuard('OWNER', 'ADMIN'), createRoom);

module.exports = router;