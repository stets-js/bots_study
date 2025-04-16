const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  // service: process.env.EMAIL_SERVICE,
  port: 2525,
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});
const sendEmail = async (options) => {
  if (!options.email) {
    console.error("No email provided");
    return;
  }

  const mailOptions = {
    from: '"Goiteens Bot" <d.stetsenko@goiteens.ua>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || "",
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error; // Перекидаємо далі, щоб головний файл вже вирішував requeue чи ні
  }
};

module.exports = { sendEmail };
