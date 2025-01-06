require('dotenv').config();
// require('./utils/morning');

const amqp = require('amqplib');
const express = require('express');

const sendTelegramNotification = require('./bot-entity/telegram');
const {sendEmail} = require('./bot-entity/gmail');

const app = express();
const port = process.env.PORT || 3000;

const processTelegramMessage = async body => {
  const {chatId, text, markUp} = body.body;

  if (chatId && text && text.length > 0) await sendTelegramNotification(chatId, text, markUp);
};

const processEmailMessage = async body => {
  const {email, subject, message, html, sender} = body.body;
  if (email && email.length > 3 && email.includes('@') && message)
    await sendEmail({
      sender: sender,
      email: email,
      subject: subject,
      message: message,
      html: html
    });
};

const processQueueMessages = async (channel, queue_name) => {
  await channel.consume(queue_name, async msg => {
    try {
      if (msg) {
        const messageContent = JSON.parse(msg.content.toString());
        console.log('got message');
        console.log(messageContent);
        if (queue_name === 'tg_queue') {
          await processTelegramMessage(messageContent);
        } else if (queue_name === 'email_queue') {
          await processEmailMessage(messageContent);
        } else {
          console.log('Unknown queue:', queue_name);
        }

        channel.ack(msg);
      }
    } catch (error) {
      console.error('Error processing RabbitMQ message:', error);
    }
  });
};

const startQueue = async queue_name => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(queue_name, {durable: true});
    console.log(`Waiting for messages in queue: ${queue_name}`);
    processQueueMessages(channel, queue_name);
  } catch (error) {
    console.error('Error in RabbitMQ service:', error);
  }
};

startQueue('email_queue');
startQueue('tg_queue');

app.get('/', (req, res) => {
  res.send('Express server is running');
});

app.listen(port, () => {
  console.log(`Express server is listening on port ${port}`);
});
