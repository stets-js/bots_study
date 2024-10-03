require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const amqp = require('amqplib/callback_api');

// Create Slack app instance
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
async function sendConfirmationMessage(channelId, subgroupId, userId, text) {
  const messageBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Так'
          },
          value: 'yes',
          action_id: 'confirm_yes'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Ні'
          },
          value: 'no',
          action_id: 'confirm_no'
        }
      ]
    }
  ];

  try {
    await client.chat.postMessage({
      channel: channelId,
      blocks: messageBlocks
    });
    console.log(`Confirmation message sent to group ${channelId}`);
  } catch (error) {
    console.error(`Error sending message: ${error.message}`);
  }
}
async function getUserIdByName(userName) {
  try {
    const result = await client.users.list();
    const user = result.members.find(
      member => member.name === userName || (member.real_name && member.real_name === userName)
    );
    return user ? user.id : null;
  } catch (error) {
    if (error.data.error === 'ratelimited') {
      const retryAfter = parseInt(error.headers['retry-after'], 10) || 1;
      console.log(`Rate limit hit. Retrying after ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return getUserIdByName(userName);
    } else {
      console.error(`Error fetching user list: ${error.message}`);
      return null;
    }
  }
}

async function sendDirectMessage(userName, userId = null, text) {
  if (!userId) userId = await getUserIdByName(userName);
  if (!userId) return;

  try {
    const result = await client.conversations.open({users: userId});
    const channelId = result.channel.id;
    await client.chat.postMessage({channel: channelId, text});
    console.log(`Message sent to ${userName}`);
  } catch (error) {
    console.error(`Error sending message: ${error.message}`);
  }
}

async function sendGroupMessage(channelId, text, blocks = undefined) {
  //   const channelId = 'C059WAPLQ1L'; // Replace with your Slack channel ID
  try {
    await client.chat.postMessage({channel: channelId, text, blocks});
    console.log('Message sent to the group');
  } catch (error) {
    console.error(`Error sending group message: ${error.message}`);
  }
}

// Обработчик нажатий на кнопки
app.action(/confirm/, async ({body, ack, say}) => {
  await ack();
  console.log('Button clicked');
  const userResponse = body.actions[0].value;
  const userId = body.user.id;

  if (userResponse === 'yes') {
    await say(`Користувач <@${userId}> підтвердив!`);
  } else if (userResponse === 'no') {
    await say(`Користувач <@${userId}> відменив.`);
  }
});

module.exports = {sendDirectMessage, sendGroupMessage, sendConfirmationMessage};
