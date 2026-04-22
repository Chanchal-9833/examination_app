const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const { sendOTPEmail, sendPasswordResetEmail } = require('../utils/mailer');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, contactNumber, additionalContactNumber, cetRegistrationNumber, password } = req.body;

    if (!name || !email || !contactNumber || !cetRegistrationNumber || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!/^\d{10}$/.test(contactNumber)) {
      return res.status(400).json({ message: 'Contact number must be 10 digits' });
    }

    if (additionalContactNumber && !/^\d{10}$/.test(additionalContactNumber)) {
      return res.status(400).json({ message: 'Additional contact number must be 10 digits' });
    }

   if (!/^[A-Za-z]{2}\d{8}$/.test(cetRegistrationNumber)) {
  return res.status(400).json({ message: 'CET registration number must start with 2 letters followed by 8 digits (e.g. MH12345678)' });
}

    const existingStudent = await Student.findOne({ email: email.toLowerCase() });
    if (existingStudent) {
      if (existingStudent.isVerified) {
        return res.status(400).json({ message: 'Email already registered. Please login.' });
      }
      // Re-send OTP if not verified
      const otp = generateOTP();
      existingStudent.otp = otp;
      existingStudent.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await existingStudent.save();
      await sendOTPEmail(email, name, otp);
      return res.json({ message: 'OTP resent to your email.', email });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    const student = new Student({
      name,
      email: email.toLowerCase(),
      contactNumber,
      additionalContactNumber: additionalContactNumber || '',
      cetRegistrationNumber,
      password: hashedPassword,
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
    });

    await student.save();
    await sendOTPEmail(email, name, otp);

    res.status(201).json({ message: 'Registration successful. OTP sent to email.', email });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});
// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) return res.status(400).json({ message: 'Student not found' });
    if (student.isVerified) return res.status(400).json({ message: 'Already verified. Please login.' });
    if (student.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (new Date() > student.otpExpiry) return res.status(400).json({ message: 'OTP expired. Please register again.' });

    student.isVerified = true;
    student.otp = undefined;
    student.otpExpiry = undefined;
    await student.save();

    res.json({ message: 'Email verified successfully! You can now login.' });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) return res.status(400).json({ message: 'Student not found' });
    if (student.isVerified) return res.status(400).json({ message: 'Already verified' });

    const otp = generateOTP();
    student.otp = otp;
    student.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await student.save();
    await sendOTPEmail(email, student.name, otp);

    res.json({ message: 'OTP resent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) return res.status(400).json({ message: 'Invalid email or password' });
    if (!student.isVerified) return res.status(400).json({ message: 'Please verify your email first' });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = jwt.sign(
      { id: student._id, email: student.email, name: student.name },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );

    res.json({
      message: 'Login successful',
      token,
      student: { name: student.name, email: student.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/admin-login
router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ message: 'Admin login successful', token });
  } else {
    res.status(401).json({ message: 'Invalid admin credentials' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const student = await Student.findOne({ email: email.toLowerCase() });
    if (!student) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    if (!student.isVerified) {
      return res.status(400).json({ message: 'This account is not verified yet. Please verify your email first.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    student.resetToken = resetToken;
    student.resetTokenExpiry = resetTokenExpiry;
    await student.save();

    // Send reset email
    await sendPasswordResetEmail(student.email, student.name, resetToken);

    res.json({ message: 'Password reset link sent to your email. Valid for 30 minutes.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
  

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const student = await Student.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() } // token not expired
    });


    if (!student) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    // Update password and clear token
    student.password = await bcrypt.hash(password, 10);
    student.resetToken = undefined;
    student.resetTokenExpiry = undefined;
    await student.save();

    res.json({ message: 'Password reset successful! You can now login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;
