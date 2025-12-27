import mongoose from "mongoose";

const RequestSchema = new mongoose.Schema({
  requestedContact: { type: String, required: true },
  requestedBy: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: "pending" }, // pending, approved, rejected
  createdAt: { type: Date, default: Date.now },
});

export default RequestSchema;