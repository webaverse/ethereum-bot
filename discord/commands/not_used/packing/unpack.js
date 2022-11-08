const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("unpack")
    .setDescription("Unpack [amount] FT from [nftId]")
    .addStringOption((option) =>
      option.setName("nftid").setRequired(true).setDescription("NFT ID")
    )
    .addIntegerOption((option) =>
      option.setName("amount").setRequired(true).setDescription("Amount")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tokenId = parseInt(data.interaction.options.getString("nftid"), 10);
    const amount = data.interaction.options.getInteger("amount");
    if (!isNaN(tokenId) && !isNaN(amount)) {
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

      const result = await data.runSidechainTransaction(mnemonic)(
        "NFT",
        "unpack",
        address,
        tokenId,
        amount
      );

      if (result.status) {
       data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: unpacked " +
            amount +
            " from #" +
            tokenId,
          ephemeral: this.isHidden,
        });
      } else {
       data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: failed to unpack FT from NFT: " +
            tokenId,
          ephemeral: this.isHidden,
        });
      }
    } else {
     data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid token id: " + nftid,
        ephemeral: this.isHidden,
      });
    }
  },
};
