const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  pool: true,          // Use connection pooling for high concurrency
  maxConnections: 10,
  maxMessages: 100
});

const sendOTPEmail = async (email, name, otp) => {
  const mailOptions = {
    from: `"VESASC EXAM Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your OTP for VESASC Exam Portal Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1a237e; padding: 24px; text-align: center;">
          <h2 style="color: white; margin: 0;">🎓 Exam Portal</h2>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 16px;">Dear <strong>${name}</strong>,</p>
          <p>Your One-Time Password (OTP) for registration is:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a237e;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">Do not share this OTP with anyone.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 Exam Portal. All rights reserved.</p>
        </div>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
};

const sendResultEmail = async (email, name, result, examTitle) => {
  const percentage = result.percentage.toFixed(2);
  const grade = percentage >= 90 ? 'A+' : percentage >= 75 ? 'A' : percentage >= 60 ? 'B' : percentage >= 45 ? 'C' : 'D';
  const gradeColor = percentage >= 60 ? '#2e7d32' : percentage >= 45 ? '#f57f17' : '#c62828';

  const mailOptions = {
    from: `"Exam Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your ${examTitle} Result - Score: ${result.score}/${result.maxScore}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1a237e; padding: 24px; text-align: center;">
          <h2 style="color: white; margin: 0;">🎓 ${examTitle}</h2>
          <p style="color: #90caf9; margin: 8px 0 0 0;">Result Card</p>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 16px;">Dear <strong>${name}</strong>,</p>
          <p>Your exam has been evaluated. Here are your results:</p>

          <div style="background: #e8eaf6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 48px; font-weight: bold; color: #1a237e;">${result.score}<span style="font-size: 24px; color: #666;">/${result.maxScore}</span></div>
            <div style="font-size: 28px; font-weight: bold; color: ${gradeColor}; margin-top: 8px;">Grade: ${grade}</div>
            <div style="font-size: 18px; color: #444; margin-top: 4px;">${percentage}%</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Metric</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Count</th>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;">Total Questions</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${result.totalQuestions}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd;">Attempted</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${result.attempted}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; color: #2e7d32;">✓ Correct</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #2e7d32;">${result.correct}</td>
            </tr>
            <tr style="background: #f5f5f5;">
              <td style="padding: 12px; border: 1px solid #ddd; color: #c62828;">✗ Incorrect</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd; color: #c62828;">${result.incorrect}</td>
            </tr>
          </table>

          <h3 style="color: #1a237e;">Subject-wise Performance</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #1a237e; color: white;">
              <th style="padding: 10px; text-align: left;">Subject</th>
              <th style="padding: 10px; text-align: center;">Correct</th>
              <th style="padding: 10px; text-align: center;">Incorrect</th>
              <th style="padding: 10px; text-align: center;">Score</th>
            </tr>
            ${['English', 'Quants', 'General Knowledge', 'Computer Skills'].map(sub => `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${sub}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #ddd; color: #2e7d32;">${result.subjectWise[sub]?.correct || 0}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #ddd; color: #c62828;">${result.subjectWise[sub]?.incorrect || 0}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${result.subjectWise[sub]?.score || 0}</td>
            </tr>`).join('')}
          </table>
        </div>
        <div style="background: #f5f5f5; padding: 16px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 Exam Portal. Result generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, name, token) => {
  // This URL must match your deployed frontend URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

  const mailOptions = {
    from: `"VESASC Exam Portal" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - VESASC Exam Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1a237e; padding: 24px; text-align: center;">
          <h2 style="color: white; margin: 0;">🎓 VESASC Exam Portal</h2>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 16px;">Dear <strong>${name}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="
              background: #1a237e;
              color: white;
              padding: 14px 32px;
              border-radius: 8px;
              text-decoration: none;
              font-size: 16px;
              font-weight: bold;
              display: inline-block;
            ">Reset My Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link is valid for <strong>30 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email. Your password will not change.</p>
          <p style="color: #666; font-size: 14px;">Or copy this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 6px; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 VESASC Exam Portal. All rights reserved.</p>
        </div>
      </div>
    `
  };
  return transporter.sendMail(mailOptions);
};
module.exports = { sendOTPEmail, sendResultEmail, sendPasswordResetEmail };
