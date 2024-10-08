require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const amqp = require('amqplib/callback_api');

// Create Slack slackApp instance
const slackApp = new App({
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
            text: 'Подтвердить'
          },
          value: `confirm_${userId}`,
          action_id: 'confirm_action'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Отменить'
          },
          value: `cancel_${userId}`,
          action_id: 'cancel_action'
        }
      ]
    }
  ];

  try {
    const result = await client.chat.postMessage({
      channel: userId,
      text: 'Будеш працювати?',
      blocks: messageBlocks
    });
    console.log(`Confirmation message sent to ${userId}`);
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
  const userId = body.user.id;

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: `Підтверженно!`,
    blocks: []
  });
});

slackApp.action('cancel_action', async ({body, action, ack, client}) => {
  await ack();
  const userId = body.user.id;

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
          value: `submit_reason_${userId}`,
          action_id: 'submit_reason'
        }
      ]
    }
  ];

  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: 'Яка причина',
    blocks: messageBlocks
  });
});

slackApp.action('submit_reason', async ({body, action, ack, client}) => {
  await ack();

  const userId = body.user.id;
  const reason = body.state.values['cancel_reason_block']['cancel_reason_input'].value;

  if (reason && reason.length > 0) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Користувач <@${userId}> відмінив за причиною: "${reason}"`,
      blocks: []
    });
  } else {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: userId,
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
