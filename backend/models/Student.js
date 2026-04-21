const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  contactNumber: { type: String, required: true },
  additionalContactNumber: { type: String, default: '' },
  cetRegistrationNumber: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Index for fast email lookups
studentSchema.index({ email: 1 });

module.exports = mongoose.model('Student', studentSchema);
