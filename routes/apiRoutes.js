import express from "express";
import protect from "../authMiddleware.js";
import {
  requestAsPersonal,
  getPendingRequests,
  updateRequestStatus,
  uploadCallLog,
  getLegacyData,
  getLatestVersion,
} from "../controllers/appController.js";

const router = express.Router();

// Request Routes
router.post("/requestAsPersonal", protect, requestAsPersonal);
router.get("/getPendingRequests", protect, getPendingRequests);
router.put("/updateRequestStatus", protect, updateRequestStatus);

// Data Routes
router.post("/uploadCallLog", protect, uploadCallLog);
router.get("/getLegacyData", protect, getLegacyData);

// Version Route
router.get("/version/latest", getLatestVersion);

export default router;