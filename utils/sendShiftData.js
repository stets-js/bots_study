const axios = require("axios");

async function sendShiftData(body, status) {
    const userSlackId = body.user.id;
    const channelId = body.channel.id;
    const date = new Date();

    try {
        const response = await axios.post(
            "https://dolphin-app-b3fkw.ondigitalocean.app/api/shift",
            {
                userSlackId,
                date,
                status,
                channelId,
            }
        );
        console.log("Дані успішно надіслані:", response.data);
        return response;
    } catch (error) {
        return error;
        console.error(
            "Помилка при надсиланні даних:",
            error.response?.data || error.message
        );
    }
}
async function getUserStatus(body) {
    const userSlackId = body.user.id;
    const channelId = body.channel.id;
    const date = new Date();
    const kievDate = date.toLocaleDateString("uk-UA", {
        timeZone: "Europe/Kiev",
    });

    try {
        const response = await axios.post(
            `https://dolphin-app-b3fkw.ondigitalocean.app/api/shift/statistic?userSlackId=${userSlackId}&todayDate=${kievDate}&channelId=${channelId}`
        );
        console.log("Дані успішно отримані:", response.data);
        return response;
    } catch (error) {
        return error;
    }
}

module.exports = { sendShiftData, getUserStatus };
