const {getUserStatus} = require('../sendShiftData');
const {generateShiftButtons} = require('./generateShiftButtons');
const {format} = require('date-fns');
const generateShiftBlocks = async ({
  body,
  userId = null,
  channelId = null,
  shiftNumber,
  selectedShiftType = '',
  data = null
}) => {
  const response = await getUserStatus(body, userId, channelId, shiftNumber, selectedShiftType);
  const formattedData = response.data;
  const {flags, statistics} = formattedData;
  const {shiftDuration, totalBreakTime} = statistics;
  const date = new Date();
  const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));
  console.log('started formating settings');
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Статус зміни на ${format(kievDate, 'dd.MM.yyyy')}: ${statistics.status}`,
        emoji: true
      }
    },

    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Час зміни:*\n${String(shiftDuration.hours).padStart(2, '0')}:${String(
            shiftDuration.minutes
          ).padStart(2, '0')}`
        },
        {
          type: 'mrkdwn',
          text: `*Час перерви:*\n${
            flags.hasStartedBreak
              ? `${String(totalBreakTime.hours).padStart(2, '0')}:${String(
                  totalBreakTime.minutes
                ).padStart(2, '0')}`
              : 'Ще не брали'
          }`
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Виберіть дію для управління зміною:'
      }
    },
    {
      type: 'actions',
      elements: generateShiftButtons(
        flags.isBreakActive,
        flags.isShiftActive,
        null,
        selectedShiftType,
        shiftNumber
      )
    }
  ];
  return blocks;
};
module.exports = {generateShiftBlocks};
