const { SlashCommandBuilder } = require("@discordjs/builders");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("set")
    .setDescription("Set metadata for NFT")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addStringOption((option) =>
      option.setName("key").setRequired(true).setDescription("Key")
    )
    .addStringOption((option) =>
      option.setName("value").setRequired(true).setDescription("Value")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

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
     data.interaction.editReply({
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
     data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: could not set: " +
          transactionHash,
        ephemeral: this.isHidden,
      });
    }
  },
};
