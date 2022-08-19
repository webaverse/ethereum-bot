const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const { helps } = require("../../discordbot");

module.exports = {
  isHidden: true,
  data: new SlashCommandBuilder()
    .setName("key")
    .setDescription("Get/Set/Reset private key")
    .addStringOption((option) =>
      option
        .setName("option")
        .setRequired(true)
        .setDescription("Get/Set/Reset")
        .addChoices(
          { name: "Get", value: "Get" },
          { name: "Set", value: "Set" },
          { name: "Reset", value: "Reset" }
        )
    )
    .addStringOption((option) =>
      option.setName("key").setRequired(false).setDescription("New Key")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

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
    const privateKey = wallet.privateKey.toString("hex");

    const m = await data.interaction.editReply({
      content:
        "Address: `" +
        address +
        "`\nMnemonic: ||" +
        mnemonic +
        "||\nPrivate key: ||" +
        privateKey +
        "||",
      ephemeral: this.isHidden,
    });
    m.react("❌");
    helps.push(m);
  },
};
