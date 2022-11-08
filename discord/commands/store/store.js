const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("store")
    .setDescription("Show store")
    .addUserOption((option) =>
      option.setName("user").setRequired(false).setDescription("Select User")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;

    let address;
    if (isUser) {
      const userId = user.id;
      let { mnemonic } = await data._getUser(userId);
      if (!mnemonic) {
        const spec = await data._genKey(userId);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      address = wallet.getAddressString();
    } else {
      address = data.treasuryAddress;
    }

    const booths = await data.getStores();

    let s = "";
    const booth = booths.find((booth) => booth.seller === address);
    if (booth && booth.entries.length > 0) {
      try {
        const [names, packedBalances] = await Promise.all([
          Promise.all(
            booth.entries.map(async (entry) => {
              const hash = await data.contracts.NFT.methods
                .getHash(entry.tokenId)
                .call();
              const name = await data.contracts.NFT.methods
                .getMetadata(hash, "name")
                .call();
              return name;
            })
          ),
          Promise.all(
            booth.entries.map(async (entry) => {
              const packedBalance = await data.contracts.NFT.methods
                .getPackedBalance(entry.tokenId)
                .call();
              return packedBalance;
            })
          ),
        ]);

        s +=
          (booth.seller !== data.treasuryAddress ? booth.seller : "treasury") +
          "'s store: ```" +
          booth.entries
            .map(
              (entry, i) =>
                `#${entry.id}: NFT ${entry.tokenId} (${names[i]}${
                  packedBalances[i] > 0 ? " + " + packedBalances[i] + " FT" : ""
                }) for ${entry.price.toNumber()} FT`
            )
            .join("\n") +
          "```";
      } catch (err) {
        console.warn(err);
      }
    } else {
      s +=
        (address !== data.treasuryAddress ? address : "treasury") +
        "'s store: ```empty```";
    }
    data.interaction.editReply({ content: s, ephemeral: this.isHidden });
    /* } else if (split[0] === prefix + 'treasury') {
                  const member = await message.channel.guild.members.fetch(data.interaction.user.id);
                  const treasurer = member.roles.cache.some(role => role.name === treasurerRoleName);
                  message.channel.send('treasurer flag: ' + treasurer); */
  },
};
