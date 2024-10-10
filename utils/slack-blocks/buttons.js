const generateButton = (value, action_id, style = 'primary', buttonText = 'Підтверджую') => {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      emoji: true,
      text: buttonText
    },
    style,
    value,
    action_id
  };
};
module.exports = {generateButton};
