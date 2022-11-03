const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const { trades } = require("../../discordbot");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("addnft")
    .setDescription("Add NFT to trade [tradeiId]")
    .addStringOption((option) =>
      option.setName("tradeid").setRequired(true).setDescription("Trade ID")
    )
    .addStringOption((option) =>
      option.setName("nftid").setRequired(true).setDescription("NFT ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tradeId = parseInt(data.interaction.options.getString("tradeid"), 10);
    const trade = trades.find((trade) => trade.tradeId === tradeId);
    if (trade) {
      const index = trade.userIds.indexOf(data.interaction.user.id);
      if (index >= 0) {
        const id = data.interaction.options.getString("nftid");
        const amount = 1;

        if (!trade.nfts[index].includes(id)) {
          const hash = await data.contracts.NFT.methods.getHash(id).call();
          if (hash) {
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

            const balance = await data.contracts.NFT.methods
              .balanceOfHash(address, hash)
              .call();

            if (balance > 0) {
              if (trade.nfts[index].length < 3) {
                trade.addNft(data.interaction.user.id, id);

                const doneReactions = trade.reactions.cache.filter(
                  (reaction) => reaction.emoji.identifier === "%E2%9C%85"
                );
                try {
                  for (const reaction of doneReactions.values()) {
                    const users = Array.from(reaction.users.cache.values());
                    for (const user of users) {
                      if (user.id !== data.client.user.id) {
                        await reaction.users.remove(user.id);
                      }
                    }
                  }
                } catch (error) {
                  console.error("Failed to remove reactions.", error.stack);
                }
              } else {
                data.interaction.editReply({
                  content:
                    "<@!" +
                    data.interaction.user.id +
                    ">: too many nfts in trade: " +
                    tradeId,
                  ephemeral: this.isHidden,
                });
              }
            } else {
              data.interaction.editReply({
                content:
                  "<@!" + data.interaction.user.id + ">: not your nft: " + id,
                ephemeral: this.isHidden,
              });
            }
          } else {
            data.interaction.editReply({
              content:
                "<@!" + data.interaction.user.id + ">: invalid nft: " + id,
              ephemeral: this.isHidden,
            });
          }
        } else {
          data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: already trading nft: " +
              id,
            ephemeral: this.isHidden,
          });
        }
      } else {
        data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: not your trade: " + tradeId,
          ephemeral: this.isHidden,
        });
      }
    } else {
      data.interaction.editReply({
        content:
          "<@!" + data.interaction.user.id + ">: invalid trade: " + tradeId,
        ephemeral: this.isHidden,
      });
    }
  },
};
