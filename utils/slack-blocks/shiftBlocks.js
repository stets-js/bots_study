const {generateShiftButtons} = require('./generateShiftButtons');

const generateShiftBlocks = ({statistics, flags}) => {
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
            totalBreakTime.hours > 0 || totalBreakTime.minutes > 0
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
      elements: generateShiftButtons(flags.isBreakActive, flags.isShiftActive)
    }
  ];
  return blocks;
};
module.exports = {generateShiftBlocks};
