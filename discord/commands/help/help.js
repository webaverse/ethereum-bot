const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const {
  _findCommand,
  embedColor,
  _commandToDescription,
  _getAllCommandNames,
} = require("../../discord_utils");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lists available commands")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription(
          "Request help for specific command, ignore to get command list"
        )
        .setRequired(false)
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const option = data.interaction.options.getString("command");
    if (option && option?.length > 0) {
      const command = _findCommand(option);
      if (command) {
        const [name, args, description] = command;
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle("Webaverse Help")
          .setURL(`https://docs.webaverse.com/`)
          .addFields([
            {
              name,
              value: _commandToDescription(command),
            },
          ]);
          data.interaction.editReply({
          embeds: [embed],
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.reply({
          content: "Command not found",
          ephemeral: this.isHidden,
        });
      }
    } else {
      const command_list = _getAllCommandNames();
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle("Webaverse Help")
        .setURL(`https://docs.webaverse.com/`)
        .addFields([
          {
            name: "Help",
            value:
              command_list.length > 0
                ? command_list.join("\n")
                : "No commands found!",
          },
        ]);
     data.interaction.editReply({
        embeds: [embed],
        ephemeral: this.isHidden,
      });
    }
  },
};
