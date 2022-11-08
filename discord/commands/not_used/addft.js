const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const { trades } = require("../../discordbot");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("addft")
    .setDescription("Add FT to trade [tradeId]")
    .addStringOption((option) =>
      option.setName("tradeid").setRequired(true).setDescription("Trade ID")
    )
    .addNumberOption((option) =>
      option.setName("amount").setRequired(true).setDescription("Amount")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tradeId = parseInt(data.interaction.options.getString("tradeid"), 10);
    const trade = trades.find((trade) => trade.tradeId === tradeId);
    if (trade) {
      const index = trade.userIds.indexOf(data.interaction.user.id);
      if (index >= 0) {
        const amount = data.interaction.options.getNumber("amount");
        console.log("got amount", amount);
        if (!isNaN(amount)) {
          let { mnemonic } = await data._getUser();
          if (!mnemonic) {
            const spec = await data._genKey();
            mnemonic = spec.mnemonic;
          }

          const wallet = hdkey
            .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
            .derivePath(`m/44'/60'/0'/0/0`)
            .getWallet();
          const address = wallet.getAddressString();
          const balance = await data.contracts.FT.methods
            .balanceOf(address)
            .call();

          console.log("got balance", balance);

          if (balance >= amount) {
            trade.addFt(data.interaction.user.id, amount);

            const doneReactions = trade.reactions.cache.filter(
              (reaction) => reaction.emoji.identifier === "%E2%9C%85"
            );
            try {
              for (const reaction of doneReactions.values()) {
                const users = Array.from(reaction.users.cache.values());
                for (const user of users) {
                  if (user.id !== data.client.user.id) {
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
                ">: insufficient ft balance: " +
                amount,
              ephemeral: this.isHidden,
            });
          }
        } else {
          data.interaction.editReply({
            content:
              "<@!" + data.interaction.user.id + ">: invalid amount: " + amount,
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
