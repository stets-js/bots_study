const axios = require('axios');
require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const amqp = require('amqplib/callback_api');
const {sendMessage} = require('../utils/sendMessage');
const {generateButton} = require('../utils/slack-blocks/buttons');

const {sendShiftData, getUserStatus} = require('../utils/sendShiftData');
const {generateShiftBlocks} = require('../utils/slack-blocks/shiftBlocks');
const {format} = require('date-fns/format');
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
  const allowedChannelIds = ['C07DM1PERK8', 'C07UADS7U3G', 'C07U2G5J7PH'];
  // test, kwiz, om
  const commandText = command.text;

  await ack();
  const userId = command.user_id;
  let isMemberOfAllowedChannel = false;
  let whosMemeber = '';
  for (const channelId of allowedChannelIds) {
    const result = await client.conversations.members({
      channel: channelId
    });

    if (result.members.includes(userId)) {
      isMemberOfAllowedChannel = true;
      whosMemeber = channelId;
      break;
    }
  }

  if (!isMemberOfAllowedChannel) {
    await sendEphemeralResponse(
      respond,
      'Вибачте, у вас немає доступу до цієї команди, оскільки ви не є учасником відповідного каналу.'
    );
    return;
  }
  const blocks = await generateShiftBlocks({
    body: null,
    userId: command.user_id,
    channelId: whosMemeber
  });

  await respond({
    text: 'Управління зміною',
    blocks,
    response_type: 'ephemeral'
  });
});
const sendShiftMessage = async ({
  body,
  respond,
  status,
  action_status,
  userId,
  errorMessage,
  reportChannelId
}) => {
  if (String(status).startsWith(2)) {
    await respond({
      blocks: await generateShiftBlocks({body, userId, channelId: reportChannelId}),
      response_type: 'ephemeral'
    });
    let message = '';
    const date = new Date();
    const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));
    if (action_status === 'start_shift')
      message = `<@${userId}> *розпочав* зміну о ${format(kievDate, 'HH:mm')}.`;
    else if (action_status === 'start_break')
      message = `<@${userId}> *розпочав* перерву о ${format(kievDate, 'HH:mm')}.`;
    else if (action_status === 'end_break')
      message = `<@${userId}> *завершив* перерву о ${format(kievDate, 'HH:mm')}.`;
    else if (action_status === 'end_shift')
      message = `<@${userId}> *завершив* зміну о ${format(kievDate, 'HH:mm')}.`;

    await sendGroupMessage(reportChannelId, message);
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
  const kwizCheck = await client.conversations.members({
    channel: 'C07UADS7U3G'
  });
  const correctChannelId = kwizCheck.members.includes(body.user.id) ? 'C07UADS7U3G' : 'C07U2G5J7PH';
  const {data} = await getUserStatus(body, null, correctChannelId);
  const {flags} = data;
  if (!flags.canStartShift) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Вибачте, ви вже почали/відпрацювали зміну.'
    });

    console.log(`Зміну не вийшло почати користувачу: ${body.user.id}`);
  } else {
    const res = await sendShiftData(body, correctChannelId, action.action_id);

    sendShiftMessage({
      client,
      body,
      data,
      action_status: action.action_id,
      respond,
      userId: body.user.id,
      status: res.status,
      reportChannelId: correctChannelId,
      errorMessage: 'Помилка початку зміни!'
    });
    console.log(`Зміну розпочав користувач: ${body.user.id}`);
  }
});

slackApp.action('end_shift', async ({action, body, ack, client, respond}) => {
  await ack();
  const kwizCheck = await client.conversations.members({
    channel: 'C07UADS7U3G'
  });
  const correctChannelId = kwizCheck.members.includes(body.user.id) ? 'C07UADS7U3G' : 'C07U2G5J7PH';
  const {data} = await getUserStatus(body, null, correctChannelId);
  const {flags} = data;

  if (flags.isBreakActive) {
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: body.user.id,
      text: 'Вибачте, спочатку треба завершити перерву.'
    });
  } else {
    const res = await sendShiftData(body, correctChannelId, action.action_id);

    sendShiftMessage({
      client,
      body,
      data,
      action_status: action.action_id,
      respond,
      userId: body.user.id,
      status: res.status,
      reportChannelId: correctChannelId,

      errorMessage: 'Помилка завершення зміни!'
    });
  }

  console.log(`Зміну завершив користувач: ${body.user.id}`);
});

slackApp.action('start_break', async ({action, body, ack, client, respond}) => {
  await ack();
  const kwizCheck = await client.conversations.members({
    channel: 'C07UADS7U3G'
  });
  const correctChannelId = kwizCheck.members.includes(body.user.id) ? 'C07UADS7U3G' : 'C07U2G5J7PH';
  const {data} = await getUserStatus(body, null, correctChannelId);
  const {flags} = data;
  if (!flags.canStartBreak) {
    if (flags.isBreakActive) sendEphemeralResponse(respond, 'Вибачте, ви вже на перерві');
    else sendEphemeralResponse(respond, 'Ви ще не починали зміну, щоб почати перерву');
  } else {
    const res = await sendShiftData(body, correctChannelId, action.action_id);

    sendShiftMessage({
      client,
      body,
      action_status: action.action_id,
      data,
      respond,
      userId: body.user.id,
      status: res.status,
      reportChannelId: correctChannelId,

      errorMessage: 'Помилка початку перерви!'
    });
  }

  console.log(`Користувач ${body.user.id} взяв паузу.`);
});

slackApp.action('end_break', async ({action, body, ack, client, respond}) => {
  await ack();
  const kwizCheck = await client.conversations.members({
    channel: 'C07UADS7U3G'
  });
  const correctChannelId = kwizCheck.members.includes(body.user.id) ? 'C07UADS7U3G' : 'C07U2G5J7PH';
  const res = await sendShiftData(body, correctChannelId, action.action_id);

  const userSlackId = body.user.id;

  sendShiftMessage({
    client,
    body,
    respond,
    action_status: action.action_id,
    status: res.status,
    userId: userSlackId,
    reportChannelId: correctChannelId,

    errorMessage: 'Помилка завершення паузи!'
  });

  console.log(`Користувач ${userSlackId} завершив паузу.`);
});

slackApp.action('refresh_shift', async ({action, body, ack, client, respond}) => {
  await ack();
  const kwizCheck = await client.conversations.members({
    channel: 'C07UADS7U3G'
  });
  const correctChannelId = kwizCheck.members.includes(body.user.id) ? 'C07UADS7U3G' : 'C07U2G5J7PH';
  const blocks = await generateShiftBlocks({body, channelId: correctChannelId});
  try {
    await respond({
      blocks: blocks,
      response_type: 'ephemeral'
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
