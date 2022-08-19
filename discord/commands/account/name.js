const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("name")
    .setDescription("Set new name")
    .addStringOption((option) =>
      option.setName("name").setRequired(true).setDescription("New Name")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const newName = data.interaction.options.getString("name");

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
    const result = await data.runSidechainTransaction(mnemonic)(
      "Account",
      "setMetadata",
      address,
      "name",
      newName
    );

    console.log(
      "repling:",
      "<@!" +
        data.interaction.user.id +
        ">: set name to " +
        JSON.stringify(newName)
    );

    data.interaction.editReply({
      content:
        "<@!" +
        data.interaction.user.id +
        ">: set name to " +
        JSON.stringify(newName),
      ephemeral: this.isHidden,
    });
  },
};
