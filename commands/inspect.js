const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('inspect')
        .setDescription('Inspects nft'),
	async execute(interaction,ddb) {
                  const m = await interaction.reply('Inspector!');
    
	},
};