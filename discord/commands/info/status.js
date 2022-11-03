const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const Discord = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { embedColor } = require("../../discord_utils.js");
const { helps } = require("../../discordbot.js");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Shows account details")
    .addUserOption((option) =>
      option.setName("user").setDescription("Select User").setRequired(false)
    ),
  async execute(data) {
    //     awaitdata.interaction.editReply('Status received');
    let userId, mnemonic;
    if (data.interaction.options.getUser("user")) {
      userId = data.interaction.options.getUser("user").id;
    } else {
      userId = data.interaction.user.id;
    }
    const spec = await data._getUser(userId);
    mnemonic = spec.mnemonic;
    if (!mnemonic) {
      const spec = await data._genKey(userId);
      mnemonic = spec.mnemonic;
    }

    const wallet = hdkey
      .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
      .derivePath(`m/44'/60'/0'/0/0`)
      .getWallet();
    const address = wallet.getAddressString();
    const [
      name,
      description,
      avatarId,
      homeSpaceId,
      monetizationPointer,
      avatarPreview,
    ] = await Promise.all([
      data.contracts.Account.methods.getMetadata(address, "name").call(),
      data.contracts.Account.methods.getMetadata(address, "description").call(),
      data.contracts.Account.methods.getMetadata(address, "avatarId").call(),
      data.contracts.Account.methods.getMetadata(address, "homeSpaceId").call(),
      data.contracts.Account.methods
        .getMetadata(address, "monetizationPointer")
        .call(),
      data.contracts.Account.methods
        .getMetadata(address, "avatarPreview")
        .call(),
    ]);

    const exampleEmbed =
      avatarPreview && avatarPreview?.length > 0
        ? new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(name || "No name")
            .setURL(`https://webaverse.com/creators/${address}`)
            // .setAuthor('Some name', 'https://i.imgur.com/wSTFkRM.png', 'https://discord.js.org')
            .setDescription(
              description || "This person is a noob without a description."
            )
            .setThumbnail(avatarPreview)
            .addFields(
              { name: "avatar id", value: avatarId || "<none>" },
              { name: "homespace id", value: homeSpaceId || "<none>" },
              {
                name: "monetization pointer",
                value: monetizationPointer || "<none>",
              }
            )
            // .addField('Inline field title', 'Some value here', true)
            .setImage(avatarPreview)
            .setTimestamp()
            .setFooter({
              text: "/help for help\nhttps://app.webaverse.com/assets/logo-flat.svg",
            })
        : new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(name || "No name")
            .setURL(`https://webaverse.com/creators/${address}`)
            // .setAuthor('Some name', 'https://i.imgur.com/wSTFkRM.png', 'https://discord.js.org')
            .setDescription(
              description || "This person is a noob without a description."
            )
            .addFields(
              { name: "avatar id", value: avatarId || "<none>" },
              { name: "homespace id", value: homeSpaceId || "<none>" },
              {
                name: "monetization pointer",
                value: monetizationPointer || "<none>",
              }
            )
            // .addField('Inline field title', 'Some value here', true)
            .setTimestamp()
            .setFooter({
              text: "/help for help\nhttps://app.webaverse.com/assets/logo-flat.svg",
            });
    const m = await data.interaction.editReply({ embeds: [exampleEmbed] });
    if (data.client.channels.cache.has(m.channelId)) {
      m.react("❌");
    }
    m.requester = data.interaction.user;
    helps.push(m);
  },
};
