require('dotenv').config();
require('./utils/morning');
const axios = require('axios');
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
  console.log(body);
  if (body.type === 'slack_direct') {
    const {userName, userId, text} = body.body;
    if (text && ((userName && userName.length > 0) || userId) && text.length > 0)
      await sendDirectMessage(userName, userId, text);
  } else if (body.type === 'slack_group') {
    const {channelId, text} = body.body;
    if (channelId && text) await sendGroupMessage(channelId, text);
  } else if (body.type === 'slack_group_confirm_subgroup') {
    const {text, blocks, subgroupId, userId, userSlackId, channelId, adminId} = body.body;
    await sendConfirmationMessage(
      channelId,
      blocks,
      subgroupId,
      userId,
      userSlackId,
      text,
      adminId
    );
  } else {
    console.log('Unsupported Slack message type:', type);
  }
};

const processQueueMessages = async () => {
  let connection, channel;

  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(queue_name, {durable: true});
    console.log(`Waiting for messages in queue: ${queue_name}`);

    const msg = await channel.get(queue_name, {noAck: false});

    if (msg) {
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
    } else {
      console.log('Черга пуста, перевірю через 5 секунд.');
    }
  } catch (error) {
    console.error('Error processing RabbitMQ message:', error);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
};

const checkServers = async () => {
  if (queue_name === 'slack_queue') {
    axios.get('https://bots-gmail.onrender.com/');
    axios.get('https://bots-rzka.onrender.com/');
    console.log('send');
  }
  return;
};

const start = async () => {
  setInterval(async () => {
    await processQueueMessages();
    await checkServers();
  }, 5000);
};

start();

if (queue_name === 'slack_queue') {
  (async () => {
    await slackApp.start(port);
    console.log(`⚡️ Slack Bolt app is running on port ${port}`);
  })();
} else {
  app.get('/', (req, res) => {
    res.send('Express server is running');
  });

  app.listen(port, () => {
    console.log(`Express server is listening on port ${port}`);
  });
}
