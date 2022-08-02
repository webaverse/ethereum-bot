
const { hdkey } = require('ethereumjs-wallet');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('monetizationpointer')
        .setDescription('Sets monetization pointer'),
	async execute(interaction,ddb, contracts,runSidechainTransaction) {
                  //const m = await interaction.reply('Inspector!');
                  let { mnemonic } = await _getUser();
                  if (!mnemonic) {
                      const spec = await _genKey();
                      mnemonic = spec.mnemonic;
                  }

                  if (split[1]) {
                      const monetizationPointer = split[1];

                      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                      const address = wallet.getAddressString();
                      const result = await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'monetizationPointer', monetizationPointer);

                      interaction.reply({content: `<@!\`${interaction.author.id}\`>: set monetization pointer to \`${JSON.stringify(monetizationPointer)}\``, ephemeral: true});
                  } else {
                      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                      const address = wallet.getAddressString();
                      const monetizationPointer = await contracts.Account.methods.getMetadata(address, 'monetizationPointer').call();

                      interaction.reply({ content: `<@!\`${interaction.author.id}\`>: monetization pointer is \`${JSON.stringify(monetizationPointer)}\``, ephemeral: true});
                  }
    
	},
};