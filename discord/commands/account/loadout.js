const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const { previewHost, previewExt } = require("../../../constants");
const bip39 = require("bip39");
const { jsonParse } = require("../../../utilities");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("loadout")
    .setDescription("Set loadout NFT [1-8] to [id]")
    .addStringOption((option) =>
      option.setName("number").setRequired(true).setDescription("Number")
    )
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    let { mnemonic } = await data._getUser();
    if (!mnemonic) {
      const spec = await data._genKey();
      mnemonic = spec.mnemonic;
    }

    const index = parseInt(data.interaction.options.getString("number"), 10);
    const contentId = split[2];
    const id = parseInt(data.interaction.options.getString("id"), 10);

    async function getLoadout(address) {
      const loadoutString = await data.contracts.Account.methods
        .getMetadata(address, "loadout")
        .call();
      let loadout = jsonParse(loadoutString);
      if (!Array.isArray(loadout)) {
        loadout = [];
      }
      while (loadout.length < 8) {
        loadout.push(null);
      }
      return loadout;
    }

    if (index >= 1 && index <= 8) {
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

      if (!isNaN(id)) {
        const hash = await data.contracts.NFT.methods.getHash(id).call();
        const [name, ext] = await Promise.all([
          contracts.NFT.methods.getMetadata(hash, "name").call(),
          contracts.NFT.methods.getMetadata(hash, "ext").call(),
        ]);

        const itemPreview = `${previewHost}/${hash}${
          ext ? "." + ext : ""
        }/preview.${previewExt}`;

        const loadout = await getLoadout(address);
        loadout.splice(index - 1, 1, [id + "", name, ext, itemPreview]);

        await data.runSidechainTransaction(mnemonic)(
          "Account",
          "setMetadata",
          address,
          "loadout",
          JSON.stringify(loadout)
        );

        data.interaction.editReply({
          content: "<@!" + data.interaction.user.id + ">: updated loadout",
          ephemeral: this.isHidden,
        });
      } else {
        const o = url.parse(contentId);
        const match = o.path.match(/\/([^\/]+)$/);
        const fileName = match ? match[1] : "";
        const ext = path.extname(fileName).slice(1);
        const name = ext ? fileName.slice(0, -(ext.length + 1)) : fileName;

        if (ext) {
          const itemPreview = `${previewHost}/[${contentId}]/preview.${previewExt}`;

          const loadout = await getLoadout(address);
          loadout.splice(index - 1, 1, [contentId, name, ext, itemPreview]);

          await data.runSidechainTransaction(mnemonic)(
            "Account",
            "setMetadata",
            address,
            "loadout",
            JSON.stringify(loadout)
          );

          data.interaction.editReply({
            content: "<@!" + data.interaction.user.id + ">: updated loadout",
            ephemeral: this.isHidden,
          });
        } else {
          data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: content id is not `[number|URL with extension]`: " +
              contentId,
            ephemeral: this.isHidden,
          });
        }
      }
    } else {
      const wallet = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address = wallet.getAddressString();

      const loadout = await getLoadout(address);

      data.interaction.editReply({
        content:
          "<@!" +
          this.data.interaction.user.id +
          ">: loadout:\n```" +
          loadout
            .map(
              (item, index) =>
                `${index + 1}: ${
                  item !== null ? `[${item[0]}] ${item[1]} ${item[2]}` : "empty"
                }`
            )
            .join("\n") +
          "```",
        ephemeral: this.isHidden,
      });
    }
  },
};
