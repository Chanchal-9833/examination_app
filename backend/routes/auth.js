const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const { sendOTPEmail } = require('../utils/mailer');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, age, education, lastCollegeName, email, mobile, password } = req.body;

    if (!name || !age || !education || !lastCollegeName || !email || !mobile || !password) {
      return res.status(400).json({ message: 'All fields are required' });
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
      name, age, education, lastCollegeName,
      email: email.toLowerCase(), mobile,
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

module.exports = router;
