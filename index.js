require('dotenv').config();
require('./utils/morning');

const amqp = require('amqplib');
const express = require('express');

const sendTelegramNotification = require('./bot-entity/telegram');

const app = express();
const port = process.env.PORT || 3000;

const queueName = 'message_queue';

const processMessage = async message => {
  const {type, body} = message;

  if (type === 'tg') {
    const {chatId, text} = body;
    await sendTelegramNotification(chatId, text);
  } else {
    console.log('Unsupported message type:', type);
  }
};

const start = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName, {durable: true});

    console.log(`Waiting for messages in queue: ${queueName}`);

    channel.consume(queueName, async msg => {
      if (msg !== null) {
        const messageContent = JSON.parse(msg.content.toString());
        await processMessage(messageContent);
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
