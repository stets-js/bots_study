require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const queue_name = process.env.QUEUE_NAME;
if (queue_name === 'tg_queue') {
  const bot = new TelegramBot(process.env.TELEGRAM_BOT, {polling: true});

  const sendTelegramNotification = async (chatId, message, options = {}) => {
    try {
      await bot.sendMessage(chatId, message, options);
      console.log(`Message sent to chat ${chatId}`);
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
  };

  module.exports = sendTelegramNotification;
}
