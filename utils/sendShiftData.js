const axios = require('axios');
const {format} = require('date-fns');
const {sendGroupMessage} = require('../bot-entity/slack');
async function sendShiftData(body, status, reportsChannelId) {
  const userSlackId = body.user.id;
  const channelId = body.channel.id;

  try {
    const response = await axios.post('https://dolphin-app-b3fkw.ondigitalocean.app/api/shift', {
      userSlackId,
      date,
      status,
      channelId
    });
    let message = '';
    if (status === 'start_shift')
      message = `<@${userSlackId}?> *розпочав* зміну о ${format(date, 'HH:mm')}.`;
    else if (status === 'start_break')
      message = `<@${userSlackId}?> *розпочав* перерву о ${format(date, 'HH:mm')}.`;
    else if (status === 'end_break')
      message = `<@${userSlackId}?> *завершив* перерву о ${format(date, 'HH:mm')}.`;
    else if (status === 'end_shift')
      message = `<@${userSlackId}?> *завершив* зміну о ${format(date, 'HH:mm')}.`;
    await sendGroupMessage(reportsChannelId, message);
    console.log('Дані успішно надіслані:', response.data);
    return response;
  } catch (error) {
    return error;
    console.error('Помилка при надсиланні даних:', error.response?.data || error.message);
  }
}
async function getUserStatus(body, userId = null, channelIdParam = null) {
  console.log(body, 'BODY!');

  const userSlackId = userId || body.user.id;
  const channelId = channelIdParam || body.channel.id;
  const date = new Date();
  const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));
  console.log(kievDate);
  try {
    const response = await axios.get(
      `https://dolphin-app-b3fkw.ondigitalocean.app/api/shift/statistic?userSlackId=${userSlackId}&todayDate=${format(
        kievDate,
        'yyyy-MM-dd'
      )}&channelId=${channelId}`
    );
    console.log('Дані успішно отримані:', response.data);
    return response;
  } catch (error) {
    return error;
  }
}

module.exports = {sendShiftData, getUserStatus};
