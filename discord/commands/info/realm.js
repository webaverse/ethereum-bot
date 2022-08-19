const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const crypto = require("crypto");
const { hdkey } = require("ethereumjs-wallet");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("realm")
    .setDescription("Play link to realm [1-5] (DM)")
    .addStringOption((option) =>
      option.setName("id").setRequired(true).setDescription("Realm ID")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = data.interaction.user.id;
    let realmId = parseInt(data.interaction.options.getString("id"), 10);

    const code = new Uint32Array(crypto.randomBytes(4).buffer, 0, 1)
      .toString(10)
      .slice(-6);
    await data.ddb
      .putItem({
        TableName: data.usersTableName,
        Item: {
          email: { S: id + ".code" },
          code: { S: code },
        },
      })
      .promise();

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

    const currentName = await data.contracts.Account.methods
      .getMetadata(address, "name")
      .call();

    if (currentName) {
      const code = new Uint32Array(crypto.randomBytes(4).buffer, 0, 1)
        .toString(10)
        .slice(-6);
      await data.ddb
        .putItem({
          TableName: data.usersTableName,
          Item: {
            email: { S: id + ".code" },
            code: { S: code },
          },
        })
        .promise();

      if (isNaN(realmId)) {
        data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: must add realm id. (1-5)",
          ephemeral: this.isHidden,
        });
      } else {
        if (realmId >= 1 && realmId <= 5) {
          await data.interaction.deleteReply();
          const m = await data.interaction.user.send(
            `Play: https://webaverse.com/login?id=${id}&code=${code}&play=true&realmId=${realmId}`
          );
        } else {
          data.interaction.editReply({
            content: "Realm",
            ephemeral: this.isHidden,
          });
          message.channel.send(
            "<@!" +
              data.interaction.user.id +
              ">: realm id must be between 1-5."
          );
        }
      }
    } else {
      const discordName = data.interaction.user.username;
      const result = await data.runSidechainTransaction(mnemonic)(
        "Account",
        "setMetadata",
        address,
        "name",
        discordName
      );

      const code = new Uint32Array(crypto.randomBytes(4).buffer, 0, 1)
        .toString(10)
        .slice(-6);
      await data.ddb
        .putItem({
          TableName: data.usersTableName,
          Item: {
            email: { S: id + ".code" },
            code: { S: code },
          },
        })
        .promise();

      if (isNaN(realmId)) {
        data.interaction.editReply({
          content:
            "<@!" + data.interaction.user.id + ">: must add realm id. (1-5)",
          ephemeral: this.isHidden,
        });
      } else {
        if (realmId >= 1 && realmId <= 5) {
          await data.interaction.deleteReply();
          const m = await data.interaction.user.send(
            `Play: https://webaverse.com/login?id=${id}&code=${code}&play=true&realmId=${realmId}`
          );
        } else {
          data.interaction.editReply({
            content:
              "<@!" +
              data.interaction.user.id +
              ">: realm id must be between 1-5.",
            ephemeral: this.isHidden,
          });
        }
      }
    }
  },
};
