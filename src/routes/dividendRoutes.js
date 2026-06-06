const express = require('express');
const router = express.Router();
const {
  distributeDividend,
  getDividendHistory,
  claimDividends,            // ← import fungsi baru
} = require('../controllers/dividendController');
const { protect } = require('../middlewares/authMiddleware');
const { roleGuard } = require('../middlewares/roleMiddleware');

router.post('/distribute', protect, roleGuard('ADMIN'), distributeDividend);
router.get('/history',     protect, roleGuard('INVESTOR'), getDividendHistory);
router.post('/claim-all',  protect, roleGuard('INVESTOR'), claimDividends);  
module.exports = router;