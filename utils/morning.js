require('dotenv').config();

const cron = require('node-cron');
const axios = require('axios');
const sendTelegramNotification = require('../bot-entity/telegram');

// Available endpoints
const endpoints = [
  {
    url: 'https://api.api-ninjas.com/v1/quotes',
    headers: {'X-API-Key': process.env.QUOTE_API},
    format: data => `Цитата: \n${data[0].quote} \n (c) ${data[0].author}`
  },
  {
    url: 'https://api.api-ninjas.com/v1/facts',
    headers: {'X-API-Key': process.env.QUOTE_API},
    format: data => `Факт: \n${data[0].fact}`
  },
  {
    url: 'https://api.api-ninjas.com/v1/jokes',
    headers: {'X-API-Key': process.env.QUOTE_API},
    format: data => `Шутка: \n${data[0].joke}`
  },
  {
    url: 'https://api.api-ninjas.com/v1/riddles',
    headers: {'X-API-Key': process.env.QUOTE_API},
    needToFormat: true,
    format: data => `Загадка: \n${data[0].question}` // Answer as a spoiler
  }
];

const replaceSymbols = text => {
  return text
    .replace(/_/g, '\\_') // Escape underscores
    .replace(/\*/g, '\\*') // Escape asterisks
    .replaceAll(`[`, '\\[') // Escape brackets
    .replaceAll(`]`, '\\]') // Escape brackets
    .replaceAll(`(`, '\\(') // Escape parentheses
    .replaceAll(`)`, '\\)') // Escape parentheses
    .replaceAll(`~`, '\\~') // Escape tilde
    .replaceAll(`>`, '\\>') // Escape greater than
    .replaceAll(`#`, '\\#') // Escape hash
    .replaceAll(`+`, '\\+') // Escape plus
    .replaceAll(`-`, '\\-') // Escape minus
    .replaceAll(`=`, '\\=') // Escape equal
    .replaceAll(`{`, '\\{') // Escape curly braces
    .replaceAll(`}`, '\\}') // Escape curly braces
    .replaceAll(`.`, '\\.') // Escape dot
    .replaceAll(`!`, '\\!'); // Escape !
};
// Получение случайного сообщения
const getRandomMessage = async () => {
  const randomIndex = Math.floor(Math.random() * endpoints.length);
  const selectedEndpoint = endpoints[randomIndex];

  try {
    const response = await axios.get(selectedEndpoint.url, {
      headers: selectedEndpoint.headers
    });

    // Форматируем ответ
    return [
      selectedEndpoint.format(response.data),
      endpoints[randomIndex]?.needToFormat,
      endpoints[randomIndex]?.needToFormat &&
        replaceSymbols(`Відповідь: || ${response.data[0]?.answer}||`)
    ];
  } catch (error) {
    console.error('Error fetching random message:', error);
    return 'Повідомлення недоступне на даний момент.';
  }
};

// Получение прогноза погоды
const getWeatherForecast = async city => {
  const apiKey = process.env.WEATHER_API;
  const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&exclude=hourly,minutely,current,alers&units=metric&appid=${apiKey}&lang=ua`;

  try {
    const response = await axios.get(url);
    const {temp} = response.data.main;
    const description = response.data.weather[0].description;
    return `Погода в ${city}: ${temp}°C, ${description}`;
  } catch (error) {
    console.error(`Error fetching weather for ${city}:`, error);
    return `Погода в ${city} недоступна\\.`;
  }
};

const sendMorningMessage = async () => {
  const chatId = '-1002197881869';

  const [quote, isAnswer, answerText] = await getRandomMessage();
  const weatherKharkiv = await getWeatherForecast('Kharkiv');
  console.log(isAnswer, answerText);
  const weatherKyiv = await getWeatherForecast('Kyiv');
  const weatherDnipro = await getWeatherForecast('Dnipro');

  const message = `
Доброго ранку, колеги! ☀️
  
${quote}

Прогноз погоди на сьогодні:
    ${weatherKharkiv},
    ${weatherKyiv},
    ${weatherDnipro}
`;

  await sendTelegramNotification(chatId, message);
  if (isAnswer) await sendTelegramNotification(chatId, answerText, {parse_mode: 'MarkdownV2'});
};

cron.schedule(
  '0 10 * * *',
  () => {
    console.log('Sending morning message...');
    sendMorningMessage();
  },
  {
    scheduled: true,
    timezone: 'Europe/Kiev'
  }
);
// cron.schedule('* * * * * *', () => {
//   console.log('This runs every second');
// });
