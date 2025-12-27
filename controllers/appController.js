import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// --- 1. Import SCHEMAS ---
// Note: These files must export the Schema object (e.g., export default UserSchema)
import MintDbSchema from "../schema/MintDbModel.js";
import CallLogSchema from "../schema/CallLogModel.js";
import VersionSchema from "../schema/VersionModel.js";
import RequestSchema from "../schema/RequestModel.js";

dotenv.config();

// --- 2. Database Connection Setup ---

// Connect specifically to the "Milestone" Database
const milestoneDbName = "Milestone";
const milestoneConn = mongoose.createConnection(process.env.MONGO_URI, {
  dbName: milestoneDbName,
});

// Register Models on the Milestone Connection
const MintDbModel = milestoneConn.model("MintDb", MintDbSchema);
const CallLogModel = milestoneConn.model("CallLogs", CallLogSchema);
const VersionModel = milestoneConn.model("callyn-version", VersionSchema);
const RequestModel = milestoneConn.model("Requests", RequestSchema);

console.log(`[DB] Connected to database: ${milestoneDbName}`);

// --- 3. Helpers ---
const normalizeName = (name) => (name ? name.toString().toLowerCase().trim() : "");

// --- 4. Request Handlers ---

export const requestAsPersonal = async (req, res) => {
  try {
    const { requestedContact, requestedBy, reason } = req.body;

    if (!requestedContact || !requestedBy || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newRequest = new RequestModel({ requestedContact, requestedBy, reason });
    await newRequest.save();

    console.log(`[Request] New request created by ${requestedBy} for ${requestedContact}`);
    res.status(201).json({ message: "Request submitted successfully", id: newRequest._id });
  } catch (error) {
    console.error("[Request] Error saving:", error.message);
    res.status(500).json({ message: "Error saving request", error: error.message });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const pendingRequests = await RequestModel.find({ status: "pending" }).sort({ createdAt: -1 });
    res.json(pendingRequests);
  } catch (error) {
    console.error("[PendingRequests] Error fetching:", error.message);
    res.status(500).json({ message: "Error fetching requests", error: error.message });
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const validStatuses = ["approved", "rejected", "pending"];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updatedRequest = await RequestModel.findByIdAndUpdate(
      requestId,
      { status: status.toLowerCase() },
      { new: true }
    );

    if (!updatedRequest) return res.status(404).json({ message: "Request not found" });

    console.log(`[RequestStatus] Request ${requestId} marked as ${status}`);
    res.json({ message: `Request marked as ${status}`, data: updatedRequest });
  } catch (error) {
    console.error("[RequestStatus] Error updating:", error.message);
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
};

// --- 5. Call Log Handlers ---

export const uploadCallLog = async (req, res) => {
  try {
    const { callerName, rshipManagerName, type, timestamp, duration } = req.body;
    // Ensure req.user exists (middleware should handle this)
    const uploadedBy = req.user ? req.user.name : "Unknown";

    if (!callerName || !type || !timestamp) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newLog = new CallLogModel({
      callerName,
      rshipManagerName: rshipManagerName || "N/A",
      type: type.toLowerCase(),
      timestamp: new Date(Number(timestamp)),
      duration: Number(duration),
      uploadedBy,
    });

    await newLog.save();
    console.log(`[CallLog] Log saved for agent ${uploadedBy}`);
    res.status(201).json({ message: "Call log saved successfully", id: newLog._id });
  } catch (error) {
    console.error("[CallLog] Error saving:", error.message);
    res.status(500).json({ message: "Error saving call log", error: error.message });
  }
};

// --- 6. Data Handlers ---

export const getLegacyData = async (req, res) => {
  try {
    const loggedInUser = req.user.name;

    // Parallel Fetching for performance
    const [mintResults, personalRequests] = await Promise.all([
      MintDbModel.find({}).select({
        NAME: 1, MOBILE: 1, PAN: 1, "RELATIONSHIP  MANAGER": 1, "FAMILY HEAD": 1
      }).lean(),
      RequestModel.find({ requestedBy: loggedInUser, status: "approved" })
        .select("requestedContact")
        .lean()
    ]);

    const excludedNames = new Set(personalRequests.map((r) => normalizeName(r.requestedContact)));
    
    // Filter and Map
    const contacts = mintResults
      .filter((doc) => !excludedNames.has(normalizeName(doc.NAME)))
      .map((doc) => ({
        name: doc.NAME,
        number: (doc.MOBILE || "").replace(/"/g, ""),
        type: "work",
        pan: (doc.PAN || "").replace(/"/g, ""),
        rshipManager: (doc["RELATIONSHIP  MANAGER"] || "").replace(/"/g, ""),
        familyHead: (doc["FAMILY HEAD"] || "").replace(/"/g, ""),
      }));

    res.json(contacts);
  } catch (error) {
    console.error("[LegacyData] Error fetching:", error.message);
    res.status(500).json({ message: "Error fetching data" });
  }
};

export const getLatestVersion = async (req, res) => {
  try {
    const latestVersion = await VersionModel.findOne().sort({ createdAt: -1, _id: -1 });

    if (!latestVersion) {
      return res.status(404).json({ message: "No version info found" });
    }

    res.json({
      latestVersion: latestVersion.version,
      updateType: latestVersion.type,
      changelog: latestVersion.changelog,
      downloadUrl: latestVersion.downloadUrl,
    });
  } catch (error) {
    console.error("[VersionCheck] Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};