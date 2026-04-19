const mongoose = require('mongoose');

const examSetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  duration: { type: Number, default: 60 }, // minutes
  negativeMarkingEnabled: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false },
  instructions: { type: [String], default: [
    'The exam consists of 100 questions across 4 sections: English (40), Quants (30), General Knowledge (15), and Computer Skills (15).',
    'Each correct answer carries 4 marks.',
    'Each wrong answer carries -1 mark (negative marking).',
    'Unattempted questions carry 0 marks.',
    'Do not refresh the page during the exam.',
    'Your answers are saved locally. Submit before the timer runs out.',
    'Once submitted, you cannot re-attempt the exam.',
    'Results will be emailed to you after submission.'
  ]},
  createdAt: { type: Date, default: Date.now }
});

examSetSchema.index({ isActive: 1 });

module.exports = mongoose.model('ExamSet', examSetSchema);
