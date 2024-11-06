const {generateButton} = require('./buttons');
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
      generateButton(
        'start_shift',
        `start_shift@${selectedShiftType}@${shiftNumber}`,
        'primary',
        'Почати зміну'
      )
    );
  } else {
    if (isOnBreak) {
      buttons.push(
        generateButton(
          'end_break',
          `end_break@${selectedShiftType}@${shiftNumber}`,
          'primary',
          'Закінчити перерву'
        )
      );
    } else {
      if (!hasTakenBreakToday)
        buttons.push(
          generateButton(
            'start_break',
            `start_break@${selectedShiftType}@${shiftNumber}`,
            'primary',
            'Розпочати перерву'
          )
        );
      buttons.push(
        generateButton(
          'end_shift',
          `end_shift@${selectedShiftType}@${shiftNumber}`,
          'danger',
          'Завершити зміну'
        )
      );
    }
  }
  buttons.push(
    generateButton(
      'refresh_shift',
      `refresh_shift@${selectedShiftType}@${shiftNumber}`,
      'primary',
      'Оновити 🔄'
    )
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

module.exports = {generateShiftButtons, generateSelector, updateShiftMessage};
