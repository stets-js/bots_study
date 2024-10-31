const {getUserStatus} = require('../sendShiftData');
const {generateShiftButtons} = require('./generateShiftButtons');

const generateShiftBlocks = async ({body, userId = null, channelId = null}) => {
  const {data} = await getUserStatus(body, userId, channelId);
  const {flags, statistics} = data;
  const {shiftDuration, totalBreakTime} = statistics;
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Статус зміни: ${statistics.status}`,
        emoji: true
      }
    },

    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Зміна активна:*\n${String(shiftDuration.hours).padStart(2, '0')}:${String(
            shiftDuration.minutes
          ).padStart(2, '0')}`
        },
        {
          type: 'mrkdwn',
          text: `*Перерва активна:*\n${
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
        statistics.hasTakenBreakToday
      )
    }
  ];
  return blocks;
};
module.exports = {generateShiftBlocks};
