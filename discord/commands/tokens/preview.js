const { SlashCommandBuilder } = require("@discordjs/builders");
const { helps } = require("../../discordbot");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("preview")
    .setDescription("Preview NFT [id]; /gif for gif")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addStringOption((option) =>
      option
        .setName("show_type")
        .setRequired(true)
        .setDescription("Show Type - raw or not")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = parseInt(data.interaction.options.getString("id"), 10);
    const raw = data.interaction.option.getString("show_type") === "raw";

    const hash = await data.contracts.NFT.methods.getHash(id).call();
    const ext = await data.contracts.NFT.methods
      .getMetadata(hash, "ext")
      .call();

    if (ext) {
      if (!raw) {
        const m = await data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: " +
            id +
            ": https://preview.webaverse.com/" +
            hash +
            "." +
            ext +
            "/preview.png",
          ephemeral: this.isHidden,
        });

        m.react("❌");
        m.requester = data.interaction.user;
        helps.push(m);
      } else {
        const url = `https://ipfs.exokit.org/${hash}/src.${ext}`;
        const screenshotUrl = `https://app.webaverse.com/screenshot.html?url=${url}&hash=${hash}&ext=${ext}&type=png`;
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: " +
            id +
            ": " +
            screenshotUrl,
          ephemeral: this.isHidden,
        });
      }
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
