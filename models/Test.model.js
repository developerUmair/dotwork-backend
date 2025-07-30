import mongoose from "mongoose";

const testSchema = mongoose.Schema({
  testName: { type: String, required: true },
  category: { type: String, required: true },
  duration: { type: Number, required: true },
  description: { type: String, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  mcqs: [
    {
      question: String,
      options: [String],
      marks: Number,
    },
  ],

  trueFalse: [{ question: String, marks: Number }],
  descriptive: [{ question: String, marks: Number }],
  candidateEmails: [String],
  accessDeadline: Date,
  proctoring: { type: Boolean, default: true },
  screenShotFrequency: { type: Number, required: true },
  fullScreenForce: { type: Boolean, default: true },
});

const Test = mongoose.model("Test", testSchema);
export default Test;
