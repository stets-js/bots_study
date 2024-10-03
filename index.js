require('dotenv').config();
require('./utils/morning');

const amqp = require('amqplib');
const express = require('express');

const sendTelegramNotification = require('./bot-entity/telegram');
const {sendEmail} = require('./bot-entity/gmail');
const {sendDirectMessage, sendGroupMessage} = require('./bot-entity/slack');

const app = express();
const port = process.env.PORT || 3000;

// Назви черг для кожного типу повідомлень
const tgQueueName = 'tg_queue';
const emailQueueName = 'email_queue';
const slackQueueName = 'slack_queue';

const processTelegramMessage = async body => {
  const {chatId, text} = body;
  await sendTelegramNotification(chatId, text);
};

const processEmailMessage = async body => {
  const {email, subject, message, html, sender} = body;
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
    await sendDirectMessage(userName, userId, text);
  } else if (body.type === 'slack_group') {
    const {channelId, text} = body.body;
    await sendGroupMessage(channelId, text);
  } else {
    console.log('Unsupported Slack message type:', type);
  }
};

const start = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Оголошення черг
    await channel.assertQueue(tgQueueName, {durable: true});
    await channel.assertQueue(emailQueueName, {durable: true});
    await channel.assertQueue(slackQueueName, {durable: true});

    console.log(
      `Waiting for messages in queues: ${tgQueueName}, ${emailQueueName}, ${slackQueueName}`
    );

    channel.consume(tgQueueName, async msg => {
      if (msg !== null) {
        const messageContent = JSON.parse(msg.content.toString());
        await processTelegramMessage(messageContent);
        channel.ack(msg);
      }
    });

    channel.consume(emailQueueName, async msg => {
      if (msg !== null) {
        const messageContent = JSON.parse(msg.content.toString());
        await processEmailMessage(messageContent);
        channel.ack(msg);
      }
    });

    channel.consume(slackQueueName, async msg => {
      if (msg !== null) {
        const messageContent = JSON.parse(msg.content.toString());
        console.log(messageContent);
        await processSlackMessage(messageContent);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error in RabbitMQ service:', error);
  }
};

start();

app.get('/', (req, res) => {
  res.send('Service is running');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
