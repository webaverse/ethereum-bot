const { SlashCommandBuilder } = require("@discordjs/builders");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
  .setName("inspect")
  .setDescription("Inspects nft"),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

   data.interaction.editReply({ content: "Inspector", ephemeral: this.isHidden });
  },
};
