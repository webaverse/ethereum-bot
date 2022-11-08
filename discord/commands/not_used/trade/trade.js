const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");
const { trades, updateTradeId } = require("../../discordbot");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Start a trade with")
    .addUserOption((option) =>
      option.setName("user").setRequired(false).setDescription("Select User")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;
    const userId = user?.id;

    if (isUser) {
      const tradeId = updateTradeId(true);
      const headerLeft =
        "   Trade #" +
        tradeId +
        " " +
        data.interaction.user.username.padStart(8);
      const headerMiddle = " | ";
      const headerRight = user.username.padStart(8);
      const header = headerLeft + headerMiddle + headerRight;
      const userIds = [data.interaction.user.id, userId];
      const fts = [0, 0];
      const nfts = [[], []];
      const confirmations = [false, false];
      const confirmations2 = [false, false];
      const cancelledSpec = { cancelled: false };
      const tradingSpec = { trading: false };
      const finishedSpec = { finished: false };
      const _renderFts = () => {
        let s = "";
        if (fts.some((ft) => ft > 0)) {
          s +=
            (
              (fts[0] ? "+ " + fts[0] : "") +
              Array(headerLeft.length + 1).join(" ")
            ).slice(0, headerLeft.length) +
            headerMiddle +
            (
              (fts[1] ? "+ " + fts[1] : "") +
              Array(headerRight.length + 1).join(" ")
            ).slice(0, headerRight.length) +
            "\n";
        }
        return s;
      };
      const _renderNfts = () => {
        let s = "";
        const maxNumItems = Math.max(nfts[0].length, nfts[1].length);
        for (let i = 0; i < maxNumItems; i++) {
          const rowItems = [nfts[0][i], nfts[1][i]];
          const label = (i + ".  ").slice(0, 3);
          s +=
            (
              label +
              (rowItems[0] || "") +
              Array(headerLeft.length + 1).join(" ")
            ).slice(0, headerLeft.length) +
            headerMiddle +
            (
              (rowItems[1] || "") + Array(headerRight.length + 1).join(" ")
            ).slice(0, headerRight.length) +
            "\n";
        }
        return s;
      };
      const _renderConfirmations = () => {
        return (
          (
            (confirmations[0] ? "OK" : "") +
            Array(headerLeft.length + 1).join(" ")
          ).slice(0, headerLeft.length) +
          Array(headerMiddle.length + 1).join(" ") +
          (
            (confirmations[1] ? "OK" : "") +
            Array(headerRight.length + 1).join(" ")
          ).slice(0, headerLeft.length) +
          "\n"
        );
      };
      const _renderStatus = () => {
        return (
          (cancelledSpec.cancelled ? "[CANCELLED]\n" : "") +
          (tradingSpec.trading ? "[TRADING...]\n" : "") +
          (finishedSpec.finished ? "[FINISHED]\n" : "")
        );
      };
      const _render = () => {
        return (
          "```" +
          header +
          "\n" +
          Array(header.length + 1).join("-") +
          "\n" +
          _renderFts() +
          _renderNfts() +
          _renderConfirmations() +
          _renderStatus() +
          "```"
        );
      };

      const m = await data.interaction.editReply({
        content: _render(),
        ephemeral: this.isHidden,
      });
      if (data.client.channels.cache.has(m.channelId)) {
        m.react("✅").then(() => m.react("❌"));
      }
      m.tradeId = tradeId;
      m.userIds = userIds;
      m.fts = fts;
      m.nfts = nfts;
      m.confirmations = confirmations;
      m.confirmations2 = confirmations2;
      m.cancelledSpec = cancelledSpec;
      m.tradingSpec = tradingSpec;
      m.finishedSpec = finishedSpec;
      m.addFt = (userId, amount) => {
        const index = userIds.indexOf(userId);
        if (index >= 0) {
          m.fts[index] = amount;
          m.render();
        }
      };
      m.addNft = (userId, item) => {
        const index = userIds.indexOf(userId);
        if (index >= 0) {
          m.nfts[index].push(item);
          m.render();
        }
      };
      m.removeNft = (userId, itemNumber) => {
        const index = userIds.indexOf(userId);
        if (index >= 0) {
          m.nfts[index].splice(itemNumber, 1);
          m.render();
        }
      };
      m.render = () => {
        m.edit(_render());
      };
      m.cancel = () => {
        cancelledSpec.cancelled = true;
        m.render();
      };
      m.finish = async () => {
        tradingSpec.trading = true;
        m.render();

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

        const mnemonics = [];
        const addresses = [];
        for (const userId of userIds) {
          let { mnemonic } = await data._getUser(userId);
          if (!mnemonic) {
            const spec = await data._genKey(userId);
            mnemonic = spec.mnemonic;
          }
          const wallet = hdkey
            .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
            .derivePath(`m/44'/60'/0'/0/0`)
            .getWallet();
          const address = wallet.getAddressString();

          {
            let allowance = await data.contracts.FT.methods
              .allowance(address, data.contracts["Trade"]._address)
              .call();
            allowance = new data.web3.utils.BN(allowance, 10);
            if (allowance.lt(fullAmountD2.v)) {
              await data.runSidechainTransaction(mnemonic)(
                "FT",
                "approve",
                data.contracts["Trade"]._address,
                fullAmount.v
              );
            }
          }
          {
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
          }

          mnemonics.push(mnemonic);
          addresses.push(address);
        }

        await data.runSidechainTransaction(tradeMnemonic)(
          "Trade",
          "trade",
          addresses[0],
          addresses[1],
          fts[0] !== undefined ? fts[0] : 0,
          fts[1] !== undefined ? fts[1] : 0,
          nfts[0][0] !== undefined ? nfts[0][0] : 0,
          nfts[1][0] !== undefined ? nfts[1][0] : 0,
          nfts[0][1] !== undefined ? nfts[0][1] : 0,
          nfts[1][1] !== undefined ? nfts[1][1] : 0,
          nfts[0][2] !== undefined ? nfts[0][2] : 0,
          nfts[1][2] !== undefined ? nfts[1][2] : 0
        );

        tradingSpec.trading = false;
        finishedSpec.finished = true;
        m.render();

        data.interaction.editReply({
          content: "```trade #" + tradeId + " complete! enjoy!```",
          ephemeral: this.isHidden,
        });
      };
      trades.push(m);
    } else {
      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: invalid trade peer: " +
          user.id,
        ephemeral: this.isHidden,
      });
    }
  },
};
