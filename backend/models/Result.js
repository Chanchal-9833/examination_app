const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, required: true },
  studentEmail: { type: String, required: true },
  examSetId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSet' },
  examSetName: { type: String, default: '' },
  totalQuestions: { type: Number, required: true },
  attempted: { type: Number, required: true },
  correct: { type: Number, required: true },
  incorrect: { type: Number, required: true },
  score: { type: Number, required: true },
  maxScore: { type: Number, required: true },
  percentage: { type: Number, required: true },
  subjectWise: {
    English: { correct: Number, incorrect: Number, score: Number },
    Quants: { correct: Number, incorrect: Number, score: Number },
    'General Knowledge': { correct: Number, incorrect: Number, score: Number },
    'Computer Skills': { correct: Number, incorrect: Number, score: Number }
  },
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedOption: String,
    isCorrect: Boolean
  }],
  submittedAt: { type: Date, default: Date.now }
});

resultSchema.index({ studentEmail: 1 });
resultSchema.index({ examSetId: 1 });
resultSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('Result', resultSchema);
