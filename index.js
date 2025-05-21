require("dotenv").config();
const cron = require("node-cron");
const axios = require("axios");
const amqp = require("amqplib");
const express = require("express");
const { createEventAdapter } = require("@slack/events-api");

const {
  sendDirectMessage,
  sendGroupMessage,
  sendConfirmationMessage,
  slackApp,
} = require("./bot-entity/slack");

const app = express();
const port = process.env.PORT || 3000;
const queue_name = process.env.QUEUE_NAME;

const processSlackMessage = async (body) => {
  const { type } = body;
  console.log(body);
  if (type === "slack_direct") {
    const { userName, userId, text, blocks } = body.body;
    if (
      text &&
      ((userName && userName.length > 0) || userId) &&
      text.length > 0
    )
      await sendDirectMessage(userName, userId, text, blocks);
  } else if (type === "slack_group") {
    const { channelId, text } = body.body;
    if (channelId && text) await sendGroupMessage(channelId, text);
  } else if (type === "slack_group_confirm_subgroup") {
    const { text, blocks, subgroupId, userId, userSlackId, adminId, isMic } =
      body.body;
    await sendConfirmationMessage(
      blocks,
      subgroupId,
      userId,
      userSlackId,
      text,
      adminId,
      isMic
    );
  } else {
    console.log("Unsupported Slack message type:", type);
  }
};

const processQueueMessages = async () => {
  let connection, channel;

  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(queue_name, { durable: true });
    console.log(`Waiting for messages in queue: ${queue_name}`);

    const msg = await channel.get(queue_name, { noAck: false });

    if (msg) {
      const messageContent = JSON.parse(msg.content.toString());

      if (queue_name === "slack_queue") {
        await processSlackMessage(messageContent);
      } else {
        console.log("Unknown queue:", queue_name);
      }

      channel.ack(msg);
    } else {
      console.log("Черга пуста, перевірю через 5 секунд.");
    }
  } catch (error) {
    console.error("Error processing RabbitMQ message:", error);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
};

const checkServers = async () => {
  if (queue_name === "slack_queue") {
    try {
      // axios.get('https://bots-gmail.onrender.com/');
      // axios.get('https://bots-rzka.onrender.com/');
    } catch (error) {
      console.log("error fetching");
      console.log(error);
    }
    console.log("send");
  }
  return;
};

// --- Нова cron-задача ---
cron.schedule("0 9 * * *", async () => {
  try {
    console.log("⏰ Щоденна задача: нагадування про закінчення підгруп");

    const response = await axios.get(
      "https://dolphin-app-b3fkw.ondigitalocean.app/api/subgroups/remind_about_ending_subgroup"
    );

    if (
      response.data.status === "success" &&
      Array.isArray(response.data.data)
    ) {
      const subgroups = response.data.data;

      for (const subgroup of subgroups) {
        const courseName = subgroup.courseName;
        const mentors = subgroup.mentors;

        if (mentors.length === 0) {
          console.log(
            `Підгрупа "${courseName}" не має наставників з slackId, пропускаємо.`
          );
          continue;
        }

        for (const mentor of mentors) {
          if (!mentor.slackId) {
            console.log(
              `Наставник ${mentor.firstName} ${mentor.lastName} не має slackId, пропускаємо.`
            );
            continue;
          }

          const body = {
            userName: `${mentor.firstName} ${mentor.lastName}`,
            userId: mentor.slackId,
            text: `Привіт, ${
              mentor.firstName
            }! Нагадуємо, що підгрупа "${courseName}" завершується скоро (${new Date(
              subgroup.endDate
            ).toLocaleDateString()}). Перевір чи все до цього готово! Якщо з'являться питання - пиши в бот!`,
            blocks: null,
          };

          await sendMessage(queue_name, "slack_direct", body);
          console.log(
            `Відправлено повідомлення для наставника ${mentor.firstName} ${mentor.lastName}`
          );
        }
      }
    } else {
      console.log("Немає підгруп для нагадування або помилка у відповіді API.");
    }
  } catch (err) {
    console.error("❌ Помилка при виконанні щоденної задачі:", err.message);
  }
});
// --- Кінець нової cron-задачі ---

const start = async () => {
  setInterval(async () => {
    await processQueueMessages();
    await checkServers();
  }, 5000);
};

start();

if (queue_name === "slack_queue") {
  (async () => {
    await slackApp.start(port);
    require("./bot-entity/homePage");
    console.log(`⚡️ Slack Bolt app is running on port ${port}`);
  })();
} else {
  app.get("/", (req, res) => {
    res.send("Express server is running");
  });

  app.listen(port, () => {
    console.log(`Express server is listening on port ${port}`);
  });
}
