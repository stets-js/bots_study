const axios = require('axios');
require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const amqp = require('amqplib/callback_api');
const {sendMessage} = require('../utils/sendMessage');
const {generateButton} = require('../utils/slack-blocks/buttons');
const {
  generateShiftButtons,
  updateShiftMessage
} = require('../utils/slack-blocks/generateShiftButtons');
const {sendShiftData, getUserStatus} = require('../utils/sendShiftData');
const {generateShiftBlocks} = require('../utils/slack-blocks/shiftBlocks');
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
  try {
    const messageBlocks = [
      ...JSON.parse(blocks),
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

async function sendDirectMessage(userName, userId = null, text, blocks) {
  if (!userId) userId = await getUserIdByName(userName);
  if (!userId) return;

  try {
    const result = await client.conversations.open({users: userId});
    const channelId = result.channel.id;

    await client.chat.postMessage({channel: channelId, text, blocks});
    console.log(`Message sent to ${userId}`);
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
    blocks: updatedBlocks
  });
});
slackApp.action('back_to_confirm', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId, adminId] = action.value.split('_');
  let updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');
  updatedBlocks = updatedBlocks.filter(block => block.type !== 'input');
  updatedBlocks.push({
    type: 'actions',
    elements: [
      generateButton(`confirm_${userId}_${subgroupId}_${userSlackId}_${adminId}`, 'confirm_action'),
      generateButton(
        `cancel_${userId}_${subgroupId}_${userSlackId}_${adminId}`,
        'cancel_action',
        'danger',
        'Відміняю'
      )
    ]
  });
  await client.chat.update({
    channel: body.channel.id,
    ts: body.message.ts,
    text: 'Яка причина?',
    blocks: updatedBlocks
  });
});
slackApp.action('submit_reason', async ({body, action, ack, client}) => {
  await ack();

  const [actionType, userId, subgroupId, userSlackId, adminId] = action.value.split('_');
  const reason = body.state.values['cancel_reason_block']['cancel_reason_input'].value;
  let updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');
  updatedBlocks = updatedBlocks.filter(block => block.type !== 'input');
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
      blocks: updatedBlocks
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
async function checkAuthorization(slackId) {
  try {
    const result = await axios.get(
      `https://dolphin-app-b3fkw.ondigitalocean.app/api/auth/slack?slackId=${slackId}`
    );
    return result.data;
  } catch (error) {
    console.error(`Ошибка при проверке авторизации: ${error.message}`);
    return {isSync: false, user: []};
  }
}
slackApp.command('/sync_booking', async ({command, ack, respond}) => {
  await ack();

  const slackId = command.user_id;
  const {isSync} = await checkAuthorization(slackId);

  if (isSync) {
    await respond({
      text: 'Ви вже синхронізовані!',
      response_type: 'ephemeral'
    });
  } else {
    const bookingUrl = `https://study-booking.netlify.app/?slackId=${slackId}`;
    await respond({
      text: `Треба синхронізуватися: ${bookingUrl}`,
      response_type: 'ephemeral'
    });
  }
});
slackApp.command('/sync_booking_aditional', async ({command, ack, respond}) => {
  await ack();

  const slackId = command.user_id;

  const bookingUrl = `https://study-booking.netlify.app/?aditionalSync=true&slackId=${slackId}`;
  await respond({
    text: `Ось посилання на синхронізацію додаткового аккаунта: ${bookingUrl}`,
    response_type: 'ephemeral'
  });
});
slackApp.command('/sync_booking_list', async ({command, ack, respond}) => {
  await ack();
  const slackId = command.user_id;
  const {user, isSync} = await checkAuthorization(slackId);
  console.log(user);
  if (!isSync) {
    await respond({
      text: `Жодного аккаунта не синхронізовано.`,
      response_type: 'ephemeral'
    });
  } else {
    await respond({
      text: `Синхронізовано аккаунтів: ${user.length}\n ${user
        .map(us => `${us.email} (${us.Role.name})`)
        .join('\n')}`,
      response_type: 'ephemeral'
    });
  }
});

slackApp.command('/shift', async ({command, ack, respond, client}) => {
  const allowedChannelId = 'C07DM1PERK8';

  await ack();
  const userId = command.user_id;

  const result = await client.conversations.members({
    channel: allowedChannelId
  });

  if (!result.members.includes(userId)) {
    await sendEphemeralResponse(
      respond,
      'Вибачте, у вас немає доступу до цієї команди, оскільки ви не є учасником відповідного каналу.'
    );
    return;
  }
  const {data} = await getUserStatus(null, command.user_id, command.channel_id);
  const {flags, statistics} = data;

  const blocks = generateShiftBlocks({statistics, flags});

  await respond({
    text: 'Управління зміною',
    blocks,
    response_type: 'ephemeral'
  });
});
const sendShiftMessage = async (
  client,
  body,
  data,
  respond,
  status,
  successMessage,
  errorMessage
) => {
  console.log(body);
  console.log(body.message);
  if (String(status).startsWith(2)) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.container.message_ts,
      blocks: generateShiftBlocks(data)
    });
  } else {
    await respond({
      text: errorMessage,
      response_type: 'ephemeral'
    });
  }
};

const sendEphemeralResponse = async (respond, text) => {
  await respond({
    text,
    response_type: 'ephemeral'
  });
};

slackApp.action('start_shift', async ({action, body, ack, client, respond}) => {
  await ack();
  const {data} = await getUserStatus(body);
  const {flags} = data;
  if (!flags.canStartShift) {
    sendEphemeralResponse(respond, 'Вибачте, ви вже почали зміну');
    console.log(`Зміну не вийшло почати користувачу: ${body.user.id}`);
  } else {
    const res = await sendShiftData(body, action.action_id);

    sendShiftMessage(
      client,
      body,
      data,
      respond,
      res.status,
      'Зміну завершено!',
      'Помилка завершення зміни!'
    );
    console.log(`Зміну розпочав користувач: ${body.user.id}`);
  }
});

slackApp.action('end_shift', async ({action, body, ack, client, respond}) => {
  await ack();
  const {data} = await getUserStatus(body);
  const {flags} = data;
  if (!flags.canEndShift) {
    if (flags.canEndBreak) {
      sendEphemeralResponse(respond, 'Вибачте, спочатку треба завершити перерву.');
    } else {
      sendEphemeralResponse(respond, 'Вибачте, ви вже закінчили або ще не розпочинали');
    }
  } else {
    const res = await sendShiftData(body, action.action_id);

    sendShiftMessage(
      client,
      body,
      data,
      respond,
      res.status,
      'Зміну завершено!',
      'Помилка завершення зміни!'
    );
  }

  console.log(`Зміну завершив користувач: ${body.user.id}`);
});

slackApp.action('start_break', async ({action, body, ack, client, respond}) => {
  await ack();
  const {data} = await getUserStatus(body);
  const {flags} = data;
  if (!flags.canStartBreak) {
    if (flags.isBreakActive) sendEphemeralResponse(respond, 'Вибачте, ви вже на перерві');
    else sendEphemeralResponse(respond, 'Ви ще не починали зміну, щоб почати перерву');
  } else {
    const res = await sendShiftData(body, action.action_id);
    sendShiftMessage(
      client,
      body,
      data,
      respond,
      res.status,
      'Перерва розпочата!',
      'Помилка початку перерви!'
    );
  }

  console.log(`Користувач ${body.user.id} взяв паузу.`);
});

slackApp.action('end_break', async ({action, body, ack, client, respond}) => {
  await ack();
  const {data} = await getUserStatus(body);
  const {flags} = data;
  if (!flags.canEndBreak) {
    sendEphemeralResponse(respond, 'Ви ще не починали перерву, щоб її закінчити');
  } else {
    const res = await sendShiftData(body, action.action_id);
    const userSlackId = body.user.id;

    sendShiftMessage(
      client,
      body,
      data,
      respond,
      res.status,
      'Пауза завершена!',
      'Помилка завершення паузи!'
    );

    console.log(`Користувач ${userSlackId} завершив паузу.`);
  }
});

slackApp.action('refresh_shift', async ({action, body, ack, client, respond}) => {
  await ack();

  const {data} = await getUserStatus(body);
  const {statistics, flags} = data;
  const blocks = generateShiftBlocks({statistics, flags});
  console.log(body);
  try {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      blocks: blocks,
      text: 'Updated Shift Information'
    });
  } catch (error) {
    console.error('Error updating message:', error);
    await respond({
      text: 'There was an error refreshing the shift information.',
      response_type: 'ephemeral'
    });
  }
});

module.exports = {
  slackApp,
  sendDirectMessage,
  sendGroupMessage,
  sendConfirmationMessage
};
