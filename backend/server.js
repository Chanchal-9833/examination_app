require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app = express();
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Ensure models are registered
require('./models/ExamSet');
require('./models/Question');
require('./models/Student');
require('./models/Result');

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
 // origin: ['https://vesasc-exam.netlify.app', 'http://localhost:3000'],

  origin: ['https://vesasc-exam.netlify.app', 'http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'], // In production, restrict to your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '2mb' })); // Allow larger JSON for bulk question upload

// Rate limiting - protect against abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,                         // raised from 200 to 2000
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {           // use real student IP not proxy IP
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.ip;
  },
  message: { message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,                           // raised from 20 to 50 per student
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.ip;
  },
  message: { message: ' Server is loading please wait for a while.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exam', require('./routes/exam'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
