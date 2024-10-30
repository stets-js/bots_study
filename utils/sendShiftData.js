const axios = require('axios');

async function sendShiftData(body, status) {
  const userSlackId = body.user.id;
  const channelId = body.channel.id;
  const date = new Date();

  try {
    const response = await axios.post('https://dolphin-app-b3fkw.ondigitalocean.app/api/shift', {
      userSlackId,
      date,
      status,
      channelId
    });

    console.log('Дані успішно надіслані:', response.data);
  } catch (error) {
    console.error('Помилка при надсиланні даних:', error.response?.data || error.message);
  }
}

module.exports = {sendShiftData};
