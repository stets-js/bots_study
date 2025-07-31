const { generateSpreadsheet } = require("./sendShiftData");
const { WebClient } = require("@slack/web-api");
require("dotenv").config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function exportTechShiftsToGoogleSheet() {
  const channelId = "C083PKS3L0M";
  const today = new Date();

  let startDate, endDate;

  const yyyy = today.getFullYear();
  const mm = today.getMonth();
  const dd = today.getDate();

  function formatDate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (dd === 21) {
    const onlyDate = formatDate(today);
    startDate = onlyDate;
    endDate = onlyDate;
  } else if (dd < 21) {
    const start = new Date(yyyy, mm - 1, 21);
    const end = new Date(yyyy, mm, 20);
    startDate = formatDate(start);
    endDate = formatDate(end);
  } else {
    const start = new Date(yyyy, mm, 21);
    startDate = formatDate(start);
    endDate = formatDate(today);
  }

  try {
    const membersRes = await client.conversations.members({
      channel: channelId,
    });
    const memberIds = membersRes.members;

    const detailedMembers = [];

    for (const userId of memberIds) {
      const userRes = await client.users.info({ user: userId });
      detailedMembers.push({
        id: userId,
        name: userRes.user.real_name || userRes.user.name,
      });
    }

    const selectedShiftType = "tech";

    const response = await generateSpreadsheet(
      selectedShiftType,
      startDate,
      endDate,
      detailedMembers
    );

    console.log("Google Sheet сформовано !!!");
    return response.data;
  } catch (error) {
    console.error("!!! Помилка при створенні звіту:", error);
    throw error;
  }
}

module.exports = { exportTechShiftsToGoogleSheet };
