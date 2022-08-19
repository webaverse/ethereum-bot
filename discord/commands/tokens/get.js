const { SlashCommandBuilder } = require("@discordjs/builders");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("get")
    .setDescription("Get metadata for NFT")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addStringOption((option) =>
      option.setName("key").setRequired(true).setDescription("Key")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = parseInt(data.interaction.options.getString("id"), 10);
    const key = data.interaction.options.getString("key");

    const hash = await data.contracts.NFT.methods.getHash(id).call();
    const value = await data.contracts.NFT.methods
      .getMetadata(hash, key)
      .call();

   data.interaction.editReply({
      content:
        "<@!" +
        data.interaction.user.id +
        ">: ```" +
        id +
        "/" +
        key +
        ": " +
        value +
        "```",
      ephemeral: this.isHidden,
    });
  },
};
