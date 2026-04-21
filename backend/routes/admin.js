const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Result = require('../models/Result');
const Student = require('../models/Student');
const ExamSet = require('../models/ExamSet');
const { verifyAdmin } = require('../middleware/auth');

// ── STATS ─────────────────────────────────────────────────────────────────────
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [totalStudents, totalResults, totalQuestions, examSets] = await Promise.all([
      Student.countDocuments({ isVerified: true }),
      Result.countDocuments(),
      Question.countDocuments(),
      ExamSet.find().sort({ createdAt: -1 }).lean()
    ]);
    const activeSet = examSets.find(s => s.isActive) || null;
    res.json({ totalStudents, totalResults, totalQuestions, examSets, activeSet });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── EXAM SETS ─────────────────────────────────────────────────────────────────

// GET all exam sets
router.get('/exam-sets', verifyAdmin, async (req, res) => {
  try {
    const sets = await ExamSet.find().sort({ createdAt: -1 }).lean();
    console.log('📋 ExamSets fetched:', sets.length);
    // Add question count per set
    const counts = await Question.aggregate([
      { $group: { _id: '$examSetId', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });
    const setsWithCount = sets.map(s => ({
      ...s,
      questionCount: countMap[s._id.toString()] || 0
    }));
    res.json({ examSets: setsWithCount });
  } catch (err) {
    console.error('❌ Get ExamSets error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// POST create exam set
router.post('/exam-set', verifyAdmin, async (req, res) => {
  try {
    const { name, description, duration, negativeMarkingEnabled, instructions } = req.body;
    if (!name) return res.status(400).json({ message: 'Exam set name is required' });
    const examSet = await ExamSet.create({
      name,
      description: description || '',
      duration: duration || 60,
      negativeMarkingEnabled: negativeMarkingEnabled !== false,
      instructions: instructions || undefined
    });
    console.log('✅ ExamSet created:', examSet._id, examSet.name);
    res.status(201).json({ message: 'Exam set created', examSet });
  } catch (err) {
    console.error('❌ Create ExamSet error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// PUT update exam set details
router.put('/exam-set/:id', verifyAdmin, async (req, res) => {
  try {
    const { name, description, duration, negativeMarkingEnabled, instructions } = req.body;
    const examSet = await ExamSet.findByIdAndUpdate(
      req.params.id,
      { name, description, duration, negativeMarkingEnabled, instructions },
      { new: true }
    );
    if (!examSet) return res.status(404).json({ message: 'Exam set not found' });
    res.json({ message: 'Exam set updated', examSet });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST activate an exam set (deactivates all others)
router.post('/exam-set/:id/activate', verifyAdmin, async (req, res) => {
  try {
    // Deactivate all sets first
    await ExamSet.updateMany({}, { isActive: false });
    // Activate the requested one
    const examSet = await ExamSet.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    if (!examSet) return res.status(404).json({ message: 'Exam set not found' });
    res.json({ message: `"${examSet.name}" is now active. Students will get this paper.`, examSet });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST deactivate all exam sets
router.post('/exam-sets/deactivate-all', verifyAdmin, async (req, res) => {
  try {
    await ExamSet.updateMany({}, { isActive: false });
    res.json({ message: 'All exam sets deactivated. No exam is currently active.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE exam set and its questions
router.delete('/exam-set/:id', verifyAdmin, async (req, res) => {
  try {
    await Question.deleteMany({ examSetId: req.params.id });
    await ExamSet.findByIdAndDelete(req.params.id);
    res.json({ message: 'Exam set and its questions deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── QUESTIONS ─────────────────────────────────────────────────────────────────

// POST add single question to a set
router.post('/question', verifyAdmin, async (req, res) => {
  try {
    const { examSetId, subject, questionText, options, correctAnswer, marks, negativeMarks } = req.body;
    if (!examSetId) return res.status(400).json({ message: 'examSetId is required' });
    if (!subject || !questionText || !options || !correctAnswer) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const setExists = await ExamSet.findById(examSetId);
    if (!setExists) return res.status(404).json({ message: 'Exam set not found' });

    const question = await Question.create({
      examSetId, subject, questionText, options, correctAnswer, marks, negativeMarks
    });
    res.status(201).json({ message: 'Question added', question });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST bulk upload questions to a set
router.post('/questions/bulk', verifyAdmin, async (req, res) => {
  try {
    const { examSetId, questions } = req.body;
    if (!examSetId) return res.status(400).json({ message: 'examSetId is required' });
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'questions must be a non-empty array' });
    }
    const setExists = await ExamSet.findById(examSetId);
    if (!setExists) return res.status(404).json({ message: 'Exam set not found' });

    const tagged = questions.map(q => ({ ...q, examSetId }));
    const inserted = await Question.insertMany(tagged, { ordered: false });
    res.json({ message: `${inserted.length} questions added to "${setExists.name}"`, count: inserted.length });
  } catch (err) {
    if (err.name === 'BulkWriteError') {
      return res.status(400).json({ message: 'Some questions failed', error: err.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// GET questions for a specific set
router.get('/questions/:examSetId', verifyAdmin, async (req, res) => {
  try {
    const { subject, page = 1, limit = 100 } = req.query;
    const filter = { examSetId: req.params.examSetId };
    if (subject) filter.subject = subject;
    const questions = await Question.find(filter)
      .skip((page - 1) * limit).limit(parseInt(limit)).lean();
    const total = await Question.countDocuments(filter);
    res.json({ questions, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE single question
router.delete('/question/:id', verifyAdmin, async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE all questions in a set
router.delete('/questions/:examSetId', verifyAdmin, async (req, res) => {
  try {
    const result = await Question.deleteMany({ examSetId: req.params.examSetId });
    res.json({ message: `${result.deletedCount} questions deleted` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── STUDENTS ─────────────────────────────────────────────────────────────────

// GET all registered students
router.get('/students', verifyAdmin, async (req, res) => {
  try {
    const students = await Student.find(
      { isVerified: true },
      {
        name: 1,
        email: 1,
        contactNumber: 1,
        additionalContactNumber: 1,
        cetRegistrationNumber: 1,
        createdAt: 1,
        _id: 1
      }
    ).sort({ createdAt: -1 }).lean();

    res.json({ students, total: students.length });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a single student
router.delete('/student/:id', verifyAdmin, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── RESULTS ───────────────────────────────────────────────────────────────────

// GET all results (optionally filter by examSetId)
router.get('/results', verifyAdmin, async (req, res) => {
  try {
    const { examSetId, page = 1, limit = 200 } = req.query;
    const filter = examSetId ? { examSetId } : {};
    const results = await Result.find(filter, {
      studentName: 1, studentEmail: 1, score: 1, maxScore: 1,
      percentage: 1, correct: 1, incorrect: 1, attempted: 1,
      totalQuestions: 1, submittedAt: 1, subjectWise: 1, examSetName: 1
    })
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    const total = await Result.countDocuments(filter);
    res.json({ results, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE results for a specific exam set
router.delete('/results/:examSetId', verifyAdmin, async (req, res) => {
  try {
    const r = await Result.deleteMany({ examSetId: req.params.examSetId });
    res.json({ message: `${r.deletedCount} results cleared for this exam set` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE all results
router.delete('/results', verifyAdmin, async (req, res) => {
  try {
    await Result.deleteMany({});
    res.json({ message: 'All results cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
