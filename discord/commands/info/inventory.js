const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { EmbedBuilder } = require("discord.js");
const { hdkey } = require("ethereumjs-wallet");
const { helps, inventories } = require("../../discordbot");
const { embedColor } = require("../../discord_utils");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Show NFTs")
    .addUserOption((option) =>
      option.setName("user").setRequired(false).setDescription("Select User")
    )
    .addStringOption((option) =>
      option
        .setName("address")
        .setRequired(false)
        .setDescription("Select Address")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;
    const _address = data.interaction.options.getString("address");

    let mnemonic;
    const spec = await data._getUser(data.interaction.user.id);
    mnemonic = spec.mnemonic;
    if (!mnemonic) {
      const spec = await data._genKey(data.interaction.user.id);
      mnemonic = spec.mnemonic;
    }

    const wallet = hdkey
      .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
      .derivePath(`m/44'/60'/0'/0/0`)
      .getWallet();
    const address = wallet.getAddressString();

    let pageIndex = 1;
    let m = null;
    const _renderMessage = ({
      userName,
      avatarPreview,
      page,
      numPages,
      entries,
    }) => {
      return new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${userName}'s inventory`)
        .setAuthor({
          name: data.interaction.user.username,
          iconURL: avatarPreview?.length > 0 ? avatarPreview : undefined,
          url: `https://webaverse.com/creators/${address}`,
        })
        .addFields(
          entries
            .map((entry) => {
              return {
                name: `${entry.id}) ${entry.name}.${entry.ext}`,
                value: ` ${entry.hash} (${entry.balance}/${
                  entry.totalSupply
                }) [${entry.ids.join(",")}]`,
                // inline: true,
              };
            })
            .concat([
              {
                name: "page",
                value: `${page}/${numPages}`,
              },
            ])
        );
    };
    const _render = async () => {
      const o = await data
        ._items(
          "NFT",
          pageIndex,
          user,
          isUser,
          _address
        )(async (address, startIndex, endIndex) => {
          const hashToIds = {};
          const promises = [];
          for (let i = startIndex; i < endIndex; i++) {
            promises.push(
              (async (i) => {
                const id = await contracts.NFT.methods
                  .tokenOfOwnerByIndex(address, i)
                  .call();
                const hash = await contracts.NFT.methods.getHash(id).call();
                if (!hashToIds[hash]) {
                  hashToIds[hash] = [];
                }
                hashToIds[hash].push(id);
              })(i)
            );
          }
          await Promise.all(promises);

          const entries = [];
          await Promise.all(
            Object.keys(hashToIds).map(async (hash) => {
              const ids = hashToIds[hash].sort();
              const id = ids[0];
              const [name, ext, totalSupply] = await Promise.all([
                data.contracts.NFT.methods.getMetadata(hash, "name").call(),
                data.contracts.NFT.methods.getMetadata(hash, "ext").call(),
                data.contracts.NFT.methods.totalSupplyOfHash(hash).call(),
              ]);
              const balance = ids.length;
              entries.push({
                id,
                ids,
                hash,
                name,
                ext,
                balance,
                totalSupply,
              });
            })
          );
          entries.sort((a, b) => a.id - b.id);
          return entries;
        })
        .catch(console.warn);
      const { userLabel, userName, avatarPreview, numPages, entries } = o;
      const exampleEmbed = _renderMessage({
        userName,
        avatarPreview,
        page: pageIndex,
        numPages,
        entries,
      });

      if (!m) {
        m = await data.interaction.editReply({
          embeds: [exampleEmbed],
          ephemeral: this.isHidden,
        });
        m.react("◀️");
        m.react("▶️");
        m.requester = data.interaction.user;
        m.left = () => {
          pageIndex--;
          if (pageIndex < 1) {
            pageIndex = numPages;
          }
          _render();
        };
        m.right = () => {
          pageIndex++;
          if (pageIndex > numPages) {
            pageIndex = 1;
          }
          _render();
        };
        inventories.push(m);

        m.react("❌");
        m.requester = data.interaction.user;
        helps.push(m);
      } else {
        await m.edit(exampleEmbed);
      }
    };
    _render();
  },
};
