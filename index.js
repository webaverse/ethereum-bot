const http = require('http');
const https = require('https');
const followRedirects = require('follow-redirects');
const AWS = require('aws-sdk');
/* const flow = {
  sdk: require('@onflow/sdk'),
  types: require('@onflow/types'),
}; */
const Discord = require('discord.js');
// const blockchain = require('./blockchain.js');
const fetch = require('node-fetch');
const wordList = require('./wordlist.json');
// const config = require('./config.json');
// const flowConstants = require('./flow-constants.js');
const Web3 = require('web3');
const bip39 = require('bip39');
const {Transaction} = require('@ethereumjs/tx');
const {default: Common} = require('@ethereumjs/common');
const {hdkey} = require('ethereumjs-wallet');

const {accessKeyId, secretAccessKey, discordApiToken, infuraProjectId} = require('../exokit-backend/config.json');
const awsConfig = new AWS.Config({
  credentials: new AWS.Credentials({
    accessKeyId,
    secretAccessKey,
  }),
  region: 'us-west-1',
});
const ddb = new AWS.DynamoDB(awsConfig);
const guildId = '433492168825634816';
// const channelName = 'token-hax';
const adminUserId = '284377201233887233';
const tableName = 'users';
const prefix = ',';
const storageHost = 'https://storage.exokit.org';
const previewHost = 'https://preview.exokit.org';
const previewExt = 'png';

function getExt(fileName) {
  const match = fileName.match(/\.([^\.]+)$/);
  return match && match[1].toLowerCase();
}

const _runTransaction = async (userKeys, transaction) => {
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      address: userKeys.address,
      privateKey: userKeys.privateKey,
      publicKey: userKeys.publicKey,
      mnemonic: userKeys.mnemonic,

      limit: 100,
      transaction,
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
const _runScript = async script => {
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      limit: 100,
      script,
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
const _runSpec = async (userKeys, spec) => {
  const {transaction, script, args} = spec;
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      address: userKeys.address,
      privateKey: userKeys.privateKey,
      publicKey: userKeys.publicKey,
      mnemonic: userKeys.mnemonic,

      limit: 100,
      transaction,
      script,
      args,
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
const _readStorageHashAsBuffer = async hash => {
  const bs = [];
  const req = await fetch(`${storageHost}/${hash}`);
  if (req.ok) {
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } else {
    return null;
  }
};

(async () => {
  const web3 = new Web3(new Web3.providers.HttpProvider('http://13.56.80.83:8545'));
  const addresses = await fetch('https://contracts.webaverse.com/ethereum/address.js').then(res => res.text()).then(s => JSON.parse(s.replace(/^\s*export\s*default\s*/, '')).sidechain);
  const abis = await fetch('https://contracts.webaverse.com/ethereum/abi.js').then(res => res.text()).then(s => JSON.parse(s.replace(/^\s*export\s*default\s*/, '')));
  // const chainIds = await fetch('https://contracts.webaverse.com/ethereum/chain-id.js').then(res => res.text()).then(s => JSON.parse(s.replace(/^\s*export\s*default\s*/, '')).sidechain);
  const contracts = await (async () => {
    console.log('got addresses', addresses);
    const result = {};
    [
      'Account',
      'FT',
      'NFT',
      'FTProxy',
      'NFTProxy',
    ].forEach(contractName => {
      result[contractName] = new web3.eth.Contract(abis[contractName], addresses[contractName]);
    });
    return result;
  })();
  // const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
  // const address = wallet.getAddressString();

  const runSidechainTransaction = mnemonic => {
    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();

    return async (contractName, method, ...args) => {
      // console.log('run tx', contracts['sidechain'], [contractName, method]);
      const txData = contracts[contractName].methods[method](...args);
      const data = txData.encodeABI();
      const gas = await txData.estimateGas({
        from: address,
      });
      let gasPrice = await web3.eth.getGasPrice();
      gasPrice = parseInt(gasPrice, 10);

      const privateKey = wallet.getPrivateKeyString();
      const nonce = await web3.eth.getTransactionCount(address);
      const privateKeyBytes = Uint8Array.from(web3.utils.hexToBytes(privateKey));

      let tx = Transaction.fromTxData({
        to: contracts[contractName]._address,
        nonce: '0x' + new web3.utils.BN(nonce).toString(16),
        gas: '0x' + new web3.utils.BN(gasPrice).toString(16),
        gasPrice: '0x' + new web3.utils.BN(gasPrice).toString(16),
        gasLimit: '0x' + new web3.utils.BN(1000000).toString(16),
        data,
      }, {
        common: Common.forCustomChain(
          'mainnet',
          {
            name: 'geth',
            networkId: 1,
            chainId: 1337,
          },
          'petersburg',
        ),
      }).sign(privateKeyBytes);
      const rawTx = '0x' + tx.serialize().toString('hex');
      // console.log('signed tx', tx, rawTx);
      const receipt = await web3.eth.sendSignedTransaction(rawTx);
      // console.log('sent tx', receipt);
      return receipt;
    };
  };

  const client = new Discord.Client();

  client.on('ready', async function() {
    console.log(`the client becomes ready to start`);
    console.log(`I am ready! Logged in as ${client.user.tag}!`);
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);

    // console.log('got', client.guilds.cache.get(guildId).members.cache);

    client.on('message', async message => {
      if (!message.author.bot) {
        const _getUser = async (id = message.author.id) => {
          const tokenItem = await ddb.getItem({
            TableName: tableName,
            Key: {
              email: {S: id + '.discordtoken'},
            }
          }).promise();

          let mnemonic = (tokenItem.Item && tokenItem.Item.mnemonic) ? tokenItem.Item.mnemonic.S : null;
          return {mnemonic};
        };
        const _genKey = async (id = message.author.id) => {
          const mnemonic = bip39.generateMnemonic();

          await ddb.putItem({
            TableName: tableName,
            Item: {
              email: {S: id + '.discordtoken'},
              mnemonic: {S: mnemonic},
            }
          }).promise();
          return {mnemonic};
        };
        /* const _ensureBaked = async ({addr, mnemonic}) => {
          const contractSource = await blockchain.getContractSource('isUserAccountBaked.cdc');

          const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
            method: 'POST',
            body: JSON.stringify({
              limit: 100,
              script: contractSource.replace(/ARG0/g, '0x' + addr),
              wait: true,
            }),
          });
          const response = await res.json();
          const isBaked = response.encodedData.value;
          if (!isBaked) {
            const contractSources = await blockchain.getContractSource('bakeUserAccount.json');
            for (const contractSource of contractSources) {
              contractSource.address = addr;
              contractSource.mnemonic = mnemonic;
              contractSource.limit = 100;
              contractSource.wait = true;

              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify(contractSource),
              });
              
              const response = await res.json();
              console.log('baked account result', response);
            }
          }
        }; */

        if (message.channel.type === 'text') {
          // console.log('got message', message);

          /* if (/grease/.test(message.content)) {
            message.author.send('i am NOT grease?!!!!');
          } */
          const split = message.content.split(/\s+/);
          let match;
          if (split[0] === prefix + 'help') {
            message.channel.send(`\`\`\`\
Info
.status - show your account details
.balance - show your FT balance, or that of a user/address
.inventory [@user|0xaddr]? - show your NFTs, or those of a user/address
.address [@user]? - print your address, or that of a user
.key - get your private key in a DM
     - can be used to log into the app

Tokens
.send [@user|0xaddr] [amount] - send [amount] FT to user/address
.transfer [@user|0xaddr] [id] [quantity]? - send [quantity] [id] NFTs to user/address
.preview [id] - show preview of NFT [id] in channel
.gif [id] - show animated gif of NFT [id] in channel
.upload [id] - upload NFT [id] to channel
.get [id] [key] - get metadata key [key] for NFT [id]
.set [id] [key] [value] - set metadata key [key] to [value] for NFT [id]

Account
.name [newname] - set your name to [name] on the chain
.avatar [id] - set your avatar to [id] on the chain

Minting
.mint [count]? - mint [count] FT to yourself (admin only)
.mint [count]? (in the file upload comment) - mint [count] NFT from file upload

Worlds
.createworld - create a world and print its details
.destroyworld [worldID] - destroy world with id [worldId]

Key Management (DM to bot)
.key [new mnemonic key] - set your Discord private key
.key reset - generate and set a new Discord private key

Help
.help - show this info
\`\`\``);
          } else if (split[0] === prefix + 'status') {
            let userId, mnemonic;
            if (split.length >= 2 && (match = split[1].match(/<@!([0-9]+)>/))) {
              userId = match[1];
            } else {
              userId = message.author.id;
            }
            const spec = await _getUser(userId);
            mnemonic = spec.mnemonic;
            if (!mnemonic) {
              const spec = await _genKey(userId);
              mnemonic = spec.mnemonic;
            }

            /* const contractSource = await blockchain.getContractSource('getUserData.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                limit: 100,
                script: contractSource.replace(/ARG0/g, '0x' + addr),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const [name, avatarUrl] = response2.encodedData.value.map(value => value.value && value.value.value); */

            message.channel.send('<@!' + message.author.id + '>: ' + `\`\`\`Name: ${name}\nAvatar: ${avatarUrl}\n\`\`\``);
          } else if (split[0] === prefix + 'name') {
            let {mnemonic} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
            }

            if (split[1]) {
              const contractSource = await blockchain.getContractSource('setUserData.cdc');

              const name = split[1];
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: addr,
                  mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, 'name')
                    .replace(/ARG1/g, name),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              message.channel.send('<@!' + message.author.id + '>: set name to ' + JSON.stringify(name));
            } else {
              const contractSource = await blockchain.getContractSource('getUserData.cdc');

              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  limit: 100,
                  script: contractSource.replace(/ARG0/g, '0x' + addr),
                  wait: true,
                }),
              });
              const response2 = await res.json();
              const [name, avatarUrl] = response2.encodedData.value.map(value => value.value && value.value.value);

              message.channel.send('<@!' + message.author.id + '>: name is ' + JSON.stringify(name));
            }
          } else if (split[0] === prefix + 'avatar') {
            let {mnemonic} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
            }

            if (split[1]) {
              const avatar = split[1];

              const {filename, hash} = await (async () => {
                const contractSource = await blockchain.getContractSource('getNft.cdc');

                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    limit: 100,
                    script: contractSource
                      .replace(/ARG0/g, avatar),
                    wait: true,
                  }),
                });
                const response2 = await res.json();
                const [hash, filename] = response2.encodedData.value.map(value => value.value && value.value.value);
                return {hash, filename};
              })();
              const url = `${storageHost}/${hash}`;
              const ext = getExt(filename);
              const preview = `${previewHost}/${hash}.${ext}/preview.${previewExt}`;
              {
                const contractSource = await blockchain.getContractSource('setUserDataMulti.cdc');

                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 100,
                    transaction: contractSource
                      .replace(/ARG0/g, JSON.stringify(['avatarUrl', 'avatarFilename', 'avatarPreview']))
                      .replace(/ARG1/g, JSON.stringify([url, filename, preview])),
                    wait: true,
                  }),
                });
                const response2 = await res.json();
              }

              message.channel.send('<@!' + message.author.id + '>: set avatar to ' + JSON.stringify(avatar));
            } else {
              const contractSource = await blockchain.getContractSource('getUserData.cdc');

              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  limit: 100,
                  script: contractSource.replace(/ARG0/g, '0x' + addr),
                  wait: true,
                }),
              });
              const response2 = await res.json();
              const [name, avatarUrl] = response2.encodedData.value.map(value => value.value && value.value.value);

              message.channel.send('<@!' + message.author.id + '>: avatar is ' + JSON.stringify(avatarUrl));
            }
          } else if (split[0] === prefix + 'balance') {
            let match;
            if (split.length >= 2 && (match = split[1].match(/<@!([0-9]+)>/))) {
              const userId = match[1];
              let {mnemonic} = await _getUser(userId);
              if (!mnemonic) {
                const spec = await _genKey(userId);
                mnemonic = spec.mnemonic;
              }

              {
                const contractSource = await blockchain.getContractSource('getBalance.cdc');

                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 100,
                    script: contractSource.replace(/ARG0/g, '0x' + addr),
                    wait: true,
                  }),
                });
                const response2 = await res.json();
                const balance = parseFloat(response2.encodedData.value);

                message.channel.send('<@!' + userId + '> is ' + balance + ' grease');
              }
            } else {
              let {mnemonic} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
              }

              {
                const contractSource = await blockchain.getContractSource('getBalance.cdc');

                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 100,
                    script: contractSource.replace(/ARG0/g, '0x' + addr),
                    wait: true,
                  }),
                });
                const response2 = await res.json();
                const balance = parseFloat(response2.encodedData.value);

                message.channel.send('<@!' + message.author.id + '> is ' + balance + ' grease');
              }
            }
          } else if (split[0] === prefix + 'address') {
            let user;
            if (split[1] && (match = split[1].match(/<@!([0-9]+)>/))) {
              const userId = match[1];
              const member = message.channel.guild.members.cache.get(userId);
              user = member ? member.user : null;
            } else {
              user = message.author;
            }
            if (user) {
              let mnemonic;
              const spec = await _getUser(user.id);
              if (spec.mnemonic) {
                mnemonic = spec.mnemonic;
              } else {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
              }
              
              const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
              const address = wallet.getAddressString();

              message.channel.send('<@!' + user.id + '>\'s address: ```' + address + '```');
            } else {
              message.channel.send('no such user');
            }
          } else if (split[0] === prefix + 'mint' && message.author.id === adminUserId && message.attachments.size === 0) {
            let amount = parseFloat(split[1]);
            if (isNaN(amount)) {
              amount = 1;
            }

            let {mnemonic} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
            }

            {
              const contractSource = await blockchain.getContractSource('mintToken.cdc');
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: config.webaverseToken.address,
                  mnemonic: config.webaverseToken.mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, '0x' + addr)
                    .replace(/ARG1/g, amount.toFixed(8)),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              if (!response2.transaction.errorMessage) {
                message.channel.send('<@!' + message.author.id + '>: minted ' + amount);
              } else {
                message.channel.send('<@!' + message.author.id + '>: could not mint: ' + response2.transaction.errorMessage);
              }
            }
          } else if (split[0] === prefix + 'send' && split.length >= 3 && !isNaN(parseFloat(split[2]))) {
            const amount = parseFloat(split[2]);
            if (match = split[1].match(/<@!([0-9]+)>/)) {
              const userId = match[1];
              const member = message.channel.guild.members.cache.get(userId);
              const user = member ? member.user : null;
              if (user) {
                let {mnemonic} = await _getUser();
                if (!mnemonic) {
                  const spec = await _genKey();
                  mnemonic = spec.mnemonic;
                }

                let {mnemonic: mnemonic2} = await _getUser(user.id);
                if (!mnemonic2) {
                  const spec = await _genKey(userId);
                  mnemonic2 = spec.mnemonic;
                }
                
                const addr2 = '';

                const contractSource = await blockchain.getContractSource('transferToken.cdc');
                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 100,
                    transaction: contractSource
                      .replace(/ARG0/g, amount.toFixed(8))
                      .replace(/ARG1/g, '0x' + addr2),
                    wait: true,
                  }),
                });
                const response2 = await res.json();

                if (!response2.transaction.errorMessage) {
                  message.channel.send('<@!' + message.author.id + '>: greased ' + amount + ' to <@!' + userId + '>');
                } else {
                  message.channel.send('<@!' + message.author.id + '>: could not send: ' + response2.transaction.errorMessage);
                }
              } else {
                message.channcel.send('unknown user');
              }
            } else if (match = split[1].match(/0x([0-9a-f]+)/i)) {
              let {mnemonic} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
              }

              const addr2 = match[1];

              const contractSource = await blockchain.getContractSource('transferToken.cdc');
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: addr,
                  mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, amount.toFixed(8))
                    .replace(/ARG1/g, '0x' + addr2),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              if (!response2.transaction.errorMessage) {
                message.channel.send('<@!' + message.author.id + '>: greased ' + amount + ' to 0x' + addr2);
              } else {
                message.channel.send('<@!' + message.author.id + '>: could not send: ' + response2.transaction.errorMessage);
              }
            } else {
              message.channcel.send('unknown user');
            }
          } else if (split[0] === prefix + 'transfer' && split.length >= 3 && !isNaN(parseInt(split[2], 10))) {
            const id = parseInt(split[2], 10);
            let quantity = parseInt(split[3], 10);
            if (isNaN(quantity)) {
              quantity = 1;
            }
            if (match = split[1].match(/<@!([0-9]+)>/)) {
              const userId = match[1];
              const member = message.channel.guild.members.cache.get(userId);
              const user = member ? member.user : null;
              if (user) {
                let {mnemonic} = await _getUser();
                if (!mnemonic) {
                  const spec = await _genKey();
                  mnemonic = spec.mnemonic;
                }

                let {mnemonic: mnemonic2} = await _getUser(user.id);
                if (!mnemonic2) {
                  const spec = await _genKey(userId);
                  mnemonic2 = spec.mnemonic;
                }

                const contractSource = await blockchain.getContractSource('transferNft.cdc');
                const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                  method: 'POST',
                  body: JSON.stringify({
                    address: addr,
                    mnemonic,

                    limit: 1000,
                    transaction: contractSource
                      .replace(/ARG0/g, id)
                      .replace(/ARG1/g, '0x' + addr2)
                      .replace(/ARG2/g, quantity),
                    wait: true,
                  }),
                });
                const response2 = await res.json();

                if (!response2.transaction.errorMessage) {
                  message.channel.send('<@!' + message.author.id + '>: transferred ' + id + ' to <@!' + userId + '>');
                } else {
                  message.channel.send('<@!' + message.author.id + '>: could not transfer: ' + response2.transaction.errorMessage);
                }
              } else {
                message.channcel.send('unknown user');
              }
            } else if (match = split[1].match(/^0x([0-9a-f]+)$/i)) {
              let {mnemonic} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
              }

              const addr2 = match[1];

              const contractSource = await blockchain.getContractSource('transferNft.cdc');
              const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                method: 'POST',
                body: JSON.stringify({
                  address: addr,
                  mnemonic,

                  limit: 100,
                  transaction: contractSource
                    .replace(/ARG0/g, id)
                    .replace(/ARG1/g, '0x' + addr2)
                    .replace(/ARG2/g, quantity),
                  wait: true,
                }),
              });
              const response2 = await res.json();

              if (!response2.transaction.errorMessage) {
                message.channel.send('<@!' + message.author.id + '>: transferred ' + id + ' to 0x' + addr2);
              } else {
                message.channel.send('<@!' + message.author.id + '>: could not transfer: ' + response2.transaction.errorMessage);
              }
            } else {
              message.channel.send('unknown user');
            }
          } else if (split[0] === prefix + 'inventory') {
            let address, userLabel;
            const _loadFromUserId = async userId => {
              const spec = await _getUser(userId);
              let mnemonic = spec.mnemonic;
              if (!mnemonic) {
                const spec = await _genKey(userId);
                mnemonic = spec.mnemonic;
              }

              const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
              address = wallet.getAddressString();

              userLabel = '<@!' + userId + '>';
            };
            const _loadFromAddress = a => {
              address = a;
              userLabel = '`0x' + a + '`';
            };
            if (split.length >= 2 && (match = split[1].match(/<@!([0-9]+)>/))) {
              await _loadFromUserId(match[1]);
            } else if (split.length >= 2 && (match = split[1].match(/^0x([0-9a-f]+)$/i))) {
              _loadFromAddress(match[1]);
            } else {
              await _loadFromUserId(message.author.id);
            }

            const nftBalance = await contracts.NFT.methods.balanceOf(address).call();
            const hashToIds = {};
            for (let i = 0; i < nftBalance; i++) {
              const id = await contracts.NFT.methods.tokenOfOwnerByIndex(address, i).call();
              const hashNumberString = await contracts.NFT.methods.getHash(id).call();
              const hash = '0x' + web3.utils.padLeft(new web3.utils.BN(hashNumberString, 10).toString(16), 32);
              if (!hashToIds[hash]) {
                hashToIds[hash] = [];
              }
              hashToIds[hash].push(id);
            }
            const entries = [];
            for (const hash in hashToIds) {
              const ids = hashToIds[hash];
              const id = ids[0];
              const filename = await contracts.NFT.methods.getMetadata(hash, 'filename').call();
              const balance = ids.length;
              const totalSupply = await contracts.NFT.methods.totalSupplyOfHash(hash).call();
              entries.push({
                id,
                hash: hash.slice(2),
                filename,
                balance,
                totalSupply,
              });
            }

            /* const contractSource = await blockchain.getContractSource('getHashes.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, '0x' + addr),
                wait: true,
              }),
            });
            const response2 = await res.json();

            const entries = response2.encodedData.value.map(({value: {fields}}) => {
              const id = parseInt(fields.find(field => field.name === 'id').value.value, 10);
              const hash = fields.find(field => field.name === 'hash').value.value;
              const filename = fields.find(field => field.name === 'filename').value.value;
              const balance = parseInt(fields.find(field => field.name === 'balance').value.value, 10);
              const totalSupply = parseInt(fields.find(field => field.name === 'totalSupply').value.value, 10);
              return {id, hash, filename, balance, totalSupply};
            }); */

            let s = userLabel + ':\n'
            if (entries.length > 0) {
              s += '```' + entries.map((entry, i) => `${entry.id}. ${entry.filename} ${entry.hash} (${entry.balance}/${entry.totalSupply})`).join('\n') + '```';
            } else {
              s += '```inventory empty```';
            }
            message.channel.send(s);
          } else if (split[0] === prefix + 'upload' && split.length >= 2 && !isNaN(parseInt(split[1], 10))) {
            const id = parseInt(split[1], 10);

            const hashNumberString = await contracts.NFT.methods.getHash(id).call();
            const hash = '0x' + web3.utils.padLeft(new web3.utils.BN(hashNumberString, 10).toString(16), 32);
            const filename = await contracts.NFT.methods.getMetadata(hash, 'filename').call();

            /* const contractSource = await blockchain.getContractSource('getNft.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, n),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const [hash, filename] = response2.encodedData.value.map(value => value.value && value.value.value); */

            const buffer = await _readStorageHashAsBuffer(hash.slice(2));
            const attachment = new Discord.MessageAttachment(buffer, filename);

            message.channel.send('<@!' + message.author.id + '>: ' + id + ' is this', attachment);
          } else if (split[0] === prefix + 'preview' && split.length >= 2 && !isNaN(parseInt(split[1], 10))) {
            const id = parseInt(split[1], 10);

            const hashNumberString = await contracts.NFT.methods.getHash(id).call();
            const hash = '0x' + web3.utils.padLeft(new web3.utils.BN(hashNumberString, 10).toString(16), 32);
            const filename = await contracts.NFT.methods.getMetadata(hash, 'filename').call();
            const match = filename.match(/^(.+)\.([^\.]+)$/);

            /* const contractSource = await blockchain.getContractSource('getNft.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, n),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const [hash, filename] = response2.encodedData.value.map(value => value.value && value.value.value);
            const match = filename.match(/^(.+)\.([^\.]+)$/); */

            if (match) {
              const basename = match[1];
              const ext = match[2];
              message.channel.send('<@!' + message.author.id + '>: ' + id + ': https://preview.exokit.org/' + hash.slice(2) + '.' + ext + '/' + basename + '.png');
            } else {
              message.channel.send('<@!' + message.author.id + '>: ' + id + ': no preivew available');
            }
          } else if (split[0] === prefix + 'gif' && split.length >= 2 && !isNaN(parseInt(split[1], 10))) {
            const n = parseInt(split[1], 10);

            const contractSource = await blockchain.getContractSource('getNft.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, n),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const [hash, filename] = response2.encodedData.value.map(value => value.value && value.value.value);
            const match = filename.match(/^(.+)\.([^\.]+)$/);

            if (match) {
              const basename = match[1];
              const ext = match[2];
              message.channel.send('<@!' + message.author.id + '>: ' + n + ': https://preview.exokit.org/' + hash + '.' + ext + '/' + basename + '.gif');
            } else {
              message.channel.send('<@!' + message.author.id + '>: ' + n + ': no preivew available');
            }
          } else if (split[0] === prefix + 'key') {
            let {mnemonic} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
            }

            message.author.send('Key: ```' + mnemonic + '```');
          } else if (split[0] === prefix + 'get' && split.length >= 3 && !isNaN(parseInt(split[1], 10))) {
            const id = parseInt(split[1], 10);
            const key = split[2];

            const contractSource = await blockchain.getContractSource('getNftMetadata.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, id)
                  .replace(/ARG1/g, key),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const value = response2.encodedData.value && response2.encodedData.value.value;

            message.channel.send('<@!' + message.author.id + '>: ```' + id + '/' + key + ': ' + value + '```');
          } else if (split[0] === prefix + 'set' && split.length >= 4 && !isNaN(parseInt(split[1], 10))) {
            const id = parseInt(split[1], 10);
            const key = split[2];
            const value = split[3];

            let {mnemonic} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
            }


            const contractSource = await blockchain.getContractSource('setNftMetadata.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                address: addr,
                mnemonic,

                limit: 100,
                transaction: contractSource
                  .replace(/ARG0/g, id)
                  .replace(/ARG1/g, key)
                  .replace(/ARG2/g, value),
                wait: true,
              }),
            });
            const response2 = await res.json();

            if (!response2.transaction.errorMessage) {
              message.channel.send('<@!' + message.author.id + '>: ```' + id + '/' + key + ' = ' + value + '```');
            } else {
              message.channel.send('<@!' + message.author.id + '>: could not set: ' + response2.transaction.errorMessage);
            }
          } else if (split[0] === prefix + 'createworld') {
            const res = await fetch('https://worlds.exokit.org/create', {
              method: 'POST',
            });
            if (res.ok) {
              const j = await res.json();
              const {id, url} = j;
              message.channel.send('<@!' + message.author.id + '>: created world: ```' + JSON.stringify(j, null, 2) + '```');
            } else {
              message.channel.send('<@!' + message.author.id + '>: failed to create world: ' + res.statusCode);
            }
          } else if (split[0] === prefix + 'destroyworld' && split.length >= 2 && split[1]) {
            const id = split[1];
            const res = await fetch('https://worlds.exokit.org/' + id, {
              method: 'DELETE',
            });
            if (res.ok) {
              await res.arrayBuffer();
              message.channel.send('<@!' + message.author.id + '>: destroyed world: ```' + id + '```');
            } else {
              message.channel.send('<@!' + message.author.id + '>: failed to destroy world: ' + res.statusCode);
            }
          } else {
            if (split[0] === prefix + 'mint' && message.attachments.size > 0) {
              let quantity = parseInt(split[1], 10);
              if (isNaN(quantity)) {
                quantity = 1;
              }

              let {mnemonic} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
              }

              for (const [key, attachment] of message.attachments) {
                const {name, url} = attachment;

                await new Promise((accept, reject) => {
                  const proxyReq = https.request(url, proxyRes => {
                    const req = https.request(storageHost, {
                      method: 'POST',
                    }, res => {
                      const bs = [];
                      res.on('data', d => {
                        bs.push(d);
                      });
                      res.on('end', async () => {
                        const b = Buffer.concat(bs);
                        const s = b.toString('utf8');
                        const j = JSON.parse(s);
                        const {hash} = j;

                        const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
                        const address = wallet.getAddressString();
                        const result = await runSidechainTransaction(mnemonic)('NFT', 'mint', address, '0x' + hash, name, quantity);

                        /* const contractSource = await blockchain.getContractSource('mintNft.cdc');

                        const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
                          method: 'POST',
                          body: JSON.stringify({
                            address: addr,
                            mnemonic,

                            limit: 100,
                            transaction: contractSource
                              .replace(/ARG0/g, hash)
                              .replace(/ARG1/g, name)
                              .replace(/ARG2/g, quantity),
                            wait: true,
                          }),
                        });
                        const response2 = await res.json(); */

                        if (result.status) {
                          message.channel.send('<@!' + message.author.id + '>: minted ' + hash + ' (' + storageHost + '/' + hash + ')');
                        } else {
                          message.channel.send('<@!' + message.author.id + '>: mint transaction failed: ' + result.transactionHash);
                        }

                        accept();
                      });
                      res.on('error', err => {
                        console.warn(err.stack);
                        message.channel.send('<@!' + message.author.id + '>: mint failed: ' + err.message);
                      });
                    });
                    req.on('error', reject);
                    proxyRes.pipe(req);
                  });
                  proxyReq.on('error', reject);
                  proxyReq.end();
                });
              }
            }
          }
        } else if (message.channel.type === 'dm') {
          let {mnemonic} = await _getUser();

          const split = message.content.split(/\s+/);
          if (split[0] === prefix + 'key') {
            if (split.length === 12) {
              const key = split.splice(1, 31);
              if (key.every(word => wordList.includes(word))) {
                const mnemonic = key.slice(0, 12).join(' ');

                await ddb.putItem({
                  TableName: tableName,
                  Item: {
                    email: {S: id + '.discord'},
                    mnemonic: {S: mnemonic},
                  }
                }).promise();
                message.author.send('set key to ```' + JSON.stringify({
                  mnemonic,
                }) + '```');
              } else {
                message.author.send('invalid key');
              }
            } else {
              if (!mnemonic || split[1] === 'reset') {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
              }

              message.author.send('Key: ```' + mnemonic + '```');
            }
          }
        }
      }
    });
  });

  client.login(discordApiToken);
})();