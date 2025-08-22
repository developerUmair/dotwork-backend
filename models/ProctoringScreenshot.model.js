import mongoose from "mongoose";

const ProctoringScreenshotSchema = new mongoose.Schema({
  sessionId: { type: String, index: true, required: true },
  testSlug: { type: String, index: true, required: true },
  takenAt: { type: Date, required: true },

  public_id: String,
  secure_url: String,
  width: Number,
  height: Number,
  bytes: Number,
  format: String,
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

const Proctoring = mongoose.model("ProctoringScreenshot", ProctoringScreenshotSchema);
export default Proctoring;
