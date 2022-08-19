const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Sell [nftId] for [price]")
    .addStringOption((option) =>
      option.setName("nftid").setRequired(true).setDescription("NFT ID")
    )
    .addStringOption((option) =>
      option.setName("price").setRequired(true).setDescription("Price")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tokenId = data.interaction.options.getString("nftid");
    let price = parseInt(data.interaction.options.getString("price"), 10);
    if (!isNaN(price)) {
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

      const ownTokenIds = [];
      const nftBalance = await data.contracts.NFT.methods
        .balanceOf(address)
        .call();
      for (let i = 0; i < nftBalance; i++) {
        const id = await data.contracts.NFT.methods
          .tokenOfOwnerByIndex(address, i)
          .call();
        ownTokenIds.push(id);
      }

      const treasuryTokenIds = [];
      const member = await data.interaction.guild.members.fetch(
        data.interaction.user.id
      );
      const treasurer = member.roles.cache.some(
        (role) => role.name === data.treasurerRoleName
      );
      if (treasurer) {
        const nftBalance = await data.contracts.NFT.methods
          .balanceOf(data.treasuryAddress)
          .call();
        for (let i = 0; i < nftBalance; i++) {
          const id = await data.contracts.NFT.methods
            .tokenOfOwnerByIndex(data.treasuryAddress, i)
            .call();
          treasuryTokenIds.push(id);
        }
      }

      // const store = await getStore();
      if (ownTokenIds.includes(tokenId)) {
        let status, buyId;
        try {
          const isApproved = await data.contracts.NFT.methods
            .isApprovedForAll(address, data.contracts["Trade"]._address)
            .call();
          if (!isApproved) {
            await runSidechainTransaction(mnemonic)(
              "NFT",
              "setApprovalForAll",
              data.contracts["Trade"]._address,
              true
            );
          }
          // buyId = await contracts.Trade.methods.addStore(tokenId, price).call();
          const buySpec = await data.runSidechainTransaction(mnemonic)(
            "Trade",
            "addStore",
            tokenId,
            price
          );
          // console.log('got buy spec', JSON.stringify(buySpec, null, 2));
          buyId = parseInt(buySpec.logs[0].topics[1]);

          status = true;
        } catch (err) {
          console.warn(err.stack);
          status = false;
          buyId = -1;
        }

        if (status) {
         data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: sale #" +
              buyId +
              ": NFT " +
              tokenId +
              " for " +
              price +
              " FT",
            ephemeral: this.isHidden,
          });
        } else {
         data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: failed to list nft: " +
              tokenId,
            ephemeral: this.isHidden,
          });
        }
      } else if (treasuryTokenIds.includes(tokenId)) {
        let status, buyId;
        try {
          const isApproved = await data.contracts.NFT.methods
            .isApprovedForAll(address, data.contracts["Trade"]._address)
            .call();
          if (!isApproved) {
            await data.runSidechainTransaction(data.treasuryMnemonic)(
              "NFT",
              "setApprovalForAll",
              data.contracts["Trade"]._address,
              true
            );
          }
          const buySpec = await data.runSidechainTransaction(
            data.treasuryMnemonic
          )("Trade", "addStore", tokenId, price);
          buyId = parseInt(buySpec.logs[0].topics[1]);

          status = true;
        } catch (err) {
          console.warn(err.stack);
          status = false;
          buyId = -1;
        }

        if (status) {
         data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: sale #" +
              buyId +
              ": NFT " +
              tokenId +
              " for " +
              price +
              " FT",
            ephemeral: this.isHidden,
          });
        } else {
         data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: failed to list nft: " +
              tokenId,
            ephemeral: this.isHidden,
          });
        }
      } else {
       data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: not your nft: " + tokenId,
          ephemeral: this.isHidden,
        });
      }
    } else {
     data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid price: " + price,
        ephemeral: this.isHidden,
      });
    }
  },
};
