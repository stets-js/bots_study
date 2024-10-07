require('dotenv').config();
require('./utils/morning');

const amqp = require('amqplib');
const express = require('express');
const {createEventAdapter} = require('@slack/events-api');
const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET);

const sendTelegramNotification = require('./bot-entity/telegram');
const {sendEmail} = require('./bot-entity/gmail');
const {
  sendDirectMessage,
  sendGroupMessage,
  sendConfirmationMessage,
  slackApp
} = require('./bot-entity/slack');

const app = express();
const port = process.env.PORT || 3000;
const queue_name = process.env.QUEUE_NAME;

const processTelegramMessage = async body => {
  const {chatId, text} = body;
  if (chatId && text && text.length > 0) await sendTelegramNotification(chatId, text);
};

const processEmailMessage = async body => {
  const {email, subject, message, html, sender} = body;
  if (email && message)
    await sendEmail({
      sender: sender,
      email: email,
      subject: subject,
      message: message,
      html: html
    });
};

const processSlackMessage = async body => {
  const {type, ...rest} = body;

  if (body.type === 'slack_direct') {
    const {userName, userId, text} = body.body;
    if (userName && text && userName.length > 0 && text.length > 0)
      await sendDirectMessage(userName, userId, text);
  } else if (body.type === 'slack_group') {
    const {channelId, text} = body.body;
    if (channelId && text) await sendGroupMessage(channelId, text);
  } else if (body.type === 'slack_group_confirm_subgroup') {
    const {text, subgroupId, userId, channelId} = body.body;
    await sendConfirmationMessage(channelId, subgroupId, userId, text);
  } else {
    console.log('Unsupported Slack message type:', type);
  }
};

const start = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Ожидание сообщений из указанной очереди
    await channel.assertQueue(queue_name, {durable: true});

    console.log(`Waiting for messages in queue: ${queue_name}`);

    channel.consume(queue_name, async msg => {
      if (msg !== null) {
        const messageContent = JSON.parse(msg.content.toString());

        if (queue_name === 'tg_queue') {
          await processTelegramMessage(messageContent);
        } else if (queue_name === 'email_queue') {
          await processEmailMessage(messageContent);
        } else if (queue_name === 'slack_queue') {
          await processSlackMessage(messageContent);
        } else {
          console.log('Unknown queue:', queue_name);
        }

        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error in RabbitMQ service:', error);
  }
};

start();

if (queue_name === 'slack_queue') {
  (async () => {
    await slackApp.start(port);
    console.log(`⚡️ Slack Bolt app is running on port ${port}`);

    // Slack event handler
    slackApp.event('message', async ({event, say}) => {
      await say(`Hello, <@${event.user}>!`);
    });
  })();
} else {
  // Start Express server for other queues
  const app = express();

  app.get('/', (req, res) => {
    res.send('Express server is running');
  });

  app.listen(port, () => {
    console.log(`Express server is listening on port ${port}`);
  });
}
