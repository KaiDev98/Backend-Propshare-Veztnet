const express = require('express');
const router  = express.Router();
const {
  getRoomsByProperty,
  createRental,
  getMyRentals,
  getAllRentals,       // ← tambah import ini
  updateRentalStatus,
  cancelRental,
  uploadPayment,
  verifyPayment, 
} = require("../controllers/rentalController");
const { protect }   = require('../middlewares/authMiddleware');
const { roleGuard } = require('../middlewares/roleMiddleware');

// ⚠️ my-rentals HARUS di atas /:id
router.get("/",              protect, roleGuard("ADMIN"),            getAllRentals);      // ← tambah ini
router.get("/my-rentals",    protect, roleGuard("TENANT", "OWNER"),  getMyRentals);
router.post("/",             protect, roleGuard("TENANT"),           createRental);
router.patch("/:id/status",  protect, roleGuard("OWNER"),            updateRentalStatus);
router.patch("/:id/cancel",  protect, roleGuard("TENANT"),           cancelRental);
// routes/rentalRoutes.js (atau paymentRoutes.js)
router.patch('/payments/:id/verify', protect, roleGuard('OWNER'), verifyPayment);

module.exports = router;