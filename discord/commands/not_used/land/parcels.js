const { SlashCommandBuilder } = require("@discordjs/builders");
const { helps } = require("../../discordbot");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("parcels")
    .setDescription("List owned parcels")
    .addIntegerOption((option) =>
      option.setName("page").setRequired(false).setDescription("Page number")
    )
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

    const page = data._getPage();
    const o = await data
      ._items(
        "LAND",
        page,
        user,
        isUser,
        _address
      )(async (address, startIndex, endIndex) => {
        const promises = [];
        for (let i = startIndex; i < endIndex; i++) {
          promises.push(
            (async (i) => {
              const id = await data.contracts.LAND.methods
                .tokenOfOwnerByIndex(address, i)
                .call();
              const [name, hash] = await Promise.all([
                data.contracts.LAND.methods.getHash(id).call(),
                data.contracts.LAND.methods
                  .getSingleMetadata(id, "hash")
                  .call(),
              ]);
              return {
                id,
                name,
                hash,
              };
            })(i)
          );
        }
        const entries = await Promise.all(promises);
        return entries;
      })
      .catch(console.warn);

    const { userLabel, numPages, entries } = o;
    const _print = (userLabel, page, numPages, entries) => {
      let s = userLabel + "'s parcels:\n";
      if (entries.length > 0) {
        s += `Page ${page}/${numPages}` + "\n";
        s +=
          "```" +
          entries
            .map((entry, i) => `${entry.id}. ${entry.name} -> ${entry.hash}`)
            .join("\n") +
          "```";
      } else {
        s += "```no parcels owned```";
      }
      return s;
      w;
    };
    const s = _print(userLabel, page, numPages, entries);
    const m = await data.interaction.editReply({
      content: s,
      ephemeral: this.isHidden,
    });
    if (data.client.channels.cache.has(m.channelId)) {
      m.react("❌");
    }
    m.requester = data.interaction.user;
    helps.push(m);
  },
};
