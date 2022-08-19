const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const Web3 = require("web3");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Redeem NFT roles"),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

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

    const rinkebyWeb3 = new Web3(
      new Web3.providers.HttpProvider(
        `https://rinkeby.infura.io/v3/${infuraProjectId}`
      )
    );
    const signature = await data.contracts.Account.methods
      .getMetadata(address, "mainnetAddress")
      .call();
    let mainnetAddress;
    if (signature !== "") {
      mainnetAddress = await rinkebyWeb3.eth.accounts.recover(
        "Connecting mainnet address.",
        signature
      );
    } else {
      data.interaction.editReply({
        content: "<@!" + data.interaction.user.id + ">: no role redeemed.",
        ephemeral: this.isHidden,
      });
      return;
    }

    let roleRedeemed = null;

    const mainnetNft = new rinkebyWeb3.eth.Contract(
      abis["NFT"],
      addresses["mainnet"]["NFT"]
    );
    const nftMainnetBalance = await mainnetNft.methods
      .balanceOf(mainnetAddress)
      .call();

    const mainnetPromises = Array(nftMainnetBalance);
    for (let i = 0; i < nftMainnetBalance; i++) {
      const token = await mainnetNft.methods
        .tokenOfOwnerByIndexFull(mainnetAddress, i)
        .call();
      mainnetPromises[i] = token;
      if (token.id >= genesisNftStartId && token.id <= genesisNftEndId) {
        const genesisRole = data.interaction.guild.roles.cache.find(
          (role) => role.name === "Genesis"
        );
        if (!data.interaction.user.cache.has(genesisRole.id)) {
          data.interaction.user.roles.add(genesisRole).catch(console.error);
          roleRedeemed = "Genesis";
        } else {
          roleRedeemed = "You already had the Genesis role!";
        }
      }
    }
    const mainnetTokens = await Promise.all(mainnetPromises);

    if (roleRedeemed) {
      data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: redeemed role: " +
          roleRedeemed,
        ephemeral: this.isHidden,
      });
    } else {
      data.interaction.editReply({
        content: "<@!" + data.interaction.user.id + ">: no role redeemed.",
        ephemeral: this.isHidden,
      });
    }
  },
};
