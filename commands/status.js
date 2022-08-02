const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('status')
		.setDescription('Shows account details')
		.addUserOption(option => option.setName('target').setDescription('Select a user')),
	async execute(interaction,ddb) {
        const _getUser = async (id = interaction.user.id) => {
            var params = {
                TableName: usersTableName,
                Key: {
                    email: { S: id + '.discordtoken' },
                }
            };
            const tokenItem = await ddb.getItem(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     console.log(data);
            }).promise();

            let mnemonic = (tokenItem.Item && tokenItem.Item.mnemonic) ? tokenItem.Item.mnemonic.S : null;
            return { mnemonic };
        };
        const _genKey = async (id = interaction.user.id) => {
            const mnemonic = bip39.generateMnemonic();

            await ddb.putItem({
                TableName: usersTableName,
                Item: {
                    email: { S: id + '.discordtoken' },
                    mnemonic: { S: mnemonic },
                }
            }).promise();
            return { mnemonic };
        };
    //     await interaction.reply('Status received');
                  let userId, mnemonic;
                  if (interaction.options.getUser('target')){
                      userId = interaction.options.getUser('target').id;
                  } else {
                      userId = interaction.user.id;
                  }
                  const spec = await _getUser(userId);
                  mnemonic = spec.mnemonic;
                  if (!mnemonic) {
                      const spec = await _genKey(userId);
                      mnemonic = spec.mnemonic;
                  }

                  const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                  const address = wallet.getAddressString();
                  const [
                      name,
                      description,
                      avatarId,
                      homeSpaceId,
                      monetizationPointer,
                      avatarPreview,
                  ] = await Promise.all([
                      contracts.Account.methods.getMetadata(address, 'name').call(),
                      contracts.Account.methods.getMetadata(address, 'description').call(),
                      contracts.Account.methods.getMetadata(address, 'avatarId').call(),
                      contracts.Account.methods.getMetadata(address, 'homeSpaceId').call(),
                      contracts.Account.methods.getMetadata(address, 'monetizationPointer').call(),
                      contracts.Account.methods.getMetadata(address, 'avatarPreview').call(),
                  ]);

                   const exampleEmbed = new Discord.MessageEmbed()
                    .setColor(embedColor)
                    .setTitle(name)
                    .setURL(`https://webaverse.com/creators/${address}`)
                    // .setAuthor('Some name', 'https://i.imgur.com/wSTFkRM.png', 'https://discord.js.org')
                    .setDescription(description || 'This person is a noob without a description.')
                    .setThumbnail(avatarPreview)
                    .addFields(
                      { name: 'avatar id', value: avatarId || '<none>' },
                      { name: 'homespace id', value: homeSpaceId || '<none>' },
                      { name: 'monetization pointer', value: monetizationPointer || '<none>' },
                    )
                    // .addField('Inline field title', 'Some value here', true)
                    .setImage(avatarPreview)
                    .setTimestamp()
                    .setFooter('.help for help', 'https://app.webaverse.com/assets/logo-flat.svg');
                  const m = await interaction.reply({ embeds: [exampleEmbed]});
                  m.react('❌');
                  m.requester = message.author;
                  helps.push(m);
    
	},
};