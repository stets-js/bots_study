const {slackApp} = require('./slack');

slackApp.action('sync_account', async ({body, ack, client}) => {
  await ack();

  // Відкриваємо модальне вікно з полями для логіну
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: 'modal',
      callback_id: 'login_submit',
      title: {
        type: 'plain_text',
        text: 'Синхронізація акаунта'
      },
      blocks: [
        {
          type: 'input',
          block_id: 'email_block',
          element: {
            type: 'plain_text_input',
            action_id: 'email_input'
          },
          label: {
            type: 'plain_text',
            text: 'Введіть ваш Email'
          }
        },
        {
          type: 'input',
          block_id: 'password_block',
          element: {
            type: 'plain_text_input',
            action_id: 'password_input',
            type: 'password'
          },
          label: {
            type: 'plain_text',
            text: 'Введіть пароль'
          }
        }
      ],
      submit: {
        type: 'plain_text',
        text: 'Синхронізуватися'
      },
      close: {
        type: 'plain_text',
        text: 'Скасувати'
      }
    }
  });
});

slackApp.view('login_submit', async ({view, ack, body, client}) => {
  await ack();

  const email = view.state.values.email_block.email_input.value;
  const password = view.state.values.password_block.password_input.value;
  const slackUserId = body.user.id;

  console.log(`Спроба логіну: ${email}, Slack ID: ${slackUserId}`);

  try {
    const response = await fetch(
      'https://dolphin-app-b3fkw.ondigitalocean.app/api/auth/slackSync',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password, slackUserId})
      }
    );

    const result = await response.json();

    if (result.success) {
      await client.chat.postMessage({
        channel: slackUserId,
        text: '✅ Ваш акаунт успішно синхронізовано з Teacher Booking!'
      });
    } else {
      await client.chat.postMessage({
        channel: slackUserId,
        text: '❌ Помилка авторизації! Перевірте email і пароль.'
      });
    }
  } catch (error) {
    console.error('Помилка логіну:', error);

    await client.chat.postMessage({
      channel: slackUserId,
      text: '⚠️ Сталася помилка під час синхронізації. Спробуйте пізніше.'
    });
  }
});
