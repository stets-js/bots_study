const amqp = require('amqplib');

const sendMessage = async (queueName, type, body) => {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(queueName, {durable: true});

  const message = {
    type: type,
    body
  };

  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
  console.log('Message sent to queue');
  await channel.close();
  await connection.close();
};

module.exports = {sendMessage};
