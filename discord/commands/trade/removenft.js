const { SlashCommandBuilder } = require("@discordjs/builders");
const { trades } = require("../../discordbot");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("removenft")
    .setDescription("Remove NFT [index] from trade [tradeId]")
    .addStringOption((option) =>
      option.setName("tradeid").setRequired(true).setDescription("Trade ID")
    )
    .addStringOption((option) =>
      option.setName("index").setRequired(true).setDescription("Index")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tradeId = parseInt(data.interaction.options.getString("tradeid"), 10);
    const itemNumber = parseInt(
      data.interaction.options.getString("index"),
      10
    );
    const trade = trades.find((trade) => trade.tradeId === tradeId);
    if (trade) {
      const index = trade.userIds.indexOf(data.interaction.user.id);
      if (index >= 0) {
        if (itemNumber >= 0 && itemNumber < trade.nfts.length) {
          trade.removeNft(data.interaction.user.id, itemNumber);

          const doneReactions = trade.reactions.cache.filter(
            (reaction) => reaction.emoji.identifier === "%E2%9C%85"
          );
          try {
            for (const reaction of doneReactions.values()) {
              const users = Array.from(reaction.users.cache.values());
              for (const user of users) {
                if (user.id !== client.user.id) {
                  await reaction.users.remove(user.id);
                }
              }
            }
          } catch (error) {
            console.error("Failed to remove reactions.", error.stack);
          }
        } else {
          data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: invalid trade nft index: " +
              itemNumber,
            ephemeral: this.isHidden,
          });
        }
      } else {
        data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: not your trade: " + tradeId,
          ephemeral: this.isHidden,
        });
      }
    } else {
      data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid trade: " + tradeId,
        ephemeral: this.isHidden,
      });
    }
  },
};
