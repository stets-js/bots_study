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

const sendTelegramNotification = async (chatId, message, reply_markup = {}) => {
  try {
    console.log(reply_markup, 'marikup');
    await bot.sendMessage(chatId, message, {...reply_markup});
    console.log(`Message sent to chat ${chatId}`);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
};

bot.on('callback_query', async callbackQuery => {
  const {message, data} = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const {action, subgroupId, status} = JSON.parse(data);
  try {
    const response = await updateStatus({id: subgroupId, status});

    if (response.status === 200) {
      bot.sendMessage(
        chatId,
        status.includes('approved')
          ? 'Ви підтвердили викладання у потоці'
          : 'Ви відмовились від викладання у потоці'
      );
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    await bot.deleteMessage(chatId, messageId);
    bot.sendMessage(
      chatId,
      'Це повідомлення не актуальне, або щось пішло не так. В разі необхідності підтверження потока, використайте Teacher booking'
    );
    console.error(
      'Це повідомлення не актуальне, або щось пішло не так. В разі необхідності підтверження потока, використайте Teacher booking',
      error
    );
  }
});

module.exports = sendTelegramNotification;
