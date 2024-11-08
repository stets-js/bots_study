const generateButton = (
  value,
  action_id,
  style = 'primary',
  buttonText = 'Підтверджую',
  additional
) => {
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
    ...additional
  };
};
const generateDatePicker = ({action_id, block_id, initial_date, text = 'Select a date'}) => {
  return {
    type: 'datepicker',
    initial_date,
    block_id,
    placeholder: {
      type: 'plain_text',
      text,
      emoji: true
    },
    action_id
  };
};
module.exports = {generateButton, generateDatePicker};
