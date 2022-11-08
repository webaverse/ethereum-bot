const { SlashCommandBuilder } = require("@discordjs/builders");
const Discord = require("discord.js");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("wget")
    .setDescription("Get NFT [id] in DM")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = parseInt(data.interaction.options.getString("id"), 10);

    if (!isNaN(id)) {
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
      let owner = await data.contracts.NFT.methods.ownerOf(id).call();
      owner = owner.toLowerCase();
      if (owner === address) {
        const hash = await data.contracts.NFT.methods.getHash(id).call();
        const [name, ext] = await Promise.all([
          data.contracts.NFT.methods.getMetadata(hash, "name").call(),
          data.contracts.NFT.methods.getMetadata(hash, "ext").call(),
        ]);

        const buffer = await _readStorageHashAsBuffer(hash);
        const attachment = new Discord.MessageAttachment(
          buffer,
          name + (ext ? "." + ext : "")
        );

       data.interaction.editReply({
          content: "<@!" + data.interaction.user.id + ">: " + id + " is this",
          attachment: [attachment],
          ephemeral: this.isHidden,
        });
        // m.react('❌');
      } else {
       data.interaction.editReply({
          content: "<@!" + data.interaction.user.id + ">: not your nft: " + id,
          ephemeral: this.isHidden,
        });
      }
    } else {
     data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid token id: " + id,
        ephemeral: this.isHidden,
      });
    }
  },
};
