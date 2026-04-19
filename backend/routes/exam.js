const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const Result = require('../models/Result');
const ExamSet = require('../models/ExamSet');
const Student = require('../models/Student');
const { verifyToken } = require('../middleware/auth');
const { sendResultEmail } = require('../utils/mailer');

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function seededRng(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle a question's options and return displayToOriginal map
// displayToOriginal: { 'A': 'C', 'B': 'A', ... } means displayed A = original C
function shuffleQuestionOptions(question, rng) {
  const labels = ['A', 'B', 'C', 'D'];
  const shuffledLabels = seededShuffle(labels, rng); // original labels in new positions

  const newOptions = {};
  const displayToOriginal = {}; // new label → original label

  shuffledLabels.forEach((originalLabel, idx) => {
    const newLabel = labels[idx];
    newOptions[newLabel] = question.options[originalLabel];
    displayToOriginal[newLabel] = originalLabel;
  });

  return {
    _id: question._id,
    subject: question.subject,
    questionText: question.questionText,
    options: newOptions,
    marks: question.marks,
    negativeMarks: question.negativeMarks,
    _optionMap: displayToOriginal   // sent to client, used when submitting
  };
}

// GET /api/exam/settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const activeSet = await ExamSet.findOne({ isActive: true });
    if (!activeSet) {
      return res.status(404).json({
        message: 'No active exam at the moment. Please contact your administrator.'
      });
    }
    res.json({
      examTitle: activeSet.name,
      duration: activeSet.duration,
      negativeMarkingEnabled: activeSet.negativeMarkingEnabled,
      instructions: activeSet.instructions,
      examSetId: activeSet._id
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/exam/questions
router.get('/questions', verifyToken, async (req, res) => {
  try {
    // Check if already submitted
    const existing = await Result.findOne({ studentEmail: req.user.email });
    if (existing) {
      return res.status(403).json({ message: 'You have already submitted the exam.' });
    }

    // Get active exam set
    const activeSet = await ExamSet.findOne({ isActive: true });
    if (!activeSet) {
      return res.status(404).json({
        message: 'No active exam at the moment. Please contact your administrator.'
      });
    }

    // Load questions for this set only (no correctAnswer sent to client)
    const questions = await Question.find(
      { examSetId: activeSet._id },
      { correctAnswer: 0, __v: 0, examSetId: 0 }
    ).lean();

    if (questions.length === 0) {
      return res.status(404).json({
        message: 'No questions found in the active exam set. Please contact admin.'
      });
    }

    // Group questions by subject
    const groupedBySubject = {};
    questions.forEach(q => {
      if (!groupedBySubject[q.subject]) {
        groupedBySubject[q.subject] = [];
      }
      groupedBySubject[q.subject].push(q);
    });

    // Shuffle questions WITHIN each subject only (subject order maintained)
    const subjectOrder = ['English', 'Quants', 'General Knowledge', 'Computer Skills'];
    const shuffledQuestions = [];
    
    subjectOrder.forEach(subject => {
      if (groupedBySubject[subject]) {
        const subjQns = groupedBySubject[subject];
        const qOrderRng = seededRng(req.user.email + '_qorder_' + subject + '_' + activeSet._id);
        const shuffledSubjQns = seededShuffle(subjQns, qOrderRng);
        shuffledQuestions.push(...shuffledSubjQns);
      }
    });

    // Shuffle OPTIONS per question — seeded by email + questionId
    const processedQuestions = shuffledQuestions.map(q => {
      const optRng = seededRng(req.user.email + '_opt_' + q._id.toString());
      return shuffleQuestionOptions(q, optRng);
    });

    res.json({
      questions: processedQuestions,
      total: processedQuestions.length,
      examSetId: activeSet._id,
      examSetName: activeSet.name
    });
  } catch (err) {
    console.error('Load questions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/exam/submit
// answers format: { [questionId]: { selected: 'B', optionMap: { A:'C', B:'A', C:'D', D:'B' } } }
router.post('/submit', verifyToken, async (req, res) => {
  try {
    const { answers, examSetId } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ message: 'Invalid answers format' });
    }

    // Prevent double submission
    const existing = await Result.findOne({ studentEmail: req.user.email });
    if (existing) {
      return res.status(400).json({ message: 'Exam already submitted', result: existing });
    }

    const student = await Student.findById(req.user.id).lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Get active set (or fall back to submitted examSetId)
    const activeSet = await ExamSet.findOne({ isActive: true }).lean();
    const resolvedSetId = examSetId || (activeSet ? activeSet._id : null);
    const setName = activeSet ? activeSet.name : 'Exam';
    const negativeMarkingEnabled = activeSet ? activeSet.negativeMarkingEnabled : true;

    // Load ALL questions for this set WITH correct answers (server-side only)
    const allQuestions = await Question.find({ examSetId: resolvedSetId }).lean();

    const subjectWise = {
      English: { correct: 0, incorrect: 0, score: 0 },
      Quants: { correct: 0, incorrect: 0, score: 0 },
      'General Knowledge': { correct: 0, incorrect: 0, score: 0 },
      'Computer Skills': { correct: 0, incorrect: 0, score: 0 }
    };

    let totalScore = 0;
    let correct = 0;
    let incorrect = 0;
    let maxScore = 0;
    const answerDetails = [];

    allQuestions.forEach(q => {
      const qId = q._id.toString();
      const marks = q.marks || 4;
      const negMarks = q.negativeMarks || 1;
      maxScore += marks;

      const subj = q.subject;
      if (!subjectWise[subj]) subjectWise[subj] = { correct: 0, incorrect: 0, score: 0 };

      const studentAnswer = answers[qId];
      let isCorrect = false;

      if (studentAnswer && studentAnswer.selected) {
        // Decode displayed option → original option using the map the client sent
        const optionMap = studentAnswer.optionMap || {};
        const originalSelected = optionMap[studentAnswer.selected] || studentAnswer.selected;

        if (originalSelected === q.correctAnswer) {
          correct++;
          totalScore += marks;
          subjectWise[subj].correct++;
          subjectWise[subj].score += marks;
          isCorrect = true;
        } else {
          incorrect++;
          if (negativeMarkingEnabled) {
            totalScore -= negMarks;
            subjectWise[subj].score -= negMarks;
          }
          subjectWise[subj].incorrect++;
        }
      }

      answerDetails.push({
        questionId: q._id,
        selectedOption: studentAnswer?.selected || null,
        isCorrect
      });
    });

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const attempted = Object.values(answers).filter(a => a && a.selected).length;

    const resultData = {
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      examSetId: resolvedSetId,
      examSetName: setName,
      totalQuestions: allQuestions.length,
      attempted,
      correct,
      incorrect,
      score: Math.max(0, totalScore),
      maxScore,
      percentage: Math.max(0, percentage),
      subjectWise,
      answers: answerDetails
    };

    const result = await Result.create(resultData);

    // Send email asynchronously — don't block response
    sendResultEmail(student.email, student.name, resultData, setName)
      .catch(err => console.error('Email error:', err));

    res.json({
      message: 'Exam submitted successfully!',
      result: {
        score: resultData.score,
        maxScore: resultData.maxScore,
        percentage: resultData.percentage.toFixed(2),
        correct,
        incorrect,
        attempted,
        totalQuestions: allQuestions.length,
        subjectWise,
        examSetName: setName,
        resultId: result._id
      }
    });

  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ message: 'Server error during submission' });
  }
});

module.exports = router;
