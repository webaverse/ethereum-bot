const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("unsell")
    .setDescription("Unlist [saleId]")
    .addStringOption((option) =>
      option.setName("saleid").setRequired(true).setDescription("Sale ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const buyId = parseInt(data.interaction.option.getString("saleid"), 10);
    if (!isNaN(buyId)) {
      let { mnemonic } = await data._getUser();
      if (!mnemonic) {
        const spec = await data._genKey();
        mnemonic = spec.mnemonic;
      }
      // const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
      // const address = wallet.getAddressString();

      let status;
      try {
        await data.runSidechainTransaction(mnemonic)(
          "Trade",
          "removeStore",
          buyId
        );

        status = true;
      } catch (err) {
        console.warn(err.stack);
        status = false;
      }

      if (status) {
       data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: unlisted sell " + buyId,
          ephemeral: this.isHidden,
        });
      } else {
       data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: unlist failed: " + buyId,
          ephemeral: this.isHidden,
        });
      }
    } else {
     data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid sell id: " + buyId,
        ephemeral: this.isHidden,
      });
    }
  },
};
