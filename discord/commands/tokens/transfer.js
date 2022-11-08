const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("transfer")
    .setDescription("Send NFT")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addIntegerOption((option) =>
      option.setName("quantity").setRequired(true).setDescription("Quantity")
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

    const id = parseInt(data.interaction.options.getString("id"), 10);
    if (!isNaN(id)) {
      let quantity = data.interaction.options.getInteger("quantity") ?? 1;
      if (!isNaN(quantity)) {
        if (isUser) {
          const userId = user?.id
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
          } else {
            const member = data.interaction.guild.members.cache.get(user.id);
            const treasurer = member.roles.cache.some(
              (role) => role.name === data.treasurerRoleName
            );
            if (treasurer) {
              mnemonic = data.treasuryMnemonic;
              {
                const userSpec = await data._getUser();
                mnemonic2 = userSpec.mnemonic;
                if (!mnemonic2) {
                  const spec = await data._genKey();
                  mnemonic2 = spec.mnemonic;
                }
              }
            } else {
              data.interaction.editReply({
                content:
                  "<@!" +
                  data.interaction.user.id +
                  ">: you are not a treasurer",
                ephemeral: this.isHidden,
              });

              return;
            }
          }

          const wallet = hdkey
            .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
            .derivePath(`m/44'/60'/0'/0/0`)
            .getWallet();
          const address = wallet.getAddressString();

          const wallet2 = hdkey
            .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic2))
            .derivePath(`m/44'/60'/0'/0/0`)
            .getWallet();
          const address2 = wallet2.getAddressString();

          let status = true,
            transactionHash;
          try {
            const hash = await data.contracts.NFT.methods.getHash(id).call();

            const ids = [];
            const nftBalance = await data.contracts.NFT.methods
              .balanceOf(address)
              .call();
            for (let i = 0; i < nftBalance; i++) {
              const id = await data.contracts.NFT.methods
                .tokenOfOwnerByIndex(address, i)
                .call();
              const hash2 = await data.contracts.NFT.methods.getHash(id).call();
              if (hash2 === hash) {
                ids.push(id);
              }
            }
            ids.sort();

            if (ids.length >= quantity) {
              const isApproved = await data.contracts.NFT.methods
                .isApprovedForAll(address, data.contracts["Trade"]._address)
                .call();
              if (!isApproved) {
                await data.runSidechainTransaction(mnemonic)(
                  "NFT",
                  "setApprovalForAll",
                  data.contracts["Trade"]._address,
                  true
                );
              }

              for (let i = 0; i < quantity; i++) {
                const id = ids[i];
                const result = await data.runSidechainTransaction(mnemonic)(
                  "NFT",
                  "transferFrom",
                  address,
                  address2,
                  id
                );
                status = status && result.status;
                transactionHash = result.transactionHash;
              }
            } else {
              status = false;
              transactionHash = "insufficient nft balance";
            }
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
                ">: transferred " +
                id +
                (quantity > 1 ? `(x${quantity})` : "") +
                " to <@!" +
                userId +
                ">",
              ephemeral: this.isHidden,
            });
          } else {
            data.interaction.editReply({
              content:
                "<@!" +
                data.interaction.user.id +
                ">: could not transfer: " +
                transactionHash,
              ephemeral: this.isHidden,
            });
          }
        } else if ((match = address?.match(/^(0x[0-9a-f]+)$/i))) {
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

          const address2 = match[1];

          let status = true;
          for (let i = 0; i < quantity; i++) {
            try {
              const isApproved = await data.contracts.NFT.methods
                .isApprovedForAll(address, data.contracts["Trade"]._address)
                .call();
              if (!isApproved) {
                await data.runSidechainTransaction(mnemonic)(
                  "NFT",
                  "setApprovalForAll",
                  data.contracts["Trade"]._address,
                  true
                );
              }

              const result = await data.runSidechainTransaction(mnemonic)(
                "NFT",
                "transferFrom",
                address,
                address2,
                id
              );
              status = status && result.status;
            } catch (err) {
              console.warn(err.stack);
              status = false;
              break;
            }
          }

          if (status) {
            data.interaction.editReply({
              content:
                "<@!" +
                data.interaction.user.id +
                ">: transferred " +
                id +
                " to " +
                address2,
              ephemeral: this.isHidden,
            });
          } else {
            data.interaction.editReply({
              content:
                "<@!" +
                data.interaction.user.id +
                ">: could not transfer: " +
                status,
              ephemeral: this.isHidden,
            });
          }
        } else {
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

          const wallet2 = hdkey
            .fromMasterSeed(bip39.mnemonicToSeedSync(data.treasuryMnemonic))
            .derivePath(`m/44'/60'/0'/0/0`)
            .getWallet();
          const address2 = wallet2.getAddressString();

          let status = true;
          for (let i = 0; i < quantity; i++) {
            try {
              const isApproved = await data.contracts.NFT.methods
                .isApprovedForAll(address, data.contracts["Trade"]._address)
                .call();
              if (!isApproved) {
                await data.runSidechainTransaction(mnemonic)(
                  "NFT",
                  "setApprovalForAll",
                  data.contracts["Trade"]._address,
                  true
                );
              }

              const result = await data.runSidechainTransaction(mnemonic)(
                "NFT",
                "transferFrom",
                address,
                address2,
                id
              );
              status = status && result.status;
            } catch (err) {
              console.warn(err.stack);
              status = false;
              break;
            }
          }

          if (status) {
            data.interaction.editReply({
              content:
                "<@!" +
                data.interaction.user.id +
                ">: transferred " +
                id +
                " to treasury",
              ephemeral: this.isHidden,
            });
          } else {
            data.interaction.editReply({
              content:
                "<@!" + data.interaction.user.id + ">: could not transfer",
              ephemeral: this.isHidden,
            });
          }
        }
      } else {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: invalid quantity: " +
            quantity,
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
