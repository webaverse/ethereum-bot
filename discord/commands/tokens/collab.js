const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("collab")
    .setDescription("Add collaborator for [tokenId]")
    .addStringOption((option) =>
      option.setName("tokenid").setRequired(true).setDescription("Token ID")
    )
    .addUserOption((option) =>
      option.setName("user").setRequired(false).setDescription("Select User")
    )
    .addStringOption((option) =>
      option
        .setName("address")
        .setRequired(false)
        .setDescription("Select Address")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;
    const address = data.interaction.options.getString("address");
    const tokenId = data.interaction.options.getString("tokenid");

    const hash = await data.contracts.NFT.methods.getHash(tokenId).call();
    if (isUser) {
      let mnemonic, mnemonic2;
      if (userId !== data.interaction.user.id) {
        {
          const userSpec = await data._getUser();
          mnemonic = userSpec.mnemonic;
          if (!mnemonic) {
            const spec = await data._genKey();
            mnemonic = spec.mnemonic;
          }
        }
        {
          const userSpec = await data._getUser(user.id);
          mnemonic2 = userSpec.mnemonic;
          if (!mnemonic2) {
            const spec = await data._genKey(user.id);
            mnemonic2 = spec.mnemonic;
          }
        }
      }
      const wallet2 = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic2))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address2 = wallet2.getAddressString();

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "NFT",
          "addCollaborator",
          hash,
          address2
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: added collaborator to token #" +
            tokenId +
            ": " +
            address2,
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: could not send: " +
            transactionHash,
          ephemeral: this.isHidden,
        });
      }
    } else if ((match = address.match(/(0x[0-9a-f]+)/i))) {
      let { mnemonic } = await data._getUser();
      if (!mnemonic) {
        const spec = await data._genKey();
        mnemonic = spec.mnemonic;
      }

      const address2 = match[1];

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "NFT",
          "addCollaborator",
          hash,
          address2
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: added collaborator to token #" +
            tokenId +
            ": " +
            address2,
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: could not send: " +
            transactionHash,
          ephemeral: this.isHidden,
        });
      }
    } else {
      data.interaction.editReply({
        content: "unknown user",
        ephemeral: this.isHidden,
      });
    }
  },
};
