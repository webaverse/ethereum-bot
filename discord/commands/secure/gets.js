const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");
const { jsonParse } = require("../../../utilities");
const { decodeSecret } = require("../../../encryption");

module.exports = {
  isHidden: true,
  data: new SlashCommandBuilder()
    .setName("gets")
    .setDescription("Get metadata for NFT")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addStringOption((option) =>
      option.setName("key").setRequired(true).setDescription("Key")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = parseInt(data.interaction.options.getString("id"), 10);
    const key = data.unlockableKey;

    // console.log('got id key', {id, key});

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

    const [
      isC, // collaborator
      isO, // owner
    ] = await Promise.all([
      (async () => {
        const isC = await data.contracts.NFT.methods
          .isCollaborator(hash, address)
          .call();
        return isC;
      })(),
      (async () => {
        const owner = await data.contracts.NFT.methods.ownerOf(id).call();
        return owner === address;
      })(),
    ]);

    if (isC || isO) {
      let value = await data.contracts.NFT.methods
        .getMetadata(hash, key)
        .call();
      value = jsonParse(value);
      if (value !== null) {
        let { ciphertext, tag } = value;
        ciphertext = Buffer.from(ciphertext, "base64");
        tag = Buffer.from(tag, "base64");
        value = decodeSecret(
          encryptionMnemonic,
          id,
          { ciphertext, tag },
          "utf8"
        );
      }

      // console.log('get value ok', {key, value});
    } else {
      // console.warn('get error 1');
    }
  },
};
