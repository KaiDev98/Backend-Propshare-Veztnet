const express = require("express");
const router  = express.Router();
const { getReports, updateReportStatus, createReport } = require("../controllers/reportController");
const { protect }   = require("../middlewares/authMiddleware");
const { roleGuard } = require("../middlewares/roleMiddleware");

router.get("/",             protect, roleGuard("OWNER", "ADMIN", "TENANT"), getReports); // ← tambah TENANT
router.post("/",            protect, roleGuard("TENANT"),                   createReport);
router.patch("/:id/status", protect, roleGuard("OWNER", "ADMIN"),           updateReportStatus);

module.exports = router;