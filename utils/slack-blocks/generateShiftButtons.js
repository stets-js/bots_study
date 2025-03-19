const deepLogger = require('../deepLog');
const {generateButton, generateDatePicker} = require('./buttons');
const {format} = require('date-fns');
function generateSelector({name, action_id, block_id, options, placeholder, selectedValue = null}) {
  return {
    type: 'static_select',
    action_id,
    placeholder: {
      type: 'plain_text',
      text: placeholder,
      emoji: true
    },
    options: options.map(option => {
      const text = typeof option === typeof '' ? option : option.text;
      const value = typeof option === typeof '' ? option : `${option.value}`;

      return {
        text: {
          type: 'plain_text',
          text,
          emoji: true
        },
        value
      };
    }),
    ...(selectedValue
      ? {
          initial_option: {
            text: {
              type: 'plain_text',
              text: selectedValue,
              emoji: true
            },
            value: selectedValue
          }
        }
      : {})
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
    const selector = generateSelector({
      name: 'shift_type',
      placeholder: 'оберіть зміну',
      action_id: 'shift_type_selector',
      options: ['om', 'kwiz', 'tech'],
      selectedValue: selectedShiftType
    });
    deepLogger('shift selector', selector);
    buttons.push(selector);

    buttons.push(
      generateButton('start_shift', `start_shift${additionalData}`, 'primary', 'Почати зміну')
    );
  } else {
    if (isOnBreak) {
      buttons.push(
        generateButton('end_break', `end_break${additionalData}`, 'primary', 'Завершити перерву')
      );
    } else {
      if (selectedShiftType !== 'tech')
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
  deepLogger('buttons', buttons);
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

function generateSpreadsheetActions(selectedShiftType, start, end) {
  const buttons = [];
  let additionalData = '';

  buttons.push(
    generateSelector({
      placeholder: 'Оберіть тип зміни',
      name: 'shift_type',
      action_id: 'spreadsheet_type_selector',
      options: ['om', 'kwiz', 'tech'],
      selectedValue: selectedShiftType
    })
  );
  const now = new Date();

  const startOfTheMonth =
    start || format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

  const endOfTheMonth =
    end || format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
  const value = {};
  if (selectedShiftType) value.selectedShiftType = selectedShiftType;
  if (start) value.start = start;
  if (end) value.end = end;
  console.log(startOfTheMonth, endOfTheMonth, value);
  buttons.push(
    generateDatePicker({
      action_id: 'start_date',
      initial_date: startOfTheMonth
    })
  );
  buttons.push(
    generateDatePicker({
      action_id: 'end_date',
      initial_date: endOfTheMonth
    })
  );
  buttons.push(
    generateButton('generate_spreadsheet', `generate_spreadsheet`, 'primary', 'Згенерувати', value)
  );

  return buttons;
}

module.exports = {
  generateShiftButtons,
  generateSelector,
  updateShiftMessage,
  generateSpreadsheetActions
};
