const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send [amount] of SILK to user/address")
    .addNumberOption((option) =>
      option.setName("amount").setRequired(true).setDescription("Amount")
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

    const amount = data.interaction.options.getNumber("amount");
    const user = data.interaction.options.getUser("user");
    const isUser = user && user !== undefined;
    const _address = data.interaction.options.getString("address");

    if (isUser) {
      const userId = user?.id;
      let mnemonic, mnemonic2;
      if (userId !== data.interaction.user.id) {
        {
          const userSpec = await data._getUser();
          mnemonic = userSpec.mnemonic;
          if (!mnemonic) {
            const spec = await data._genKey();
            mnemonic = spec.mnemonic;
          }
        }
        {
          const userSpec = await data._getUser(user.id);
          mnemonic2 = userSpec.mnemonic;
          if (!mnemonic2) {
            const spec = await data._genKey(userId);
            mnemonic2 = spec.mnemonic;
          }
        }
      } else {
        const member = await data.interaction.guild.members.fetch(
          data.interaction.user.id
        );
        const treasurer = member.roles.cache.some(
          (role) => role.name === data.treasurerRoleName
        );
        if (treasurer) {
          mnemonic = treasuryMnemonic;
          {
            const userSpec = await data._getUser();
            mnemonic2 = userSpec.mnemonic;
            if (!mnemonic2) {
              const spec = await data._genKey();
              mnemonic2 = spec.mnemonic;
            }
          }
        } else {
          data.interaction.editReply({
            content:
              "<@!" + data.interaction.user.id + ">: you are not a treasurer",
            ephemeral: this.isHidden,
          });

          return;
        }
      }

      const wallet2 = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic2))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address2 = wallet2.getAddressString();

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "FT",
          "transfer",
          address2,
          amount
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: sent " +
            amount +
            " SILK to <@!" +
            userId +
            ">",
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: could not send: " +
            transactionHash,
          ephemeral: this.isHidden,
        });
      }
    } else if ((match = _address?.match(/(0x[0-9a-f]+)/i))) {
      let { mnemonic } = await data._getUser();
      if (!mnemonic) {
        const spec = await data._genKey();
        mnemonic = spec.mnemonic;
      }

      const address2 = match[1];

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "FT",
          "transfer",
          address2,
          amount
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: sent " +
            amount +
            " SILK to " +
            address2,
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: could not send: " +
            transactionHash,
          ephemeral: this.isHidden,
        });
      }
    } else {
      let { mnemonic } = await data._getUser();
      if (!mnemonic) {
        const spec = await data._genKey();
        mnemonic = spec.mnemonic;
      }

      const wallet2 = hdkey
        .fromMasterSeed(bip39.mnemonicToSeedSync(data.treasuryMnemonic))
        .derivePath(`m/44'/60'/0'/0/0`)
        .getWallet();
      const address2 = wallet2.getAddressString();

      let status, transactionHash;
      try {
        const result = await data.runSidechainTransaction(mnemonic)(
          "FT",
          "transfer",
          address2,
          amount
        );
        status = result.status;
        transactionHash = result.transactionHash;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        transactionHash = "0x0";
      }

      if (status) {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: sent " +
            amount +
            " SILK to treasury",
          ephemeral: this.isHidden,
        });
      } else {
        data.interaction.editReply({
          content:
            "<@!" +
            data.interaction.user.id +
            ">: could not send: " +
            transactionHash,
          ephemeral: this.isHidden,
        });
      }
    }
  },
};
