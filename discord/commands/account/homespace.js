const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const { previewHost, previewExt } = require("../../../constants");
const bip39 = require("bip39");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("homespace")
    .setDescription("Set NFT as home space")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    let { mnemonic } = await data._getUser();
    if (!mnemonic) {
      const spec = await data._genKey();
      mnemonic = spec.mnemonic;
    }
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

      const hash = await data.contracts.NFT.methods.getHash(id).call();
      const [name, ext] = await Promise.all([
        data.contracts.NFT.methods.getMetadata(hash, "name").call(),
        data.contracts.NFT.methods.getMetadata(hash, "ext").call(),
      ]);

      // const homeSpaceUrl = `${storageHost}/${hash.slice(2)}${ext ? ('.' + ext) : ''}`;
      // const homeSpaceFileName = homeSpaceUrl.replace(/.*\/([^\/]+)$/, '$1');
      const homeSpacePreview = `${previewHost}/${hash}${
        ext ? "." + ext : ""
      }/preview.${previewExt}`;

      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "homeSpaceId",
        id + ""
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "homeSpaceName",
        name
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "homeSpaceExt",
        ext
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "homeSpacePreview",
        homeSpacePreview
      );

      data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: set home space to " + id,
        ephemeral: this.isHidden,
      });
    } else {
      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address = wallet.getAddressString();
      const homeSpaceUrl = await data.contracts.Account.methods
        .getMetadata(address, "homeSpaceUrl")
        .call();

      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: home space is " +
          JSON.stringify(homeSpaceUrl),
        ephemeral: this.isHidden,
      });
    }
  },
};
