const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const { helps } = require("../../discordbot");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("packs")
    .setDescription("Check packed NFT balances")
    .addStringOption((option) =>
      option.setName("nftid").setDescription("Select NFT ID").setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Select User, leave empty for treasury")
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
    const nftid = data.interaction.options.getString("nftid");
    const _address = data.interaction.options.getString("address");

    let match;
    if (!isNaN(nftid)) {
      const packedBalance = await data.contracts.NFT.methods
        .getPackedBalance(nftid)
        .call();
      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: packed balance of #" +
          nftid +
          ": " +
          packedBalance,
        ephemeral: this.isHidden,
      });
    } else {
      let address, userLabel;
      const _loadFromUserId = async (userId) => {
        const spec = await data._getUser(userId);
        let mnemonic = spec.mnemonic;
        if (!mnemonic) {
          const spec = await data._genKey(userId);
          mnemonic = spec.mnemonic;
        }

        const wallet = hdkey
          .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
          .derivePath(`m/44'/60'/0'/0/0`)
          .getWallet();
        address = wallet.getAddressString();

        userLabel = "<@!" + userId + ">";
      };
      const _loadFromAddress = (a) => {
        address = a;
        userLabel = "`0x" + a + "`";
      };
      const _loadFromTreasury = () => {
        const wallet = hdkey
          .fromMasterSeed(bip39.mnemonicToSeedSync(data.treasuryMnemonic))
          .derivePath(`m/44'/60'/0'/0/0`)
          .getWallet();
        address = wallet.getAddressString();
        userLabel = "treasury";
      };
      if (isUser) {
        await _loadFromUserId(user.id);
      } else if ((match = _address.match(/^0x([0-9a-f]+)$/i))) {
        _loadFromAddress(match[1]);
      } else {
        _loadFromTreasury();
      }

      const nftBalance = await data.contracts.NFT.methods
        .balanceOf(address)
        .call();
      const packedBalances = [];
      for (let i = 0; i < nftBalance; i++) {
        const id = await data.contracts.NFT.methods
          .tokenOfOwnerByIndex(address, i)
          .call();
        const packedBalance = await data.contracts.NFT.methods
          .getPackedBalance(id)
          .call();
        if (packedBalance > 0) {
          packedBalances.push({
            id,
            packedBalance,
          });
        }
      }

      let s = userLabel + "'s packs:\n";
      if (packedBalances.length > 0) {
        s +=
          "```" +
          packedBalances
            .map((pack, i) => `${pack.id}. contains ${pack.packedBalance} FT`)
            .join("\n") +
          "```";
      } else {
        s += "```packs empty```";
      }
      const m = awaitdata.interaction.editReply({
        content: s,
        ephemeral: this.isHidden,
      });
      m.react("❌");
      m.requester = data.interaction.user;
      helps.push(m);
    }
  },
};
