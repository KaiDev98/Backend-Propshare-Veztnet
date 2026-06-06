const express = require('express');
const router  = express.Router();
const { uploadPayment }  = require('../controllers/rentalController');
const { verifyPayment } = require("../controllers/rentalController");
const { protect }        = require('../middlewares/authMiddleware');
const { roleGuard }      = require('../middlewares/roleMiddleware');

router.post('/',          protect, roleGuard('TENANT'), uploadPayment);
router.patch("/:id/verify", protect, roleGuard("OWNER", "ADMIN"), verifyPayment);
module.exports = router;