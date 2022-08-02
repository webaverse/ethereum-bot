const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lists available commands'),
	async execute(interaction,ddb) {
                  const m = await interaction.reply('HELP!');
    
	},
};