const mongoose = require('mongoose');

const examSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  duration: { type: Number, default: 180 }, // minutes
  negativeMarkingEnabled: { type: Boolean, default: true },
  examTitle: { type: String, default: 'VESASC Entrance Examination' },
  instructions: { type: [String], default: [
    'The exam consists of 100 questions across 4 sections: English (40), Quants (30), General Knowledge (15), and Computer Skills (15).',
    'Each correct answer carries 4 marks.',
    'Each wrong answer carries -1 mark (negative marking).',
    'Unattempted questions carry 0 marks.',
    'Do not refresh the page during the exam.',
    'Your answers are saved locally. Submit before the timer runs out.',
    'Once submitted, you cannot re-attempt the exam.',
    'Results will be emailed to you after submission.'
  ]}
});

module.exports = mongoose.model('ExamSettings', examSettingsSchema);
