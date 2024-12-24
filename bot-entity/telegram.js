require('dotenv').config();
const axios = require('axios');
const bot = require('../utils/telegramBot');

const userStates = {};

bot.onText(/\/sync/, async msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const queryParams = `chatId=${chatId}&userId=${userId}`;
  const targetUrl = `https://study-booking.netlify.app/?${queryParams}`;

  const options = {
    reply_markup: {
      keyboard: [
        [
          {
            text: 'Перейти на сайт 🌐',
            url: targetUrl
          }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };

  try {
    await bot.sendMessage(
      chatId,
      'Добро пожаловать! Используйте кнопку ниже, чтобы перейти на сайт:',
      options
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
