const {generateButton, generateDatePicker} = require('./buttons');
function generateSelector({name, action_id, options, placeholder, selectedValue = null}) {
  const body = {
    type: 'static_select',
    action_id,
    placeholder: {
      type: 'plain_text',
      text: name,
      emoji: true
    }
  };
  if (selectedValue && selectedValue.length > 0)
    body.initial_option = {
      text: {
        type: 'plain_text',
        text: selectedValue,
        emoji: true
      },
      value: selectedValue
    };
  return {
    ...body,
    options: options.map(option => ({
      text: {
        type: 'plain_text',
        text: option,
        emoji: true
      },
      value: option
    }))
  };
}

function generateShiftButtons(
  isOnBreak = false,
  isShiftActive = false,
  hasTakenBreakToday = false,
  selectedShiftType = '',
  shiftNumber = ''
) {
  const buttons = [];
  let additionalData = '';
  if (selectedShiftType) additionalData += `@${selectedShiftType}`;
  if (shiftNumber) additionalData += `@${shiftNumber}`;
  if (!isShiftActive) {
    buttons.push(
      generateSelector({
        name: 'shift_type',
        action_id: 'shift_type_selector',
        options: ['om', 'kwiz'],
        selectedValue: selectedShiftType
      })
    );

    buttons.push(
      generateButton('start_shift', `start_shift${additionalData}`, 'primary', 'Почати зміну')
    );
  } else {
    if (isOnBreak) {
      buttons.push(
        generateButton('end_break', `end_break${additionalData}`, 'primary', 'Завершити перерву')
      );
    } else {
      buttons.push(
        generateButton(
          'start_break',
          `start_break${additionalData}`,
          'primary',
          'Розпочати перерву'
        )
      );
      buttons.push(
        generateButton('end_shift', `end_shift${additionalData}`, 'danger', 'Завершити зміну')
      );
    }
  }
  if (isShiftActive)
    buttons.push(
      generateButton('refresh_shift', `refresh_shift${additionalData}`, 'primary', 'Оновити час🔄')
    );
  console.log(buttons);
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

async function generateSpreadsheetActions(selectedShiftType, start, end) {
  const buttons = [];
  let additionalData = '';
  if (selectedShiftType) additionalData += `@${selectedShiftType}`;

  buttons.push(
    generateSelector({
      name: 'shift_type',
      action_id: 'spreadsheet_type_selector',
      options: ['om', 'kwiz'],
      selectedValue: selectedShiftType
    })
  );
  const now = new Date();

  const startOfTheMonth = start || new Date(now.getFullYear(), now.getMonth(), 1);

  const endOfTheMonth = end || new Date(now.getFullYear(), now.getMonth() + 1, 0);

  buttons.push(generateDatePicker({action_id: 'start_date', initial_date: startOfTheMonth}));
  buttons.push(generateDatePicker({action_id: 'end_date', initial_date: endOfTheMonth}));
  buttons.push(
    generateButton('generate_spreadsheet', `generate_spreadsheet`, 'primary', 'Згенерувати')
  );

  return buttons;
}

module.exports = {
  generateShiftButtons,
  generateSelector,
  updateShiftMessage,
  generateSpreadsheetActions
};
