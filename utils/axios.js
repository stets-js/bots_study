const axios = require('axios');

async function updateStatus(data) {
  const url = `https://dolphin-app-b3fkw.ondigitalocean.app/api/subgroups/${data.id}/status`;
  try {
    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
}

module.exports = {
  updateStatus
};
