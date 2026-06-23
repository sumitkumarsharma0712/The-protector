const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn('Email credentials not configured. Skipping sendEmail.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: { user, pass }
  });

  const mailOptions = { from: user, to, subject, text };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };