require('dotenv').config();
const axios = require('axios');
const bot = require('../utils/telegramBot');

const userStates = {};

bot.onText(/\/start-sync/, msg => {
  const chatId = msg.chat.id;

  userStates[chatId] = {step: 'askEmail'};

  bot.sendMessage(chatId, 'Відправте свою пошту з букінга:');
});

bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (userStates[chatId]) {
    const userState = userStates[chatId];

    if (userState.step === 'askEmail') {
      const email = msg.text.trim();

      if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        return bot.sendMessage(chatId, 'Невірний формат пошти. Спробуйте ще раз:');
      }

      userState.email = email;
      userState.step = 'askPassword';
      return bot.sendMessage(chatId, 'Тепер відправте пароль з букінга:');
    }

    if (userState.step === 'askPassword') {
      const password = msg.text.trim();
      userState.password = password;

      console.log(
        `User ${chatId} (ID: ${userId}) provided email: ${userState.email} and password: ${password}`
      );

      try {
        const response = await axios.patch(
          'https://dolphin-app-b3fkw.ondigitalocean.app/api/users/telegram',
          {
            email: userState.email,
            chatId: chatId,
            userId: userId,
            password: password
          }
        );

        if (response.status === 200) {
          await bot.sendMessage(chatId, 'Синхронизация успешно завершена!');
        } else {
          await bot.sendMessage(chatId, 'Щось пішло не так, спробуйте ще раз.');
        }
      } catch (error) {
        console.error('Error syncing user:', error);
        await bot.sendMessage(chatId, 'Щось пішло не так, спробуйте ще раз.');
      }

      delete userStates[chatId];
    }
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
