require('dotenv').config();
const {App} = require('@slack/bolt');
const {WebClient} = require('@slack/web-api');
const {sendMessage} = require('../utils/sendMessage');
const {generateButton} = require('../utils/slack-blocks/buttons');
const jwt = require('jsonwebtoken');
const {sendShiftData, getUserStatus, generateSpreadsheet} = require('../utils/sendShiftData');
const {
  generateShiftBlocks,
  generateShiftStatsController
} = require('../utils/slack-blocks/shiftBlocks');
const {format} = require('date-fns/format');
const userInSelectedChannel = require('../utils/getCorrectChannelId');

const {checkAuthorization, sendStatusUpdate, getCancelReason} = require('../utils/axios');
const {generateSelector} = require('../utils/slack-blocks/generateShiftButtons');

// Create Slack slackApp instance
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
async function sendConfirmationMessage(
  blocks,
  subgroupId,
  userId,
  userSlackId,
  text,
  adminId,
  status
) {
  try {
    const messageBlocks = [
      ...JSON.parse(blocks),
      {
        type: 'actions',
        block_id: 'actionsData',
        elements: [
          generateButton(
            `confirm_${userId}_${subgroupId}_${userSlackId}_${adminId}_${status}`,
            'confirm_action'
          ),
          generateButton(
            `cancel_${userId}_${subgroupId}_${userSlackId}_${adminId}_${status}`,
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

async function sendGroupMessage(channelId, text = '', blocks = undefined) {
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
  const stateValues = body.state.values;
  console.log(stateValues, 'state values');
  const [actionType, userId, subgroupId, userSlackId, adminId, isMic] = action.value.split('_');
  const updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');

  try {
    const token = jwt.sign({isSlack: true, slackId: body.user.id}, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
    await sendStatusUpdate(token, {
      subgroupId,
      userSlackId,
      userId,
      mentorId: userId,
      adminId,
      status: isMic ? 'mic_approved' : 'approved'
    });

    updatedBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Підтверджено* ✅'
      }
    });
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: body.message.text,
      blocks: updatedBlocks
    });
    console.log(`Subgroup ${subgroupId} confirmed by user ${userId}.`);
  } catch (error) {
    console.log(error);
    console.error(`Error updating confirmation message: ${error.message}`);
  }
});

slackApp.action('cancel_action', async ({body, action, ack, client}) => {
  await ack();
  const {data: options} = await getCancelReason();

  const [actionType, userId, subgroupId, userSlackId, adminId, isMic] = action.value.split('_');
  const updatedBlocks = body.message.blocks.filter(block => block.type !== 'actions');

  updatedBlocks.push(
    {
      type: 'section',
      block_id: 'cancel_reason_block',
      text: {
        type: 'mrkdwn',
        text: 'Оберіть причину скасування:'
      },
      accessory: generateSelector({
        name: 'Оберіть причину',
        action_id: 'cancel_reason_select',
        block_id: 'cancel_reason_block',
        options: options.map(el => ({text: el.text, value: el.id})),
        placeholder: 'Виберіть причину...'
      })
    },
    {
      type: 'actions',
      elements: [
        generateButton(
          `submitReason_${userId}_${subgroupId}_${userSlackId}_${adminId}_${isMic}`,
          'submit_reason',
          'danger',
          'Зберегти'
        ),
        generateButton(
          `backToConfirm_${userId}_${subgroupId}_${userSlackId}_${adminId}_${isMic}`,
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

  const [actionType, userId, subgroupId, userSlackId, adminId, isMic] = action.value.split('_');
  deepLog(body.message.blocks);
  let updatedBlocks = body.message.blocks.filter(
    block => block?.block_id !== 'cancel_reason_block'
  );
  updatedBlocks = updatedBlocks.filter(block => block.type !== 'actions');

  // updatedBlocks = updatedBlocks.filter(block => block.type !== 'input');
  updatedBlocks.push({
    type: 'actions',
    elements: [
      generateButton(
        `confirm_${userId}_${subgroupId}_${userSlackId}_${adminId}_${isMic}`,
        'confirm_action'
      ),
      generateButton(
        `cancel_${userId}_${subgroupId}_${userSlackId}_${adminId}_${isMic}`,
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
  try {
    const selectedOption =
      body.state.values.cancel_reason_block.cancel_reason_select.selected_option;
    const [actionType, userId, subgroupId, userSlackId, adminId, isMic] = action.value.split('_');

    let updatedBlocks = body.message.blocks.filter(
      block => block?.block_id !== 'cancel_reason_block'
    );
    updatedBlocks = updatedBlocks.filter(block => block.type !== 'actions');

    if (selectedOption && selectedOption.value) {
      updatedBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Ви відмінили підгрупу за причиною:\n "${selectedOption?.text?.text}".`
        }
      });

      console.log('creating token');
      const token = jwt.sign({isSlack: true, slackId: body.user.id}, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });

      await sendStatusUpdate(token, {
        subgroupId,
        userSlackId,
        mentorId: userId,
        userId,
        adminId,
        status: isMic ? 'mic_rejected' : 'rejected',
        cancelReasonId: +selectedOption?.value
      });
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: `Користувач <@${userSlackId}> відмінив за причиною: "${selectedOption?.text?.text}". Підгрупа: ${subgroupId}`,
        blocks: updatedBlocks
      });
    } else {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userSlackId,
        text: 'Яка причина.'
      });
    }
  } catch (error) {
    console.log(error);
  }
});

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
  const allowedChannelIds = ['C07DM1PERK8', 'C07UADS7U3G', 'C07U2G5J7PH', 'C083PKS3L0M'];

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
  if (!blocks) {
    await sendEphemeralResponse(respond, 'Вибачте, щось пішло не так.');
  }
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
  selectedShiftType,
  shiftNumber,
  action_status,
  userId,
  errorMessage,
  reportChannelId,
  data = null
}) => {
  if (String(status).startsWith(2)) {
    const blocks = await generateShiftBlocks({
      body,
      userId,
      selectedShiftType,
      shiftNumber,
      data,
      channelId: reportChannelId
    });
    if (!blocks) {
      return await sendEphemeralResponse(
        respond,
        'Щось не підвантажелось до контроллера :(. Спробуйте використати /shift ще раз.'
      );
    }
    await respond({
      blocks,
      response_type: 'ephemeral'
    });
    let message = '';
    const date = new Date();
    const kievDate = new Date(date.toLocaleString('en-US', {timeZone: 'Europe/Kiev'}));
    if (action_status === 'start_shift')
      message = `<@${userId}> *розпочав(ла) зміну* о ${format(kievDate, 'HH:mm')}.`;
    else if (action_status === 'start_break')
      message = `<@${userId}> *розпочав(ла) перерву* о ${format(kievDate, 'HH:mm')}.`;
    else if (action_status === 'end_break')
      message = `<@${userId}> *завершив(ла) перерву* о ${format(kievDate, 'HH:mm')}.`;
    else if (action_status === 'end_shift')
      message = `<@${userId}> *завершив(ла) зміну* о ${format(kievDate, 'HH:mm')}.`;

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

slackApp.action('shift_type_selector', async ({ack, respond, action, body, client}) => {
  await ack();

  // const selectedShiftType = action.selected_option.value;

  // console.log(action);
  // const blocks = await generateShiftBlocks({
  //   body: null,
  //   userId: body.user.id,
  //   channelId: body.channel.id,
  //   selectedShiftType
  // });
  // console.log(blocks);
  // await respond({text: 'Оновлено зміну', response_type: 'ephemeral', blocks: blocks});
});

slackApp.action(/start_shift/, async ({action, body, ack, client, respond}) => {
  await ack();
  const stateValues = body.state.values;

  const selectedShiftType = stateValues?.stats?.shift_type_selector?.selected_option?.value;
  console.log(selectedShiftType);
  const [status, notUsingIt, shiftNumber] = action.action_id.split('@');
  console.log(action.action_id, body.user.id, selectedShiftType);
  console.log('start shift, ', action.action_id);

  if (!selectedShiftType)
    return sendEphemeralResponse(respond, 'Ви не обрали тип зміни, використайте ще раз /shift.');

  const {channelId, isMember} = await userInSelectedChannel(
    selectedShiftType,
    body.user.id,
    client
  );
  if (!isMember) {
    return sendEphemeralResponse(respond, 'Ви не належите до цієї групи. ');
  }

  const {data} = await getUserStatus(body, null, channelId, 0, selectedShiftType);
  const {flags, statistics} = data;

  if (!flags.canStartShift) {
    return sendEphemeralResponse(respond, 'Вибачте, ви вже почали зміну.');
  } else {
    const res = await sendShiftData({
      body,
      channelId,
      status,
      selectedShiftType,
      shiftNumber: statistics.lastShiftNumber
    });
    console.log(res.data);
    sendShiftMessage({
      client,
      body,
      data,
      selectedShiftType,
      shiftNumber: res.data.data.shiftNumber,
      action_status: status,
      respond,
      userId: body.user.id,
      status: res.status,
      reportChannelId: channelId,
      errorMessage: 'Помилка початку зміни!'
    });
    console.log(`Зміну розпочав користувач: ${body.user.id}`);
  }
});

slackApp.action(/end_shift/, async ({action, body, ack, client, respond}) => {
  await ack();
  const [status, selectedShiftType, shiftNumber] = action.action_id.split('@');
  console.log('end shift, ', action.action_id);
  if (!selectedShiftType || !shiftNumber)
    return sendEphemeralResponse(
      respond,
      'Щось не підвантажелось до контроллера :(. Спробуйте використати /shift ще раз.'
    );
  const {channelId, isMember} = await userInSelectedChannel(
    selectedShiftType,
    body.user.id,
    client
  );
  if (!isMember) {
    return sendEphemeralResponse(respond, 'Ви не належите до цієї групи.');
  }
  const {data} = await getUserStatus(body, null, channelId, shiftNumber, selectedShiftType);
  const {flags, statistics} = data;

  if (flags.isBreakActive) {
    await postEphemeral(respond, 'Вибачте, спочатку треба завершити перерву.');
  } else {
    const res = await sendShiftData({
      body,
      channelId,
      status,
      selectedShiftType,
      shiftNumber
    });

    sendShiftMessage({
      client,
      body,
      data,
      selectedShiftType,
      shiftNumber,
      action_status: status,
      respond,
      userId: body.user.id,
      status: res.status,
      reportChannelId: channelId,

      errorMessage: 'Помилка завершення зміни!'
    });
  }

  console.log(`Зміну завершив користувач: ${body.user.id}`);
});

slackApp.action(/start_break/, async ({action, body, ack, client, respond}) => {
  await ack();
  const [status, selectedShiftType, shiftNumber] = action.action_id.split('@');
  console.log('start break, ', action.action_id);
  if (!selectedShiftType || !shiftNumber)
    return sendEphemeralResponse(
      respond,
      'Щось не підвантажелось до контроллера :(. Спробуйте використати /shift ще раз.'
    );
  const {channelId, isMember} = await userInSelectedChannel(
    selectedShiftType,
    body.user.id,
    client
  );
  if (!isMember) {
    return sendEphemeralResponse(respond, 'Ви не належите до цієї групи.');
  }
  const {data} = await getUserStatus(body, null, channelId, shiftNumber, selectedShiftType);

  const {flags, statistics} = data;

  if (!flags.canStartBreak) {
    if (flags.isBreakActive) sendEphemeralResponse(respond, 'Вибачте, ви вже на перерві');
    else sendEphemeralResponse(respond, 'Ви ще не починали зміну, щоб почати перерву');
  } else {
    const res = await sendShiftData({body, channelId, status, selectedShiftType, shiftNumber});

    sendShiftMessage({
      client,
      body,
      selectedShiftType,
      shiftNumber: shiftNumber,
      action_status: status,
      data,
      respond,
      userId: body.user.id,
      status: res.status,
      reportChannelId: channelId,

      errorMessage: 'Помилка початку перерви!'
    });
  }

  console.log(`Користувач ${body.user.id} взяв паузу.`);
});

slackApp.action(/end_break/, async ({action, body, ack, client, respond}) => {
  await ack();
  console.log('end break, ', action.action_id);
  const [status, selectedShiftType, shiftNumber] = action.action_id.split('@');
  if (!selectedShiftType || !shiftNumber)
    return sendEphemeralResponse(
      respond,
      'Щось не підвантажелось до контроллера :(. Спробуйте використати /shift ще раз.'
    );
  const {channelId, isMember} = await userInSelectedChannel(
    selectedShiftType,
    body.user.id,
    client
  );
  if (!isMember) {
    return sendEphemeralResponse(respond, 'Ви не належите до цієї групи.');
  }
  const {data} = await getUserStatus(body, null, channelId, shiftNumber, selectedShiftType);

  const {flags, statistics} = data;

  const res = await sendShiftData({
    body,
    channelId: channelId,
    status,
    selectedShiftType,
    shiftNumber: shiftNumber
  });

  const userSlackId = body.user.id;

  sendShiftMessage({
    client,
    body,
    respond,
    data,
    selectedShiftType,
    shiftNumber: shiftNumber,
    action_status: status,
    status: res.status,
    userId: userSlackId,
    reportChannelId: channelId,

    errorMessage: 'Помилка завершення паузи!'
  });

  console.log(`Користувач ${userSlackId} завершив паузу.`);
});

slackApp.action(/refresh_shift/, async ({action, body, ack, client, respond}) => {
  await ack();
  const [status, selectedShiftType, shiftNumber] = action.action_id.split('@');

  console.log('refresh, ', action.action_id);
  if (!selectedShiftType || !shiftNumber)
    return sendEphemeralResponse(
      respond,
      'Щось не підвантажелось до контроллера :(. Спробуйте використати /shift ще раз.'
    );
  const {channelId, isMember} = await userInSelectedChannel(
    selectedShiftType,
    body.user.id,
    client
  );
  if (!isMember) {
    return sendEphemeralResponse(respond, 'Ви не належите до цієї групи.');
  }
  const blocks = await generateShiftBlocks({body, channelId, selectedShiftType, shiftNumber});
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
slackApp.command('/shift-stats', async ({command, ack, respond, client}) => {
  const allowedUsers = ['U05AACXUW9X', 'U059NEZSZQF', 'U07DTKVFV2N', 'U058MSTENLX', 'U05AT31TMUL'];

  await ack();

  const userId = command.user_id;
  let isAllowed = allowedUsers.includes(userId);

  if (!isAllowed) {
    return await sendEphemeralResponse(respond, 'Вибачте, у вас немає доступу до цієї команди.');
  }

  const blocks = await generateShiftStatsController({});

  await respond({
    text: 'Управління зміною',
    blocks,
    response_type: 'ephemeral'
  });
});

slackApp.action('spreadsheet_type_selector', async ({action, ack, body, respond}) => {
  await ack();
});

slackApp.action('start_date', async ({action, ack, body, respond}) => {
  await ack();
});
slackApp.action('end_date', async ({action, ack, body, respond}) => {
  await ack();
});

slackApp.action('generate_spreadsheet', async ({action, ack, body, client, respond}) => {
  await ack();
  const stateValues = body.state.values;
  const selectedShiftType = stateValues.stats.spreadsheet_type_selector.selected_option.value;

  const startDate = stateValues.stats.start_date.selected_date;

  const endDate = stateValues.stats.end_date.selected_date;

  if (!selectedShiftType || !startDate || !endDate) {
    return sendEphemeralResponse(respond, 'Не всі поля були обрані');
  }
  const channelId =
    selectedShiftType === 'kwiz'
      ? 'C07UADS7U3G'
      : selectedShiftType === 'om'
      ? 'C07U2G5J7PH'
      : selectedShiftType === 'sup'
      ? 'C083PKS3L0M'
      : '';
  const channel = await client.conversations.members({channel: channelId});

  const members = channel.members;
  const detailedMembers = [];

  for (const memberId of members) {
    const userInfo = await client.users.info({user: memberId});
    detailedMembers.push({
      id: memberId,
      name: userInfo.user.real_name || userInfo.user.name
    });
  }

  const res = await generateSpreadsheet(selectedShiftType, startDate, endDate, detailedMembers);
  console.log(res);
  if (res)
    return await sendEphemeralResponse(
      respond,
      `<https://docs.google.com/spreadsheets/d/1RoL9gDXxu7Z6s0Kc5wT8U3HsI5g9nXyv6LCx0RM9dEQ/edit?usp=sharing|Звіт згенеровано> успішно для ${selectedShiftType} з ${startDate} по ${endDate}.`
    );
  else return await sendEphemeralResponse(respond, 'Щось пішло не так :(');
});

slackApp.command('/select', async ({command, ack, respond}) => {
  await ack(); // Підтвердження команди c
  const {data: options} = await getCancelReason();
  console.log(options);
  await respond({
    text: 'Оберіть причину:',
    blocks: [
      {
        type: 'section',
        block_id: 'cancel_reason_block',
        text: {
          type: 'mrkdwn',
          text: 'Оберіть причину скасування:'
        },
        accessory: generateSelector({
          name: 'Оберіть причину',
          action_id: 'cancel_reason_select',
          block_id: 'cancel_reason_block',
          options: options.map(el => ({text: el.text, value: el.id})),
          placeholder: 'Виберіть причину...'
        })
      }
    ]
  });
});

slackApp.action('cancel_reason_select', async ({body, ack, respond}) => {
  await ack(); // Підтверджуємо дію
  deepLog(body.actions);
  const selectedReason = body.actions[0].selected_option.value;

  // await respond(`Ви вибрали: *${selectedReason}*`);
});

function deepLog(obj, indent = 0) {
  const spacing = ' '.repeat(indent * 2);

  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      console.log(`${spacing}[`);
      obj.forEach((item, index) => {
        process.stdout.write(`${spacing}  [${index}] `);
        deepLog(item, indent + 1);
      });
      console.log(`${spacing}]`);
    } else {
      console.log(`${spacing}{`);
      Object.entries(obj).forEach(([key, value]) => {
        process.stdout.write(`${spacing}  "${key}": `);
        deepLog(value, indent + 1);
      });
      console.log(`${spacing}}`);
    }
  } else {
    console.log(`${spacing}${JSON.stringify(obj)}`);
  }
}

slackApp.event('app_home_opened', async ({event, client}) => {
  console.log('trying to do');
  try {
    await client.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '👋 Привіт, радий бачити тебе. Для синхронізації використай кнопку нижче. Синхронізований аккаунт дозволяє отримувати повідомлення про призначення потоків, оцінку ВКЯ та інші'
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🔗 Синхронізуватися'
                },
                action_id: 'sync_account'
              }
            ]
          }
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка загрузки App Home:', error);
  }
});

module.exports = {
  slackApp,
  sendDirectMessage,
  sendGroupMessage,
  sendConfirmationMessage
};
