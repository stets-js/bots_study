require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const amqp = require('amqplib/callback_api');
const {sendMessage} = require('../utils/sendMessage');
const {generateButton} = require('../utils/slack-blocks/buttons');

// Create Slack slackApp instance
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
async function sendConfirmationMessage(
  channelId,
  blocks,
  subgroupId,
  userId,
  userSlackId,
  text,
  adminId
) {
  const messageBlocks = [
    blocks,
    {
      type: 'actions',
      elements: [
        generateButton(
          `confirm_${userId}_${subgroupId}_${userSlackId}_${adminId}`,
          'confirm_action'
        ),
        generateButton(
          `cancel_${userId}_${subgroupId}_${userSlackId}_${adminId}`,
          'cancel_action',
          'danger',
          'Відміняю'
        )
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

  const [actionType, userId, subgroupId, userSlackId, adminId] = action.value.split('_');
  const updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');

  updatedBlocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Підтверджено* ✅'
    }
  });
  try {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: body.message.text,
      blocks: updatedBlocks
    });
    sendMessage('slack_queue_confirmation', 'subgroup_confirmed', {
      subgroupId,
      userSlackId,
      userId,
      adminId
    });
    console.log(`Subgroup ${subgroupId} confirmed by user ${userId}.`);
  } catch (error) {
    console.error(`Error updating confirmation message: ${error.message}`);
  }
});

slackApp.action('cancel_action', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId, adminId] = action.value.split('_');
  const updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');
  updatedBlocks.push(
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
        generateButton(
          `submitReason_${userId}_${subgroupId}_${userSlackId}_${adminId}`,
          'submit_reason',
          'danger',
          'Зберегти'
        ),
        generateButton(
          `backToConfirm_${userId}_${subgroupId}_${userSlackId}_${adminId}`,
          'back_to_confirm',
          'primary',
          'Назад'
        )
      ]
    }
  );
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: 'Яка причина?',
    blocks: messageBlocks
  });
});

slackApp.action('submit_reason', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId, adminId] = action.value.split('_');
  const reason = body.state.values['cancel_reason_block']['cancel_reason_input'].value;
  const updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');
  if (reason && reason.length > 0) {
    updatedBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Ви відмінили підгрупу за причиною:\n "${reason}".`
      }
    });
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Користувач <@${userSlackId}> відмінив за причиною: "${reason}". Підгрупа: ${subgroupId}`,
      blocks: []
    });
    sendMessage('slack_queue_confirmation', 'subgroup_declined', {
      subgroupId,
      userId,
      userSlackId,
      adminId,
      reason
    });
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
