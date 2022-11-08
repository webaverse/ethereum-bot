const fs = require("fs");
const path = require("path");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const {
  discordClientId,
  webaverseGuildId,
  discordApiToken,
} = require("../config.json");

exports.deploy_commands = () => {
  const commands = [];
  const commandsPath = path.join(__dirname, "commands");
  const commandσFolders = fs.readdirSync(commandsPath);
  for (const folder of commandσFolders) {
    if (folder === "not_used") {
      continue;
    }

    const _folder = commandsPath + "/" + folder;
    const commandFiles = fs
      .readdirSync(_folder)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(_folder, file);
      const command = require(filePath);
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: "10" }).setToken(discordApiToken);

  rest
    .put(Routes.applicationGuildCommands(discordClientId, webaverseGuildId), {
      body: commands,
    })
    .then(() =>
      console.log(
        "Successfully registered (" +
          commands.length +
          ") application commands."
      )
    )
    .catch(console.error);
};
