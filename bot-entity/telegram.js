require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT, {polling: true});

// Функция отправки сообщения в Telegram
const sendTelegramNotification = async (chatId, message) => {
  try {
    await bot.sendMessage(chatId, message);
    console.log(`Message sent to chat ${chatId}`);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
};

module.exports = sendTelegramNotification;
