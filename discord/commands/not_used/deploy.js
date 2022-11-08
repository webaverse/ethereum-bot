const { SlashCommandBuilder } = require("@discordjs/builders");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("deploy")
    .setDescription("Deploy [nftId] to [parcelId]")
    .addStringOption((option) =>
      option.setName("parcelid").setRequired(true).setDescription("Parcel ID")
    )
    .addStringOption((option) =>
      option.setName("nftid").setRequired(true).setDescription("NFT ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tokenId = parseInt(data.interaction.options.getString("nftid"), 10);
    const contentId = data.interaction.options.getString("parcelid");

    let { mnemonic } = await data._getUser();
    if (!mnemonic) {
      const spec = await data._genKey();
      mnemonic = spec.mnemonic;
    }

    if (!isNaN(tokenId)) {
      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "LAND",
          "setSingleMetadata",
          tokenId,
          "hash",
          contentId
        );
        status = result.status;
        transactionHash = "0x0";
      } catch (err) {
        console.warn(err);
        status = false;
        transactionHash = err.message;
      }

      if (status) {
       data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: deploy successful, sarge!",
          ephemeral: this.isHidden,
        });
      } else {
       data.interaction.editReply({
          content: "<@!" + data.interaction.user.id + ">: deploy failed",
          ephemeral: this.isHidden,
        });
      }
    } else {
     data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid land nft: " + tokenId,
        ephemeral: this.isHidden,
      });
    }
  },
};
