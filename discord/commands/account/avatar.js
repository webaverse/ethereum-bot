const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Set avatar")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const contentId = data.interaction.options.getString("id");
    const id = parseInt(contentId, 10);

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

    if (!isNaN(id)) {
      const hash = await data.contracts.NFT.methods.getHash(id).call();
      const [name, ext] = await Promise.all([
        data.contracts.NFT.methods.getMetadata(hash, "name").call(),
        data.contracts.NFT.methods.getMetadata(hash, "ext").call(),
      ]);

      // const avatarUrl = `${storageHost}/${hash.slice(2)}${ext ? ('.' + ext) : ''}`;
      // const avatarFileName = avatarUrl.replace(/.*\/([^\/]+)$/, '$1');
      const avatarPreview = `${previewHost}/${hash}${
        ext ? "." + ext : ""
      }/preview.${previewExt}`;

      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarId",
        id + ""
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarName",
        name
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarExt",
        ext
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarPreview",
        avatarPreview
      );

      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: avatar is " +
          JSON.stringify(avatarId),
        ephemeral: this.isHidden,
      });
    } else if (contentId) {
      const name = path.basename(contentId);
      const ext = path.extname(contentId).slice(1);
      const avatarPreview = `https://preview.webaverse.com/[${contentId}]/preview.jpg`;

      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarId",
        contentId
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarName",
        name
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarExt",
        ext
      );
      await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "avatarPreview",
        avatarPreview
      );

      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: avatar is " +
          JSON.stringify(avatarId),
        ephemeral: this.isHidden,
      });
    } else {
      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address = wallet.getAddressString();
      const avatarId = await data.contracts.Account.methods
        .getMetadata(address, "avatarId")
        .call();

      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: avatar is " +
          JSON.stringify(avatarId),
        ephemeral: this.isHidden,
      });
    }
  },
};
