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
          //{ name: "Set", value: "Set" }
        )
    )
    .addStringOption((option) =>
      option.setName("id").setRequired(false).setDescription("ID")
    )
    .addStringOption((option) =>
      option.setName("key").setRequired(false).setDescription("Key")
    )
    .addStringOption((option) =>
      option.setName("value").setRequired(false).setDescription("Value")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const option = data.interaction.options.getString("option");

    if (option === "Get") {
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
      if (data.client.channels.cache.has(m.channelId)) {
        m.react("❌");
      }
      helps.push(m);
    } else {
      const id = parseInt(data.interaction.options.getString("id"), 10);
      const key = data.interaction.options.getString("key");
      const value = data.interaction.options.getString("value");

      let { mnemonic } = await data._getUser();
      if (!mnemonic) {
        const spec = await data._genKey();
        mnemonic = spec.mnemonic;
      }

      const hash = await data.contracts.NFT.methods.getHash(id).call();

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "NFT",
          "setMetadata",
          hash,
          key,
          value
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        await data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: ```" +
            id +
            "/" +
            key +
            " = " +
            value +
            "```",
          ephemeral: this.isHidden,
        });
      } else {
        await data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: could not set: " +
            transactionHash,
          ephemeral: this.isHidden,
        });
      }
    }
  },
};
