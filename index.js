require("dotenv").config();
const amqp = require("amqplib");
const express = require("express");
const sendTelegramNotification = require("./bot-entity/telegram");
const { sendEmail } = require("./bot-entity/gmail");

const app = express();
const port = process.env.PORT || 3000;

// Gmail Rate Limits
const MAX_EMAILS_PER_MINUTE = 50; // Adjust based on Gmail's limits
const EMAIL_DELAY = 60000 / MAX_EMAILS_PER_MINUTE; // Time in ms between email sends

const processEmailMessage = async (body, channel, msg) => {
  const { email, subject, message, html, sender } = body.body;

  if (email && email.includes("@") && message) {
    try {
      console.log(`Sending email to: ${email}`);
      await sendEmail({ sender, email, subject, message, html });

      setTimeout(() => {
        channel.ack(msg);
      }, EMAIL_DELAY);
    } catch (error) {
      console.error("Failed to send email:", error);

      if (error.code === "EAUTH" || error.responseCode === 454) {
        console.log("Fatal auth error. Dropping message.");
        channel.ack(msg); // НЕ повертай назад в чергу, бо немає сенсу
      } else {
        channel.nack(msg, false, true); // Інші помилки — можна повторити
      }
    }
  } else {
    console.log("Invalid email message:", body);
    channel.ack(msg); // Acknowledge the message to remove it from the queue
  }
};

const processQueueMessages = async (channel, queue_name) => {
  // Limit the number of unacknowledged messages to 1 (ensures sequential processing)
  channel.prefetch(1);

  await channel.consume(queue_name, async (msg) => {
    try {
      if (msg) {
        const messageContent = JSON.parse(msg.content.toString());
        console.log(`Received message from queue: ${queue_name}`);

        if (queue_name === "tg_queue") {
          await sendTelegramNotification(
            messageContent.body.chatId,
            messageContent.body.text,
            messageContent.body.markUp
          );
          channel.ack(msg);
        } else if (queue_name === "email_queue") {
          await processEmailMessage(messageContent, channel, msg);
        } else {
          console.log("Unknown queue:", queue_name);
          channel.ack(msg);
        }
      }
    } catch (error) {
      console.error("Error processing RabbitMQ message:", error);
      channel.nack(msg, false, true); // Requeue the message on failure
    }
  });
};

const startQueue = async (queue_name) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue_name, { durable: true });

    console.log(`Waiting for messages in queue: ${queue_name}`);
    processQueueMessages(channel, queue_name);
  } catch (error) {
    console.error("Error in RabbitMQ service:", error);
  }
};

// Start listening to queues
startQueue("email_queue");
startQueue("tg_queue");

app.get("/", (req, res) => {
  res.send("Express server is running");
});

app.listen(port, () => {
  console.log(`Express server is listening on port ${port}`);
});
