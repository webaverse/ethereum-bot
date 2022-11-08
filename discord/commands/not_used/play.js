const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const crypto = require("crypto");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play link (DM)"),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const id = data.interaction.user.id;

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

      await data.interaction.deleteReply();
      const m = await data.interaction.user.send(
        `Play: https://webaverse.com/login?id=${id}&code=${code}&play=true`
      );
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
      await ddb
        .putItem({
          TableName: data.usersTableName,
          Item: {
            email: { S: id + ".code" },
            code: { S: code },
          },
        })
        .promise();

      await data.interaction.deleteReply();
      const m = await data.interaction.user.send(
        `Play: https://app.webaverse.com/login?id=${id}&code=${code}&play=true`
      );
    }
  },
};
