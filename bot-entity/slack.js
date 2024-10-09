require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const amqp = require('amqplib/callback_api');
const {sendMessage} = require('../utils/sendMessage');

// Create Slack slackApp instance
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
async function sendConfirmationMessage(channelId, subgroupId, userId, userSlackId, text) {
  const messageBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${text}*`
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Підтверджую'
          },
          value: `confirm_${userId}_${subgroupId}_${userSlackId}`,
          action_id: 'confirm_action'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Ні'
          },
          value: `cancel_${userId}_${subgroupId}_${userSlackId}`,
          action_id: 'cancel_action'
        }
      ]
    }
  ];

  try {
    const result = await client.chat.postMessage({
      channel: userSlackId,
      text: 'Будеш працювати?',
      blocks: messageBlocks
    });
    console.log(`Confirmation message sent to ${userSlackId}`);
  } catch (error) {
    console.error(`Error sending confirmation message: ${error.message}`);
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
slackApp.action('confirm_action', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId] = action.value.split('_');

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: `Підтверждено!`,
    blocks: []
  });
  sendMessage('slack_queue_confirmation', 'subgroup_confirmed', {subgroupId, userId});
  console.log(`Subgroup ${subgroupId} confirmed by user ${userId}.`);
});

slackApp.action('cancel_action', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId] = action.value.split('_');

  const messageBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Яка причина:`
      }
    },
    {
      type: 'input',
      block_id: 'cancel_reason_block',
      element: {
        type: 'plain_text_input',
        action_id: 'cancel_reason_input',
        multiline: true
      },
      label: {
        type: 'plain_text',
        text: 'Причина'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Зберегти'
          },
          value: `submit_reason_${userId}_${subgroupId}_${userSlackId}`,
          action_id: 'submit_reason'
        }
      ]
    }
  ];

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: 'Яка причина?',
    blocks: messageBlocks
  });
});

slackApp.action('submit_reason', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId] = action.value.split('_');
  const reason = body.state.values['cancel_reason_block']['cancel_reason_input'].value;

  if (reason && reason.length > 0) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Користувач <@${userSlackId}> відмінив за причиною: "${reason}". Підгрупа: ${subgroupId}`,
      blocks: []
    });
    sendMessage('slack_queue_confirmation', 'subgroup_declined', {subgroupId, userId, reason});
  } else {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: userSlackId,
      text: 'Яка причина.'
    });
  }
});

module.exports = {
  slackApp,
  sendDirectMessage,
  sendGroupMessage,
  sendConfirmationMessage
};
