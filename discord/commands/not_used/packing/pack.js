const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("pack")
    .setDescription("Pack [amount] FT into [nftId]")
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

      const fullAmount = {
        t: "uint256",
        v: new data.web3.utils.BN(1e9)
          .mul(new data.web3.utils.BN(1e9))
          .mul(new data.web3.utils.BN(1e9)),
      };
      const fullAmountD2 = {
        t: "uint256",
        v: fullAmount.v.div(new data.web3.utils.BN(2)),
      };

      let status;
      try {
        {
          let allowance = await data.contracts.FT.methods
            .allowance(address, data.contracts["NFT"]._address)
            .call();
          allowance = new data.web3.utils.BN(allowance, 10);
          if (allowance.lt(fullAmountD2.v)) {
            const result = await data.runSidechainTransaction(mnemonic)(
              "FT",
              "approve",
              data.contracts["NFT"]._address,
              fullAmount.v
            );
            status = result.status;
          } else {
            status = true;
          }
        }
        if (status) {
          const result = await data.runSidechainTransaction(mnemonic)(
            "NFT",
            "pack",
            address,
            tokenId,
            amount
          );
          status = result.status;
        }
      } catch (err) {
        console.warn(err);
      }

      if (status) {
       data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: packed " +
            amount +
            " into #" +
            tokenId,
          ephemeral: this.isHidden,
        });
      } else {
       data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: failed to pack FT into NFT: " +
            tokenId,
          ephemeral: this.isHidden,
        });
      }
    } else {
     data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid token id: " + tokenId,
        ephemeral: this.isHidden,
      });
    }
  },
};
