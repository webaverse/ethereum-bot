const { SlashCommandBuilder } = require("@discordjs/builders");
const prettyBytes = require("pretty-bytes");
const { EmbedBuilder } = require("discord.js");
const { embedColor } = require("../../discord_utils");
const { helps } = require("../../discordbot");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("inspect")
    .setDescription("Inspects nft")
    .addIntegerOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tokenId = data.interaction.options.getInteger("id");

    const token = await data.contracts.NFT.methods
      .tokenByIdFull(tokenId)
      .call();
    // console.log('got token', token);
    const minterAddress = token.minter.toLowerCase();
    const [unlockable, minterName, minterAvatarPreview] = await Promise.all([
      (async () => {
        const key = data.unlockableKey;
        const value = await data.contracts.NFT.methods
          .getMetadata(token.hash, key)
          .call();
        return !!value;
      })(),
      data.contracts.Account.methods.getMetadata(minterAddress, "name").call(),
      data.contracts.Account.methods
        .getMetadata(minterAddress, "avatarPreview")
        .call(),
    ]);
    const editionNumber = 1; // XXX hack
    const collaborators = [token.owner]; // XXX hack
    const sizeString = prettyBytes(100 * 1024); // XXX hack
    const resolutionString = `${1024}x${768}`; // XXX hack

    const itemPreview = `https://preview.webaverse.com/${token.hash}.${token.ext}/preview.png`;

    const exampleEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(token.name)
      .setURL(`https://webaverse.com/assets/${token.id}`)
      .setDescription(token.description || "What a mysterious item.")
      .setThumbnail(itemPreview)
      .addFields(
        { name: "content hash", value: token.hash },
        { name: "edition number", value: editionNumber + " (est.)" },
        { name: "edition size", value: token.totalSupply + "" },
        { name: "file type", value: token.ext },
        { name: "file size", value: sizeString + " (est.)" },
        { name: "file resolution", value: resolutionString + " (est.)" },
        { name: "collaborators", value: collaborators.join(", ") + " (est.)" },
        { name: "has unlockable?", value: unlockable ? "yes" : "no" }
      )
      // .addField('Inline field title', 'Some value here', true)
      .setImage(itemPreview)
      .setTimestamp()
      .setFooter({
        text: ".help for help\nhttps://app.webaverse.com/assets/logo-flat.svg",
      });
    const m = await data.interaction.editReply({
      embeds: [exampleEmbed],
      ephemeral: this.isHidden,
    });
    if (data.client.channels.cache.has(m.channelId)) {
      m.react("❌");
    }
    m.requester = data.interaction.user;
    helps.push(m);
  },
};
