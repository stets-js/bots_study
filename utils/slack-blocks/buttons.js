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
    action_id,
    additional: 'asd'
  };
};
const generateDatePicker = ({action_id, initial_date, text = 'Select a date'}) => {
  return {
    type: 'datepicker',
    initial_date,
    placeholder: {
      type: 'plain_text',
      text,
      emoji: true
    },
    action_id
  };
};
module.exports = {generateButton, generateDatePicker};
