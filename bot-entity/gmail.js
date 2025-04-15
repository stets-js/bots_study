const nodemailer = require("nodemailer");

console.log("Sending email using:", process.env.EMAIL_USERNAME);
console.log("Sending email using:", process.env.EMAIL_PASSWORD);

const transporter = nodemailer.createTransport({
  // host: process.env.EMAIL_HOST,
  service: process.env.EMAIL_SERVICE,
  // port: 587,
  // port: 465,
  // secure: true,
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
    from: options.sender,
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
