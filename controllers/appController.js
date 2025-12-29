import MintDbModel from "../schema/MintDbModel.js";
import CallLogModel from "../schema/CallLogModel.js";
import VersionModel from "../schema/VersionModel.js";
import RequestModel from "../schema/RequestModel.js";

// --- Helpers ---
const normalizeName = (name) => (name ? name.toString().toLowerCase().trim() : "");

// --- Request Handlers ---

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

// --- Call Log Handlers ---

export const uploadCallLog = async (req, res) => {
  try {
    const { callerName, rshipManagerName, type, timestamp, duration } = req.body;
    const uploadedBy = req.user.name;

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

// --- Data Handlers ---

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