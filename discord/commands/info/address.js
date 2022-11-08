const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");


module.exports = {
  isHidden: true,
  data: new SlashCommandBuilder()
    .setName("address")
    .setDescription("Print address")
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
      let mnemonic;
      const spec = await data._getUser(user.id);
      if (spec.mnemonic) {
        mnemonic = spec.mnemonic;
      } else {
        const spec = await data._genKey(user.id);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      address = wallet.getAddressString();

      userLabel = "<@!" + user.id + ">";
    } else {
      address = data.treasuryAddress;
      userLabel = "treasury";
    }

    if (address) {
      data.interaction.editReply({
        content: userLabel + "'s address: ```" + address + "```",
        ephemeral: this.isHidden,
      });
    } else {
      data.interaction.editReply({ content: "no such user", ephemeral: this.isHidden });
    }
  },
};
