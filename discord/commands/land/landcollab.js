const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("landcollab")
    .setDescription("Add collaborator to [parcelId]")
    .addStringOption((option) =>
      option.setName("parcelid").setRequired(true).setDescription("Parcel ID")
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Select User, leave empty for address")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("address")
        .setDescription("Select Address")
        .setRequired(false)
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;
    const address = data.interaction.options.getString("address");
    const tokenId = parseInt(
      data.interaction.options.getString("parcelid"),
      10
    );
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
            const spec = await data._genKey(userId);
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
          "LAND",
          "addSingleCollaborator",
          tokenId,
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
            ">: added collaborator to LAND #" +
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
          "LAND",
          "addSingleCollaborator",
          address2,
          tokenId
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
            ">: added collaborator to LAND #" +
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
