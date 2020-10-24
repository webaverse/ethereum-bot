const http = require('http');
const https = require('https');
const followRedirects = require('follow-redirects');
const AWS = require('aws-sdk');
/* const flow = {
  sdk: require('@onflow/sdk'),
  types: require('@onflow/types'),
}; */
const Discord = require('discord.js');
const blockchain = require('./blockchain.js');
const fetch = require('node-fetch');
const wordList = require('./wordlist.json');
const config = require('./config.json');
const flowConstants = require('./flow-constants.js');

const {accessKeyId, secretAccessKey, /*githubUsername, githubApiKey,*/ githubPagesDomain, githubClientId, githubClientSecret, stripeClientId, stripeClientSecret, discordApiToken} = config;
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
const prefix = '.';
const storageHost = 'https://storage.exokit.org';
const previewHost = 'https://preview.exokit.org';
const previewExt = 'png';

function getExt(fileName) {
  const match = fileName.match(/\.([^\.]+)$/);
  return match && match[1].toLowerCase();
}

const _runArray = async (userKeys, array) => {
  const result = Array(array.length);
  for (let i = 0; i < array.length; i++) {
    result[i] = await _runSpec(userKeys, array[i]);
  }
  return result;
};
const _bakeContract = async (contractKeys, contractSource) => {
  const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
    method: 'POST',
    body: JSON.stringify({
      address: contractKeys.address,
      privateKey: contractKeys.privateKey,
      publicKey: contractKeys.publicKey,
      mnemonic: userKeys.mnemonic,

      limit: 100,
      transaction: `\
        transaction(code: String) {
          prepare(acct: AuthAccount) {
            acct.setCode(code.decodeHex())
          }
        }
      `,
      args: [
        {value: uint8Array2hex(new TextEncoder().encode(contractSource)), type: 'String'},
      ],
      wait: true,
    }),
  });
  const response2 = await res.json();

  // console.log('bake contract 2', response2);
  return response2;
};
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
  const {FungibleToken, NonFungibleToken, WebaverseToken, WebaverseNFT, WebaverseAccount, host} = await flowConstants.load();

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
              email: {S: id + '.discord'},
            }
          }).promise();

          let mnemonic = (tokenItem.Item && tokenItem.Item.mnemonic) ? tokenItem.Item.mnemonic.S : null;
          let addr = (tokenItem.Item && tokenItem.Item.addr) ? tokenItem.Item.addr.S : null;
          return {mnemonic, addr};
        };
        const _genKey = async (id = message.author.id) => {
          let userKeys = await blockchain.createAccount({
            bake: true,
          });
          let {mnemonic, address: addr} = userKeys;

          await ddb.putItem({
            TableName: tableName,
            Item: {
              email: {S: id + '.discord'},
              mnemonic: {S: mnemonic},
              addr: {S: addr},
            }
          }).promise();
          return {mnemonic, addr};
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
          } else if (split[0] === prefix + 'dump' && split.length >= 4) {
            // console.log('got', split[1]);
            const match = split[1].match(/<@!([0-9]+)>/);
            if (match) {
              // console.log('got split 1', match[1]);
              const member = client.guilds.cache.get(guildId).members.cache.get(match[1]);
              // console.log('got split 2', member.user.send('woot'));
            }
          } else if (split[0] === prefix + 'status') {
            let userId, mnemonic, addr;
            if (split.length >= 2 && (match = split[1].match(/<@!([0-9]+)>/))) {
              userId = match[1];
            } else {
              userId = message.author.id;
            }
            const spec = await _getUser(userId);
            mnemonic = spec.mnemonic;
            addr = spec.addr;
            if (!mnemonic) {
              const spec = await _genKey(userId);
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            // await _ensureBaked({addr, mnemonic});

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

            message.channel.send('<@!' + message.author.id + '>: ' + `\`\`\`Name: ${name}\nAvatar: ${avatarUrl}\n\`\`\``);
          } else if (split[0] === prefix + 'name') {
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
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
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
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
              let {mnemonic, addr} = await _getUser(userId);
              if (!mnemonic) {
                const spec = await _genKey(userId);
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              // await _ensureBaked({addr, mnemonic});

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
              let {mnemonic, addr} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              // await _ensureBaked({addr, mnemonic});

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
              let addr;
              const spec = await _getUser(user.id);
              if (spec.addr) {
                addr = spec.addr;
              } else {
                const spec = await _genKey();
                addr = spec.addr;
              }

              message.channel.send('<@!' + user.id + '>\'s address: ```' + addr + '```');
            } else {
              message.channel.send('no such user');
            }
          } else if (split[0] === prefix + 'mint' && message.author.id === adminUserId && message.attachments.size === 0) {
            let amount = parseFloat(split[1]);
            if (isNaN(amount)) {
              amount = 1;
            }

            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            // await _ensureBaked({addr, mnemonic});

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
                let {mnemonic, addr} = await _getUser();
                if (!mnemonic) {
                  const spec = await _genKey();
                  mnemonic = spec.mnemonic;
                  addr = spec.addr;
                }

                let {mnemonic: mnemonic2, addr: addr2} = await _getUser(user.id);
                if (!mnemonic2) {
                  const spec = await _genKey(userId);
                  mnemonic2 = spec.mnemonic;
                  addr2 = spec.addr;
                }

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
              let {mnemonic, addr} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
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
                let {mnemonic, addr} = await _getUser();
                if (!mnemonic) {
                  const spec = await _genKey();
                  mnemonic = spec.mnemonic;
                  addr = spec.addr;
                }

                let {mnemonic: mnemonic2, addr: addr2} = await _getUser(user.id);
                if (!mnemonic2) {
                  const spec = await _genKey(userId);
                  mnemonic2 = spec.mnemonic;
                  addr2 = spec.addr;
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
              let {mnemonic, addr} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
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
            let addr, userLabel;
            const _loadFromUserId = async userId => {
              const spec = await _getUser(userId);
              // mnemonic = spec.mnemonic;
              addr = spec.addr;
              if (!addr) {
                const spec = await _genKey(userId);
                // mnemonic = spec.mnemonic;
                addr = spec.addr;
              }

              userLabel = '<@!' + userId + '>';
            };
            const _loadFromAddress = address => {
              addr = address;
              userLabel = '`0x' + address + '`';
            };
            if (split.length >= 2 && (match = split[1].match(/<@!([0-9]+)>/))) {
              await _loadFromUserId(match[1]);
            } else if (split.length >= 2 && (match = split[1].match(/^0x([0-9a-f]+)$/i))) {
              _loadFromAddress(match[1]);
            } else {
              await _loadFromUserId(message.author.id);
            }

            const contractSource = await blockchain.getContractSource('getHashes.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                /* address: addr,
                mnemonic, */

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
            });

            let s = userLabel + ':\n'
            if (entries.length > 0) {
              s += '```' + entries.map((entry, i) => `${entry.id}. ${entry.filename} ${entry.hash} (${entry.balance}/${entry.totalSupply})`).join('\n') + '```';
            } else {
              s += '```inventory empty```'
            }
            message.channel.send(s);
          } else if (split[0] === prefix + 'upload' && split.length >= 2 && !isNaN(parseInt(split[1], 10))) {
            const n = parseInt(split[1], 10);

            const contractSource = await blockchain.getContractSource('getNft.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                /* address: addr,
                mnemonic, */

                limit: 100,
                script: contractSource
                  .replace(/ARG0/g, n),
                wait: true,
              }),
            });
            const response2 = await res.json();
            const [hash, filename] = response2.encodedData.value.map(value => value.value && value.value.value);

            const buffer = await _readStorageHashAsBuffer(hash);
            const attachment = new Discord.MessageAttachment(buffer, filename);

            message.channel.send('<@!' + message.author.id + '>: ' + n + ' is this', attachment);
          } else if (split[0] === prefix + 'preview' && split.length >= 2 && !isNaN(parseInt(split[1], 10))) {
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
              message.channel.send('<@!' + message.author.id + '>: ' + n + ': https://preview.exokit.org/' + hash + '.' + ext + '/' + basename + '.png');
            } else {
              message.channel.send('<@!' + message.author.id + '>: ' + n + ': no preivew available');
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
            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            // await _ensureBaked({addr, mnemonic});

            const key = mnemonic + ' ' + blockchain.hexToWordList(addr);
            message.author.send('Key: ```' + key + '```');
          } else if (split[0] === prefix + 'get' && split.length >= 3 && !isNaN(parseInt(split[1], 10))) {
            const id = parseInt(split[1], 10);
            const key = split[2];

            const contractSource = await blockchain.getContractSource('getNftMetadata.cdc');

            const res = await fetch(`https://accounts.exokit.org/sendTransaction`, {
              method: 'POST',
              body: JSON.stringify({
                /* address: addr,
                mnemonic, */

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

            let {mnemonic, addr} = await _getUser();
            if (!mnemonic) {
              const spec = await _genKey();
              mnemonic = spec.mnemonic;
              addr = spec.addr;
            }
            // await _ensureBaked({addr, mnemonic});

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

              let {mnemonic, addr} = await _getUser();
              if (!mnemonic) {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
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

                        const contractSource = await blockchain.getContractSource('mintNft.cdc');

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
                        const response2 = await res.json();

                        if (!response2.transaction.errorMessage) {
                          message.channel.send('<@!' + message.author.id + '>: minted ' + hash + ' (' + storageHost + '/' + hash + ')');
                        } else {
                          message.channel.send('<@!' + message.author.id + '>: could not mint: ' + response2.transaction.errorMessage);
                        }

                        accept();
                      });
                      res.on('error', reject);
                    });
                    req.on('error', reject);
                    proxyRes.pipe(req);
                    /* console.log('headers', proxyRes.headers);
                    proxyRes.on('data', d => {
                      console.log('proxy data', d.length);
                    });
                    proxyRes.on('end', () => {
                      console.log('proxy end');
                    }); */
                  });
                  proxyReq.on('error', reject);
                  proxyReq.end();
                });
              }
            }
          }
        } else if (message.channel.type === 'dm') {
          let {mnemonic, addr} = await _getUser();

          const split = message.content.split(/\s+/);
          if (split[0] === prefix + 'key') {
            if (split.length >= 31) {
              const key = split.splice(1, 31);
              if (key.every(word => wordList.includes(word))) {
                const mnemonic = key.slice(0, 24).join(' ');
                const addr = blockchain.wordListToHex(key.slice(24).join(' '));

                await ddb.putItem({
                  TableName: tableName,
                  Item: {
                    email: {S: id + '.discord'},
                    mnemonic: {S: mnemonic},
                    addr: {S: addr},
                  }
                }).promise();
                message.author.send('set key to ```' + JSON.stringify({
                  mnemonic,
                  addr,
                }) + '```');
              } else {
                message.author.send('invalid key');
              }
            } else {
              if (!mnemonic || split[1] === 'reset') {
                const spec = await _genKey();
                mnemonic = spec.mnemonic;
                addr = spec.addr;
              }
              // await _ensureBaked({addr, mnemonic});

              const key = mnemonic + ' ' + blockchain.hexToWordList(addr);
              message.author.send('Key: ```' + key + '```');
            }
          }
        }
      }
    });
  });

  client.login(discordApiToken);
})();