const express = require('express');
const router = express.Router();
const {
  createInvestment,
  getMyPortfolio,
  getInvestmentStats,
} = require('../controllers/investmentController');
const { protect } = require('../middlewares/authMiddleware');
const { roleGuard } = require('../middlewares/roleMiddleware');

router.post('/', protect, roleGuard('INVESTOR'), createInvestment);
router.get('/my-portfolio', protect, roleGuard('INVESTOR'), getMyPortfolio);
router.get('/stats', protect, roleGuard('INVESTOR'), getInvestmentStats);

module.exports = router;
