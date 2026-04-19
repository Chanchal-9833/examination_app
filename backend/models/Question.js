const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  examSetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamSet',
    required: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['English', 'Quants', 'General Knowledge', 'Computer Skills']
  },
  questionText: { type: String, required: true },
  options: {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
    D: { type: String, required: true }
  },
  correctAnswer: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D']
  },
  marks: { type: Number, default: 4 },
  negativeMarks: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

questionSchema.index({ examSetId: 1, subject: 1 });

module.exports = mongoose.model('Question', questionSchema);
