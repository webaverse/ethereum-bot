const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { discordClientId, webaverseGuildId, discordApiToken } = require('./config.json');

const commands = [
	new SlashCommandBuilder()
		.setName('status')
		.setDescription('Shows account details')
		.addUserOption(option => option.setName('target').setDescription('Select a user')),
	new SlashCommandBuilder()
		.setName('help')
		.setDescription('Lists available commands')
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(discordApiToken);

rest.put(Routes.applicationGuildCommands(discordClientId, webaverseGuildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);