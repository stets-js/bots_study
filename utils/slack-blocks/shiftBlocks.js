const {getUserStatus} = require('../sendShiftData');
const {generateShiftButtons} = require('./generateShiftButtons');
const {format} = require('date-fns');
const generateShiftBlocks = async ({body, userId = null, channelId = null}) => {
  const kwizCheck = await client.conversations.members({
    channel: 'C07UADS7U3G'
  });
  const correctChannelId = kwizCheck.members.includes(body.user.id) ? 'C07UADS7U3G' : 'C07U2G5J7PH';
  const {data} = await getUserStatus(body, userId, correctChannelId);
  const {flags, statistics} = data;
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
        statistics.hasTakenBreakToday
      )
    }
  ];
  return blocks;
};
module.exports = {generateShiftBlocks};
