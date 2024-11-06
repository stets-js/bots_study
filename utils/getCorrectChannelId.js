const userInSelectedChannel = async (shiftType, userId, client) => {
  const channelId = shiftType === 'kwiz' ? 'C07UADS7U3G' : shiftType === 'om' ? 'C07U2G5J7PH' : '';
  const channel = await client.conversations.members({channel: channelId});

  const isMember = channel.members.includes(userId);

  return {channelId, isMember};
};

module.exports = userInSelectedChannel;
