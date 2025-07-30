const { checkAuthorization } = require("../utils/axios");
const { slackApp } = require("./slack");
const publishHomeTab = async (userId, client) => {
  const data = await checkAuthorization(userId);
  console.log(data);
  const { user: users, isSync } = data;
  const [user] = users;
  try {
    await client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "👋 Привіт, радий бачити тебе!",
              emoji: true,
            },
          },
          {
            type: "divider",
          },
          {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: "Синхронізація з Teacher Booking надає можливість отримувати в приватні повідомлення",
                  },
                  {
                    type: "text",
                    text: " актуальну інформацію",
                    style: {
                      bold: true,
                    },
                  },
                  {
                    type: "text",
                    text: ":\n",
                  },
                ],
              },
              {
                type: "rich_text_list",
                style: "bullet",
                indent: 0,
                border: 0,
                elements: [
                  {
                    type: "rich_text_section",
                    elements: [
                      {
                        type: "text",
                        text: "Звіти від Відділу Контроля Якості",
                      },
                    ],
                  },
                  {
                    type: "rich_text_section",
                    elements: [
                      {
                        type: "text",
                        text: "Інтерактивні запити на проведення потоків з можливістю ",
                      },
                      {
                        type: "text",
                        text: "погодження",
                        style: {
                          bold: true,
                        },
                      },
                      {
                        type: "text",
                        text: " або ",
                      },
                      {
                        type: "text",
                        text: "відміни",
                        style: {
                          bold: true,
                        },
                      },
                    ],
                  },
                ],
              },
              {
                type: "rich_text_section",
                elements: [],
              },
            ],
          },
          isSync
            ? {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `✅ *Ваш акаунт вже синхронізований з користувачем ${user.name} (${user.email})!*`,
                },
              }
            : {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "🔗 Синхронізуватися",
                    },
                    action_id: "sync_account",
                  },
                ],
              },
        ],
      },
    });
  } catch (error) {
    console.error("Ошибка загрузки App Home:", error);
  }
};
slackApp.event("app_home_opened", async ({ event, client }) => {
  console.log("trying to do");
  await publishHomeTab(event.user, client);
});

slackApp.action("sync_account", async ({ body, ack, client }) => {
  await ack();

  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "login_submit",
      title: {
        type: "plain_text",
        text: "Синхронізація акаунта",
      },
      blocks: [
        {
          type: "input",
          block_id: "email_block",
          element: {
            type: "plain_text_input",
            action_id: "email_input",
            placeholder: {
              type: "plain_text",
              text: "Пошта від букінга",
            },
          },
          label: {
            type: "plain_text",
            text: "Введіть ваш Email",
          },
        },
        {
          type: "input",
          block_id: "password_block",
          element: {
            type: "plain_text_input",
            action_id: "password_input",
            placeholder: {
              type: "plain_text",
              text: "Пароль від букінга",
            },
          },
          label: {
            type: "plain_text",
            text: "Введіть пароль",
          },
        },
      ],
      submit: {
        type: "plain_text",
        text: "Синхронізуватися",
      },
      close: {
        type: "plain_text",
        text: "Скасувати",
      },
    },
  });
});

slackApp.view("login_submit", async ({ view, ack, body, client }) => {
  await ack();

  const email = view.state.values.email_block.email_input.value;
  const password = view.state.values.password_block.password_input.value;
  const slackUserId = body.user.id;

  console.log(`Спроба логіну: ${email}, Slack ID: ${slackUserId}`);

  try {
    const response = await fetch(
      "https://dolphin-app-b3fkw.ondigitalocean.app/api/auth/slackSync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, slackUserId }),
      }
    );

    const result = await response.json();
    console.log(result, "result!");
    if (result) {
      await client.chat.postMessage({
        channel: slackUserId,
        text: "✅ Ваш акаунт успішно синхронізовано з Teacher Booking!",
      });
      await publishHomeTab(body.user.id, client);
    } else {
      await client.chat.postMessage({
        channel: slackUserId,
        text: "❌ Помилка авторизації! Перевірте email і пароль.",
      });
    }
  } catch (error) {
    console.error("Помилка логіну:", error);

    await client.chat.postMessage({
      channel: slackUserId,
      text: "Сталася технічна помилка 😔\n Ми вже над нею працюємо. Якщо щось термінове — напишіть, будь ласка, тімліду.",
    });
  }
});
