require("dotenv").config();
const cron = require("node-cron");
const axios = require("axios");
const amqp = require("amqplib");
const express = require("express");
const { createEventAdapter } = require("@slack/events-api");
const { exportTechShiftsToGoogleSheet } = require("./utils/automatic_stats");
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

const sendToQueue = async (queue, message) => {
  let connection, channel;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    console.log(`Message sent to queue ${queue}`);
  } catch (error) {
    console.error("Error sending message to queue:", error);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
};

const teacherBirthdayReminder = async () => {
  console.log("🎂 Перевіряємо, чи в когось завтра день народження");

  try {
    const response = await axios.get(
      "https://erp-back-qwro9.ondigitalocean.app/api/get_users_birthday"
    );

    if (!Array.isArray(response.data)) {
      console.log("⚠️ Некоректний формат відповіді: очікувався масив");
      return;
    }

    for (const teacher of response.data) {
      const { first_name, last_name, birthday, team_lead_slack_id } = teacher;

      if (!team_lead_slack_id) {
        console.log(
          `⛔️ Пропущено: немає Slack ID тімліда для ${first_name} ${last_name}`
        );
        continue;
      }

      const formattedBirthday = new Date(birthday).toLocaleDateString("uk-UA");

      const message = {
        type: "slack_direct",
        body: {
          userName: "",
          userId: team_lead_slack_id,
          text: `👋 Привіт!\nНагадуємо, що в одного з викладачів твоєї команди скоро день народження 🥳\n\n🎉 Ім'я викладача: ${last_name} ${first_name}\n📅 Дата народження: ${formattedBirthday}\n\nМожна підготувати вітання, приємний меседж або маленький сюрприз 🎁\nЯкщо потрібна допомога — дай знати 💛`,
          blocks: null,
        },
      };

      await sendToQueue("slack_queue", message);
      console.log(
        `✅ Повідомлення надіслано тімліду (${team_lead_slack_id}) про ${first_name} ${last_name}`
      );
    }
  } catch (error) {
    if (
      error.response &&
      error.response.status === 404 &&
      error.response.data &&
      error.response.data.message
    ) {
      console.log(`ℹ️ ${error.response.data.message}`);
      return;
    }

    console.error(
      "❌ Помилка під час нагадування про ДН викладачів:",
      error.message
    );
  }
};

const runDailyReminder = async () => {
  console.log("⏰ Щоденна задача: нагадування про закінчення підгруп");

  try {
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

        if (!mentors.length) {
          console.log(`Підгрупа "${courseName}" не має наставників.`);
          continue;
        }

        for (const mentor of mentors) {
          if (!mentor.slackId) continue;

          const message = {
            type: "slack_direct",
            body: {
              userName: `${mentor.firstName} ${mentor.lastName}`,
              userId: mentor.slackId,
              // text: `Привіт, ${
              //   mentor.firstName
              // }! Нагадуємо, що підгрупа "${courseName}" завершується скоро (${new Date(
              //   subgroup.endDate
              // ).toLocaleDateString()}). Перевір чи все до цього готово!`,
              text: `Привіт! Нагадуємо, що ваша група підходить до завершення — залишилося 30 днів, останнє заняття заплановане на (${new Date(
                subgroup.endDate
              ).toLocaleDateString()}) \n Це гарний момент, щоб: \n — спланувати фінальні уроки та захист проєкту \n — підбити результати і підготувати зворотний зв’язок \n — при потребі — звернутись до ТЛ \n Якщо є питання чи щось не вкладається — напиши, ми поруч ✨`,
              blocks: null,
            },
          };

          await sendToQueue("slack_queue", message);
          console.log(
            `✅ Повідомлення надіслано ${mentor.firstName} ${mentor.lastName}`
          );
        }
      }
    } else {
      console.log("Немає підгруп для обробки або відповідь порожня.");
    }
  } catch (err) {
    console.error("❌ Помилка в щоденній задачі:", err.message);
  }
};

const start = async () => {
  setInterval(async () => {
    await processQueueMessages();
    await checkServers();
  }, 5000);

  await runDailyReminder();
  await teacherBirthdayReminder();
  await exportTechShiftsToGoogleSheet();

  setInterval(async () => {
    await runDailyReminder();
    await teacherBirthdayReminder();
    await exportTechShiftsToGoogleSheet();
  }, 24 * 60 * 60 * 1000);
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
