require('dotenv').config();
const axios = require('axios');
const bot = require('../utils/telegramBot');

bot.onText(/\/sync/, async msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const queryParams = `chatId=${chatId}&userId=${userId}`;
  const targetUrl = `https://study-booking.netlify.app/?${queryParams}`;

  try {
    await bot.sendMessage(
      chatId,
      `Для синхронізації перейдіть за посиланням.\nЯкщо ви вже авторизовані до букінга, синхронізація відбудеться автоматично.\nВ іншому випадку, після переходу за посиланням треба авторизуватися. \n ${targetUrl}`
    );
  } catch (error) {
    console.error('Error setting persistent button:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка, попробуйте позже.');
  }
});

const sendTelegramNotification = async (chatId, message, options = {}) => {
  try {
    await bot.sendMessage(chatId, message, options);
    console.log(`Message sent to chat ${chatId}`);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
};

module.exports = sendTelegramNotification;
