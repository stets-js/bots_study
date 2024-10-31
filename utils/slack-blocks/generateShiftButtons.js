const {generateButton} = require('./buttons');

function generateShiftButtons(
  isOnBreak = false,
  isShiftActive = false,
  hasTakenBreakToday = false
) {
  const buttons = [];

  if (!isShiftActive) {
    buttons.push(generateButton('start_shift', 'start_shift', 'primary', 'Почати зміну'));
  } else {
    if (isOnBreak) {
      buttons.push(generateButton('end_break', 'end_break', 'primary', 'Закінчити перерву'));
    } else {
      if (!hasTakenBreakToday)
        buttons.push(generateButton('start_break', 'start_break', 'primary', 'Розпочати перерву'));
    }
    buttons.push(generateButton('end_shift', 'end_shift', 'danger', 'Завершити зміну'));
  }
  buttons.push(generateButton('refresh_shift', 'refresh_shift', 'primary', 'Оновити 🔄'));
  return buttons;
}
async function updateShiftMessage(client, body, statusText, buttons) {
  const updatedBlocks = [
    {
      type: 'section',
      text: {type: 'mrkdwn', text: `*${statusText}*`}
    },
    {
      type: 'actions',
      elements: buttons
    }
  ];

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: statusText,
    blocks: updatedBlocks
  });
}
module.exports = {generateShiftButtons, updateShiftMessage};
