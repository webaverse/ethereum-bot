const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buy [saleid]")
    .addStringOption((option) =>
      option
        .setName("saleid")
        .setRequired(true)
        .setDescription("Sale ID to buy")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const buyId = parseInt(data.interaction.options.getString("saleid"), 10);

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

    const fullAmount = {
      t: "uint256",
      v: new data.web3.utils.BN(1e9)
        .mul(new data.web3.utils.BN(1e9))
        .mul(new data.web3.utils.BN(1e9)),
    };
    const fullAmountD2 = {
      t: "uint256",
      v: fullAmount.v.div(new data.web3.utils.BN(2)),
    };

    let status, tokenId, price;
    try {
      {
        let allowance = await data.contracts.FT.methods
          .allowance(address, data.contracts["Trade"]._address)
          .call();
        allowance = new data.web3.utils.BN(allowance, 10);
        if (allowance.lt(fullAmountD2.v)) {
          await runSidechainTransaction(mnemonic)(
            "FT",
            "approve",
            data.contracts["Trade"]._address,
            fullAmount.v
          );
        }
      }
      await runSidechainTransaction(mnemonic)("Trade", "buy", buyId);

      const store = await data.contracts.Trade.methods
        .getStoreByIndex(buyId)
        .call();
      tokenId = parseInt(store.id, 10);
      // const seller = store.seller.toLowerCase();
      price = new data.web3.utils.BN(store.price);

      status = true;
    } catch (err) {
      console.warn(err.stack);
      status = false;
    }

    if (status) {
     data.interaction.editReply({
        content:
          "<@!" +
          data.interaction.user.id +
          ">: got sale #" +
          tokenId +
          " for " +
          price.toNumber() +
          " FT. noice!",
        ephemeral: this.isHidden,
      });
    } else {
     data.interaction.editReply({
        content: "<@!" + data.interaction.user.id + ">: buy failed",
        ephemeral: this.isHidden,
      });
    }

    /* let booth = null;
                let entry = null;
                for (const b of store.booths) {
                  for (const e of b.entries) {
                    if (e.id === buyId) {
                      booth = b;
                      entry = e;
                      break;
                    }
                  }
                  if (entry) {
                    break;
                  }
                }
                if (entry) {
                  if (entry.userId !== data.interaction.user.id) {
                    const {tokenId, price} = entry;
    
                    let {mnemonic: userMnemonic} = await _getUser();
                    if (!userMnemonic) {
                      const spec = await _genKey();
                      userMnemonic = spec.mnemonic;
                    }
    
                    let boothMnemonic;
                    if (booth.address === treasuryAddress) {
                      boothMnemonic = treasuryMnemonic;
                    } else {
                      boothMnemonic = null;
                      const tokenItem = await ddb.query({
                        TableName: usersTableName,
                        IndexName: 'address-index',
                        KeyConditionExpression: "#address = :addr",
                        ExpressionAttributeNames:{
                          '#address': 'address',
                        },
                        ExpressionAttributeValues: {
                          ':addr': {
                            S: booth.address,
                          },
                        },
                      }).promise();
                      if (tokenItem && tokenItem.Items && tokenItem.Items.length) {
                        boothMnemonic = tokenItem.Items[0].mnemonic.S;
                      }
                      if (!boothMnemonic) {
                        message.channel.send('<@!' + data.interaction.user.id + '>: failed to look up booth user');
                        return;
                      }
                    }
    
                    const mnemonics = [userMnemonic, boothMnemonic];
                    const addresses = [];
                    for (const mnemonic of mnemonics) {
                      const fullAmount = {
                        t: 'uint256',
                        v: new web3.utils.BN(1e9)
                          .mul(new web3.utils.BN(1e9))
                          .mul(new web3.utils.BN(1e9)),
                      };
    
                      await runSidechainTransaction(mnemonic)('FT', 'approve', contracts['Trade']._address, fullAmount.v);
                      await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts['Trade']._address, true);
    
                      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                      const address = wallet.getAddressString();
                      addresses.push(address);
                    }
                    
                    let status;
                    try {
                      await runSidechainTransaction(mnemonic)(
                        'Trade',
                        'trade',
                        addresses[0], addresses[1],
                        price, 0,
                        0, tokenId,
                        0, 0,
                        0, 0,
                      );
                      
                      status = true;
                    } catch (err) {
                      console.warn(err.stack);
                      status = false;
                    }
    
                    if (status) {
                      booth.entries.splice(booth.entries.indexOf(entry), 1);
                      await setStore(store);
                      message.channel.send('<@!' + data.interaction.user.id + '>: got sale #' + tokenId + ' for ' + price + '. noice!');
                    } else {
                      message.channel.send('<@!' + data.interaction.user.id + '>: buy failed');
                    }
                  } else {
                    message.channel.send('no such sale for user: ' + buyId);
                  }
                } else {
                  message.channel.send('invalid buy id');
                } */
  },
};
