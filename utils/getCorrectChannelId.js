const userInSelectedChannel = async (shiftType = '', userId, client) => {
  console.log(shiftType, userId);
  const channelId =
    shiftType === 'kwiz'
      ? 'C07UADS7U3G'
      : shiftType === 'om'
      ? 'C07U2G5J7PH'
      : shiftType === 'sup'
      ? 'C083PKS3L0M'
      : '';
  const channel = await client.conversations.members({channel: channelId});

  const isMember = channel.members.includes(userId);
  console.log(channel.members);
  return {channelId, isMember};
};

module.exports = userInSelectedChannel;
