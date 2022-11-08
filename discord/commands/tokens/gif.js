const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("gif")
    .setDescription("Gif")
    .addStringOption((option) =>
      option.setName("nftid").setRequired(true).setDescription("NFT ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = parseInt(data.interaction.options.getString("nftid"), 10);

    const hash = await data.contracts.NFT.methods.getHash(id).call();
    const ext = await data.contracts.NFT.methods.getMetadata(hash, "ext").call();

    if (ext) {
     data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: " +
          id +
          ": https://preview.webaverse.com/" +
          hash +
          "." +
          ext +
          "/preview.gif",
        ephemeral: this.isHidden,
      });
    } else {
     data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: " +
          id +
          ": cannot preview file type: " +
          ext,
        ephemeral: this.isHidden,
      });
    }
  },
};
