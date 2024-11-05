const axios = require('axios');
const {format} = require('date-fns');
async function sendShiftData(body, channelId, status) {
  const userSlackId = body.user.id;
  const date = new Date();
  const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));
  try {
    const response = await axios.post('https://dolphin-app-b3fkw.ondigitalocean.app/api/shift', {
      userSlackId,
      date: format(kievDate, 'yyyy.MM.dd HH:mm'),
      status,
      channelId
    });
    console.log('Дані успішно надіслані:', response.data);
    return response;
  } catch (error) {
    return error;
    console.error('Помилка при надсиланні даних:', error.response?.data || error.message);
  }
}
async function getUserStatus(body, userId = null, channelIdParam = null) {
  const userSlackId = userId || body.user.id;
  const channelId = channelIdParam || body.channel.id;
  const date = new Date();
  const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));
  console.log(
    `https://dolphin-app-b3fkw.ondigitalocean.app/api/shift/statistic?userSlackId=${userSlackId}&todayDate=${format(
      kievDate,
      'yyyy-MM-dd'
    )}&channelId=${channelId}`
  );

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
    console.log('ERROR!!!!!!!');
    return error;
  }
}

module.exports = {sendShiftData, getUserStatus};
