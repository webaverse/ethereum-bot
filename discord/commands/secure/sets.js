const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");
const { encodeSecret, decodeSecret } = require("../../../encryption.js");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("sets")
    .setDescription("Set metadata for NFT")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addStringOption((option) =>
      option.setName("key").setRequired(true).setDescription("Key")
    )
    .addStringOption((option) =>
      option.setName("value").setRequired(true).setDescription("Value")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = parseInt(data.interaction.options.getString("id"), 10);
    const key = data.unlockableKey;
    let value = data.interaction.option.getString("value");

    // console.log('do set', id, key, value);

    let { mnemonic } = await data._getUser();
    if (!mnemonic) {
      const spec = await data._genKey();
      mnemonic = spec.mnemonic;
    }
    const wallet = hdkey
      .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
      .derivePath(`m/44'/60'/0'/0/0`)
      .getWallet();
    const address = wallet.getAddressString();

    const hash = await data.contracts.NFT.methods.getHash(id).call();
    const isC = await data.contracts.NFT.methods
      .isCollaborator(hash, address)
      .call();

    if (isC) {
      let { ciphertext, tag } = encodeSecret(
        data.encryptionMnemonic,
        id,
        value,
        "utf8"
      );
      ciphertext = ciphertext.toString("base64");
      tag = tag.toString("base64");
      value = JSON.stringify({
        ciphertext,
        tag,
      });

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "NFT",
          "setMetadata",
          hash,
          key,
          value
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        // console.log('set value ok', {key, value});
      } else {
        // console.warn('set error 1');
      }
    } else {
      // console.warn('set error 2');
    }
  },
};
