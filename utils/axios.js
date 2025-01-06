const axios = require('axios');

async function updateStatus(token, data) {
  const url = `https://dolphin-app-b3fkw.ondigitalocean.app/api/subgroups/${data.subgroupId}/status`;
  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (response.status >= 200 && response.status < 300) {
      return response.data;
    } else {
      console.error('Error updating status: Unexpected response status', response.status);
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
}

module.exports = {
  updateStatus
};
