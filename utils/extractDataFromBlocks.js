const extractDataFromBlocks = blocks => {
  let selectedShiftType = null;
  let startDate = null;
  let endDate = null;

  blocks.forEach(block => {
    if (block.block_id === 'shift_type') {
      selectedShiftType = block.element?.initial_option?.value;
    } else if (block.block_id === 'start_date') {
      startDate = block.element?.initial_date;
    } else if (block.block_id === 'end_date') {
      endDate = block.element?.initial_date;
    }
  });

  return {selectedShiftType, startDate, endDate};
};

module.exports = {extractDataFromBlocks};
