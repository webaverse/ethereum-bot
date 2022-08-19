const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");
const crypto = require("crypto");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("login")
    .setDescription("Login link (DM)"),
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
      await ddb
        .putItem({
          TableName: data.usersTableName,
          Item: {
            email: { S: id + ".code" },
            code: { S: code },
          },
        })
        .promise();

      const m = await data.interaction.user.send(
        `Login: https://webaverse.com/login?id=${id}&code=${code}`
      );
    } else {
      const discordName = data.interaction.userusername;
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

      const m = await data.interaction.user.send(
        `Login: https://app.webaverse.com/login?id=${id}&code=${code}`
      );
    }
  },
};
