const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("monetizationpointer")
    .setDescription("Sets monetization pointer")
    .addStringOption((option) =>
      option
        .setName("monetizationpointer")
        .setDescription("Where you want people to send you money")
    ),
  async execute(data) {
    let userId, mnemonic;
    userId = data.interaction.user.id;
    const spec = await data._getUser(userId);
    mnemonic = spec.mnemonic;
    if (!mnemonic) {
      const spec = await data._genKey(userId);
      mnemonic = spec.mnemonic;
    }

    if (data.interaction.options.getString("input")) {
      const monetizationPointer = data.interaction.options.getString("input");

      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address = wallet.getAddressString();
      const result = await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "monetizationPointer",
        monetizationPointer
      );

      data.interaction.editReply({
        content: `You set your monetization pointer to \`${JSON.stringify(
          monetizationPointer
        )}\``,
        ephemeral: true,
      });
    } else {
      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address = wallet.getAddressString();
      const monetizationPointer = await data.contracts.Account.methods
        .getMetadata(address, "monetizationPointer")
        .call();

        data.interaction.editReply({
        content: `Your monetization pointer is \`${JSON.stringify(
          monetizationPointer
        )}\``,
        ephemeral: true,
      });
    }
  },
};
