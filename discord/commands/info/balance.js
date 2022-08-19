const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Show FT balance")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Select User, leave empty for treasury")
        .setRequired(false)
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;
    if (isUser) {
      const userId = user?.id;
      let { mnemonic } = await data._getUser(userId);
      if (!mnemonic) {
        const spec = await data._genKey(userId);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address = wallet.getAddressString();
      const balance = await data.contracts.FT.methods.balanceOf(address).call();

      if (balance === "0") {
        data.interaction.editReply({
          content:
            "<@!" +
            userId +
            "> has " +
            balance +
            " SILK. Want to get some SILK? Ask the Webaverse team: https://discord.gg/webaverse",
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.editReply({
          content: "<@!" + userId + "> has " + balance + " SILK.",
          ephemeral: this.isHidden,
        });
      }
    } else {
      const balance = await data.contracts.FT.methods
        .balanceOf(data.treasuryAddress)
        .call();

      data.interaction.editReply({
        content: "treasury has " + balance + " SILK",
        ephemeral: this.isHidden,
      });
    }
  },
};
