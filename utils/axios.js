const axios = require('axios');
axios.defaults.headers.common['Accept'] = 'application/json';

axios.defaults.baseURL = 'https://dolphin-app-b3fkw.ondigitalocean.app/api';

const sendStatusUpdate = async (token, data) => {
  console.log(data, 'data!!');
  const url = `https://dolphin-app-b3fkw.ondigitalocean.app/api/subgroups/${data.subgroupId}/status?action=${data.status}&mentorId=${data.mentorId}`;

  return axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

async function checkAuthorization(slackId) {
  try {
    const result = await axios.get(
      `https://dolphin-app-b3fkw.ondigitalocean.app/api/auth/slack?slackId=${slackId}`
    );
    return result.data;
  } catch (error) {
    console.error(`Ошибка при проверке авторизации: ${error.message}`);
    return {isSync: false, user: []};
  }
}

async function getCancelReason() {
  try {
    const result = await axios.get(`https://dolphin-app-b3fkw.ondigitalocean.app/api/cancelReason`);
    return result.data;
  } catch (error) {
    console.error(`Ошибка при проверке авторизации: ${error.message}`);
    return {isSync: false, user: []};
  }
}
module.exports = {sendStatusUpdate, checkAuthorization, getCancelReason};
