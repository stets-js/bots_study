const nodemailer = require('nodemailer');

const sendEmail = async options => {
  if (!options.email) {
    console.error('No email provided');
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    service: process.env.EMAIL_SERVICE,
    port: 587,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  const mailOptions = {
    from: options.sender,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html ? options.html : ''
  };
  await transporter.sendMail(mailOptions);
};

module.exports = {sendEmail};
