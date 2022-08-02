
const {usersTableName, prefix, storageHost, previewHost, previewExt, treasurerRoleName} = require('../constants.js');
const { hdkey } = require('ethereumjs-wallet');
const bip39 = require('bip39');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('monetizationpointer')
        .setDescription('Sets monetization pointer'),
	async execute(interaction,ddb, contracts,runSidechainTransaction) {
                  //const m = await interaction.reply('Inspector!');
        const split = words.map(word => word[0]);
        const _getUser = async (id = interaction.user.id) => {
            var params = {
                TableName: usersTableName,
                Key: {
                    email: { S: id + '.discordtoken' },
                }
            };
            const tokenItem = await ddb.getItem(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     console.log("Retrieved Database Item");
            }).promise();

            let mnemonic = (tokenItem.Item && tokenItem.Item.mnemonic) ? tokenItem.Item.mnemonic.S : null;
            return { mnemonic };
        };
        const _genKey = async (id = interaction.user.id) => {
            const mnemonic = bip39.generateMnemonic();
            var params = {
                TableName: usersTableName,
                Item: {
                    email: { S: id + '.discordtoken' },
                    mnemonic: { S: mnemonic },
                }
            }
            await ddb.putItem(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     console.log("Saved Database Item");
            }).promise();
            return { mnemonic };
        };
        let userId, mnemonic;
        userId = interaction.user.id;
        const spec = await _getUser(userId);
        mnemonic = spec.mnemonic;
        if (!mnemonic) {
            const spec = await _genKey(userId);
            mnemonic = spec.mnemonic;
        }

                  if (split[1]) {
                      const monetizationPointer = split[1];

                      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                      const address = wallet.getAddressString();
                      const result = await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'monetizationPointer', monetizationPointer);

                      interaction.reply({content: `<@!\`${interaction.user.id}\`>: set monetization pointer to \`${JSON.stringify(monetizationPointer)}\``, ephemeral: true});
                  } else {
                      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                      const address = wallet.getAddressString();
                      const monetizationPointer = await contracts.Account.methods.getMetadata(address, 'monetizationPointer').call();

                      interaction.reply({ content: `<@!\`${interaction.user.id}\`>: monetization pointer is \`${JSON.stringify(monetizationPointer)}\``, ephemeral: true});
                  }
    
	},
};