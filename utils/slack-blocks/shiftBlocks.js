const {getUserStatus} = require('../sendShiftData');
const {generateShiftButtons} = require('./generateShiftButtons');
const {format} = require('date-fns');
const generateShiftBlocks = async ({
  body,
  userId = null,
  channelId = null,
  selectedShiftType = '',
  data = null
}) => {
  let formattedData;
  if (!data) formattedData = await getUserStatus(body, userId, channelId);
  console.log('formatted!!!', formattedData);
  console.log('simple!', data);
  const {flags, statistics} = data || formattedData;
  const {shiftDuration, totalBreakTime} = statistics;
  const date = new Date();
  const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));

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
            statistics.isBreakActive || statistics.hasTakenBreakToday
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
        statistics.hasTakenBreakToday,
        selectedShiftType
      )
    }
  ];
  return blocks;
};
module.exports = {generateShiftBlocks};
