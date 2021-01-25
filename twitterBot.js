const { Autohook } = require('twitter-autohook');
const crypto = require('crypto');
const http = require('http');
const url = require('url');
const bip39 = require('bip39');
const { hdkey } = require('ethereumjs-wallet');

const { usersTableName } = require('./constants')

let ddb = null;
let getStores = null;
let runSidechainTransaction = null;

const {
  treasuryMnemonic,
  twitterBearerToken,
  twitterConsumerKey,
  twitterConsumerSecret,
  twitterAccessToken,
  twitterAccessTokenSecret,
  twitterId,
  twitterWebhookPort,
  ngrokToken,
  serverPort
} = require('./config.json');

const twitterConfigInvalid = twitterBearerToken === undefined ||
  twitterConsumerKey === undefined ||
  twitterConsumerSecret === undefined ||
  twitterAccessToken === undefined ||
  twitterAccessTokenSecret === undefined ||
  twitterId === undefined ||
  twitterWebhookPort === undefined ||
  twitterBearerToken === null ||
  twitterConsumerKey === null ||
  twitterConsumerSecret === null ||
  twitterAccessToken === null ||
  twitterAccessTokenSecret === null ||
  twitterId === null ||
  twitterWebhookPort === null

let TwitClient;

const _items = (id, twitterUserId, addressToGetFrom, page, contractName) => async (getEntries, print) => {
  if (!isNaN(page))
    page = 1
  else
    page = parseInt(page, 10);

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

    userLabel = userId;
  };
  const _loadFromAddress = a => {
    address = a;
    userLabel = a;
  };
  const _loadFromTreasury = () => {
    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(treasuryMnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    address = wallet.getAddressString();
    userLabel = 'treasury';
  };
  // If it's a username
  if (addressToGetFrom !== undefined && (match = addressToGetFrom.match(/<@!?([0-9]+)>/))) {
    await _loadFromUserId(match[1]);
    // If it's an eth address
  } else if (addressToGetFrom !== undefined && (match = addressToGetFrom.match(/^(0x[0-9a-f]+)$/i))) {
    _loadFromAddress(match[1]);
    // If it's the treasury
  } else if (addressToGetFrom.toLowerCase() === 'treasury') {
    _loadFromTreasury();
  } else {
    await _loadFromUserId(twitterUserId);
  }

  const nftBalance = await contracts[contractName].methods.balanceOf(address).call();
  const maxEntriesPerPage = 10;
  const numPages = Math.max(Math.ceil(nftBalance / maxEntriesPerPage), 1);
  page = Math.min(Math.max(page, 1), numPages);
  const startIndex = (page - 1) * maxEntriesPerPage;
  const endIndex = Math.min(page * maxEntriesPerPage, nftBalance);

  const entries = await getEntries(address, startIndex, endIndex);

  const s = print(userLabel, page, numPages, entries);
  SendMessage(id, s)
};

const _getUser = async (id) => {
  const tokenItem = await ddb.getItem({
    TableName: usersTableName,
    Key: {
      email: { S: id + '.twittertoken' },
    }
  }).promise();

  let mnemonic = (tokenItem.Item && tokenItem.Item.mnemonic) ? tokenItem.Item.mnemonic.S : null;
  return { mnemonic };
};

const _genKey = async (id) => {
  const mnemonic = bip39.generateMnemonic();
  await ddb.putItem({
    TableName: usersTableName,
    Item: {
      email: { S: id + '.twittertoken' },
      mnemonic: { S: mnemonic }
    }
  }).promise();
  return { mnemonic };
};

const SendMessage = (id, text) => {
  console.log('on SendMessage')
  console.log({ id, text })
  TwitClient.post('direct_messages/events/new', {
    "event": {
      "type": "message_create",
      "message_create": {
        "target": {
          "recipient_id": id
        },
        "message_data": {
          "text": text,
        }
      }
    }
  }, (error, data, response) => { if (error) console.log(error) });
}

const help = (id, name) => {
  SendMessage(id, 'For a list of commands, please visit https://docs.webaverse.com/docs/webaverse/discord-bot')
}

const status = (id, twitterUserId) => {
  if (ddb == null) {
    SendMessage(id, `Unable to get status for ${twitterUserId} - database not configured`)
    return;
  }
  let mnemonic;
  (async () => {
    const spec = await _getUser(twitterUserId);
    mnemonic = spec.mnemonic;
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }

    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();
    const [
      name,
      avatarId,
      homeSpaceId,
      monetizationPointer,
    ] = await Promise.all([
      contracts.Account.methods.getMetadata(address, 'name').call(),
      contracts.Account.methods.getMetadata(address, 'avatarId').call(),
      contracts.Account.methods.getMetadata(address, 'homeSpaceId').call(),
      contracts.Account.methods.getMetadata(address, 'monetizationPointer').call(),
    ]);

    SendMessage(id, `Name: ${name}\nAvatar: ${avatarId}\nHome Space: ${homeSpaceId}\nMonetization Pointer: ${monetizationPointer}`)
  })()
}

const inventory = (id, twitterUserId, addressToGetFrom, page = 1) => {
  addressToGetFrom = addressToGetFrom ?? twitterUserId;
  if (ddb == null) {
    SendMessage(id, `Unable to get inventory for ${addressToGetFrom} at page ${page} - database not configured.`)
    return;
  }
  (async () => {
    await _items(id, twitterUserId, addressToGetFrom, page, 'NFT')(async (address, startIndex, endIndex) => {
      const hashToIds = {};
      const promises = [];
      for (let i = startIndex; i < endIndex; i++) {
        promises.push((async i => {
          const id = await contracts.NFT.methods.tokenOfOwnerByIndex(address, i).call();
          const hash = await contracts.NFT.methods.getHash(id).call();
          if (!hashToIds[hash]) {
            hashToIds[hash] = [];
          }
          hashToIds[hash].push(id);
        })(i));
      }
      await Promise.all(promises);

      const entries = [];
      await Promise.all(Object.keys(hashToIds).map(async hash => {
        const ids = hashToIds[hash].sort();
        const id = ids[0];
        const [
          name,
          ext,
          totalSupply,
        ] = await Promise.all([
          contracts.NFT.methods.getMetadata(hash, 'name').call(),
          contracts.NFT.methods.getMetadata(hash, 'ext').call(),
          contracts.NFT.methods.totalSupplyOfHash(hash).call(),
        ]);
        const balance = ids.length;
        entries.push({
          id,
          ids,
          hash,
          name,
          ext,
          balance,
          totalSupply,
        });
      }));
      return entries;
    }, (userLabel, page, numPages, entries) => {
      let s = userLabel + '\'s inventory:\n';
      if (entries.length > 0) {
        s += `Page ${page}/${numPages}` + '\n';
        s += '' + entries.map((entry, i) => `${entry.id}. ${entry.name} ${entry.ext} ${entry.hash} (${entry.balance}/${entry.totalSupply}) [${entry.ids.join(',')}]`).join('\n') + '';
      } else {
        s += 'inventory is empty!';
      }
      return s;
    }).catch(console.warn);
    SendMessage(id, 'Inventory')
  })();
}

const address = (id, twitterUserId, addressToGet) => {
  if (ddb == null) {
    SendMessage(id, `Unable to get address for ${twitterUserId} - database not configured`)
    return;
  }
  let user, address;
  if (addressToGet !== 'treasury') {
    if (addressToGet && (match = addressToGet.match(/<@!?([0-9]+)>/))) {
      user = match[1];
    } else {
      user = twitterUserId;
    }
    let mnemonic;
    const spec = await _getUser(user);
    if (spec.mnemonic) {
      mnemonic = spec.mnemonic;
    } else {
      const spec = await _genKey();
      mnemonic = spec.mnemonic;
    }

    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    address = wallet.getAddressString();

    userLabel = user;
  } else {
    address = treasuryAddress;
    user = 'treasury';
  }
  let message = address ? user + '\'s address: ' + address : "No such user";

  SendMessage(id, message)
}

const send = (id, twitterUserId, addressToSendTo, amount) => {
  const amount = parseFloat(amount);
  // Send to user name
  if (match = addressToSendTo.match(/<@!?([0-9]+)>/)) {
    const userId = match[1];
    let mnemonic, mnemonic2;
    if (userId !== twitterUserId) {
      {
        const userSpec = await _getUser();
        mnemonic = userSpec.mnemonic;
        if (!mnemonic) {
          const spec = await _genKey();
          mnemonic = spec.mnemonic;
        }
      }
      {
        const userSpec = await _getUser(user.id);
        mnemonic2 = userSpec.mnemonic;
        if (!mnemonic2) {
          const spec = await _genKey(userId);
          mnemonic2 = spec.mnemonic;
        }
      }
    } else {
      SendMessage(id, `Can't send FLUX to yourself!`)
      return;
    }

    const wallet2 = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic2)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address2 = wallet2.getAddressString();

    let status, transactionHash;
    try {
      const result = await runSidechainTransaction(mnemonic)('FT', 'transfer', address2, amount);
      status = result.status;
      transactionHash = result.transactionHash;
    } catch (err) {
      console.warn(err.stack);
      status = false;
      transactionHash = '0x0';
    }

    if (status) {
      SendMessage(id, `Sent ${amount} FLUX to ${userId}`)
    } else {
      SendMessage(id, `Couldn't send ${amount} FLUX to ${userId}: ${transactionHash}`)
    }
  }
  // Send to address
  else if (match = addressToSendTo.match(/(0x[0-9a-f]+)/i)) {
    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey();
      mnemonic = spec.mnemonic;
    }

    const address2 = match[1];

    let status, transactionHash;
    try {
      const result = await runSidechainTransaction(mnemonic)('FT', 'transfer', address2, amount);
      status = result.status;
      transactionHash = result.transactionHash;
    } catch (err) {
      console.warn(err.stack);
      status = false;
      transactionHash = '0x0';
    }

    if (status) {
      SendMessage(id, 'sent ' + amount + ' FLUX to ' + address2);
    } else {
      SendMessage(id, 'could not send: ' + transactionHash);
    }
  }
  // Send to treasury
  else if (addressToSendTo === 'treasury') {
    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey();
      mnemonic = spec.mnemonic;
    }

    const wallet2 = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(treasuryMnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address2 = wallet2.getAddressString();

    let status, transactionHash;
    try {
      const result = await runSidechainTransaction(mnemonic)('FT', 'transfer', address2, amount);
      status = result.status;
      transactionHash = result.transactionHash;
    } catch (err) {
      console.warn(err.stack);
      status = false;
      transactionHash = '0x0';
    }

    if (status) {
      SendMessage(id, 'sent ' + amount + ' FLUX to treasury');
    } else {
      SendMessage(id, 'could not send: ' + transactionHash);
    }
  } else {
    SendMessage(id, 'unknown user');
  }
  SendMessage(id, 'send')
}

const avatar = (id, twitterUserId, nftId) => {
  const id = parseInt(nftId, 10);

  let { mnemonic } = await _getUser(twitterUserId);
  if (!mnemonic) {
    const spec = await _genKey(twitterUserId);
    mnemonic = spec.mnemonic;
  }

  const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
  const address = wallet.getAddressString();

  if (!isNaN(id)) {
    const hash = await contracts.NFT.methods.getHash(id).call();
    const [
      name,
      ext,
    ] = await Promise.all([
      contracts.NFT.methods.getMetadata(hash, 'name').call(),
      contracts.NFT.methods.getMetadata(hash, 'ext').call(),
    ]);

    const avatarPreview = `${previewHost}/${hash}${ext ? ('.' + ext) : ''}/preview.${previewExt}`;

    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarId', id + '');
    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarName', name);
    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarExt', ext);
    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarPreview', avatarPreview);

    SendMessage(id, 'Set avatar to ' + JSON.stringify(id));
  } else if (contentId) {
    const name = path.basename(contentId);
    const ext = path.extname(contentId).slice(1);
    const avatarPreview = `https://preview.exokit.org/[${contentId}]/preview.jpg`;

    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarId', contentId);
    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarName', name);
    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarExt', ext);
    await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'avatarPreview', avatarPreview);

    SendMessage(id, 'Set avatar to ' + JSON.stringify(contentId));
  } else {
    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();
    const avatarId = await contracts.Account.methods.getMetadata(address, 'avatarId').call();

    SendMessage(id, 'Current avatar is ' + JSON.stringify(avatarId));
  }
}

const monitizationPointer = (id, twitterUserId, pointerAddress) => {
  let { mnemonic } = await _getUser(twitterUserId);
  if (!mnemonic) {
    const spec = await _genKey(twitterUserId);
    mnemonic = spec.mnemonic;
  }

  if (pointerAddress) {
    const monetizationPointer = pointerAddress;
    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();
    const result = await runSidechainTransaction(mnemonic)('Account', 'setMetadata', address, 'monetizationPointer', monetizationPointer);

    SendMessage(id, 'Set monetization pointer to ' + JSON.stringify(monetizationPointer));
  } else {
    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();
    const monetizationPointer = await contracts.Account.methods.getMetadata(address, 'monetizationPointer').call();

    SendMessage(id, 'Monetization pointer is ' + JSON.stringify(monetizationPointer));
  }
}

const key = (id) => {
  let { mnemonic } = await _getUser(twitterUserId);
  if (!mnemonic) {
    const spec = await _genKey(twitterUserId);
    mnemonic = spec.mnemonic;
  }

  const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
  const address = wallet.getAddressString();
  const privateKey = wallet.privateKey.toString('hex');

  SendMessage(id, 'Address: `' + address + '`\nMnemonic:' + mnemonic + '\nPrivate key: ' + privateKey)
}

const transfer = (id, twitterUserId, addressToTransferTo, nftId, quantity) => {
  const id = parseInt(nftId);
  let quantity = quantity ? parseInt(quantity, 10) : 1;

  if (isNaN(id)) {
    SendMessage("Invalid token ID");
    return;
  }
  if (isNaN(quantity)) {
    SendMessage(id, 'Invalid quantity: ' + quantity);
    return;
  }

  if (match = addressToTransferTo.match(/<@!?([0-9]+)>/)) {
    const userId = match[1];
    let mnemonic, mnemonic2;
    if (userId !== twitterUserId) {
      {
        const userSpec = await _getUser(twitterUserId);
        mnemonic = userSpec.mnemonic;
        if (!mnemonic) {
          const spec = await _genKey(twitterUserId);
          mnemonic = spec.mnemonic;
        }
      }
      {
        const userSpec = await _getUser(user.id);
        mnemonic2 = userSpec.mnemonic;
        if (!mnemonic2) {
          const spec = await _genKey(userId);
          mnemonic2 = spec.mnemonic;
        }
      }
    } else {
      const treasurer = member.roles.cache.some(role => role.name === treasurerRoleName);
      if (treasurer) {
        mnemonic = treasuryMnemonic;
        {
          const userSpec = await _getUser(twitterUserId);
          mnemonic2 = userSpec.mnemonic;
          if (!mnemonic2) {
            const spec = await _genKey(twitterUserId);
            mnemonic2 = spec.mnemonic;
          }
        }
      } else {
        SendMessage(id, `Only treasurers are allowed to do this`);
        return;
      }
    }

    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();

    const wallet2 = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic2)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address2 = wallet2.getAddressString();

    let status = true, transactionHash;
    try {
      const hash = await contracts.NFT.methods.getHash(id).call();

      const ids = [];
      const nftBalance = await contracts.NFT.methods.balanceOf(address).call();
      for (let i = 0; i < nftBalance; i++) {
        const id = await contracts.NFT.methods.tokenOfOwnerByIndex(address, i).call();
        const hash2 = await contracts.NFT.methods.getHash(id).call();
        if (hash2 === hash) {
          ids.push(id);
        }
      }
      ids.sort();

      if (ids.length >= quantity) {
        const isApproved = await contracts.NFT.methods.isApprovedForAll(address, contracts['Trade']._address).call();
        if (!isApproved) {
          await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts['Trade']._address, true);
        }

        for (let i = 0; i < quantity; i++) {
          const id = ids[i];
          const result = await runSidechainTransaction(mnemonic)('NFT', 'transferFrom', address, address2, id);
          status = status && result.status;
          transactionHash = result.transactionHash;
        }
      } else {
        status = false;
        transactionHash = 'insufficient nft balance';
      }
    } catch (err) {
      console.warn(err.stack);
      status = false;
      transactionHash = '0x0';
    }

    if (status) {
      SendMessage(id, 'Transferred ' + id + (quantity > 1 ? `(x${quantity})` : '') + ' to ' + userId);
    } else {
      SendMessage(id, `ERROR: Couldn't transfer ` + id + (quantity > 1 ? `(x${quantity})` : '') + ' to ' + userId);
    }

  } else if (match = addressToTransferTo.match(/^(0x[0-9a-f]+)$/i)) {
    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }

    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();

    const address2 = match[1];

    let status = true;
    for (let i = 0; i < quantity; i++) {
      try {
        const isApproved = await contracts.NFT.methods.isApprovedForAll(address, contracts['Trade']._address).call();
        if (!isApproved) {
          await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts['Trade']._address, true);
        }

        const result = await runSidechainTransaction(mnemonic)('NFT', 'transferFrom', address, address2, id);
        status = status && result.status;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        break;
      }
    }

    if (status) {
      SendMessage(id, 'transferred ' + id + ' to ' + address2);
    } else {
      SendMessage(id, 'could not transfer: ' + status);
    }
  } else if (addressToTransferTo === 'treasury') {
    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }

    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();

    const wallet2 = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(treasuryMnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address2 = wallet2.getAddressString();

    let status = true;
    for (let i = 0; i < quantity; i++) {
      try {
        const isApproved = await contracts.NFT.methods.isApprovedForAll(address, contracts['Trade']._address).call();
        if (!isApproved) {
          await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts['Trade']._address, true);
        }

        const result = await runSidechainTransaction(mnemonic)('NFT', 'transferFrom', address, address2, id);
        status = status && result.status;
      } catch (err) {
        console.warn(err.stack);
        status = false;
        break;
      }
    }

    if (status) {
      SendMessage(id, twitterUserId + ' transferred ' + id + ' to treasury');
    } else {
      SendMessage(id, `Couldn't transfer ${id} to treasury`);
    }

  }
}

  const preview = (id, twitterUserId, nftId, raw) => {
    const id = parseInt(nftId, 10);
    const raw = raw === 'raw';

    const hash = await contracts.NFT.methods.getHash(id).call();
    const ext = await contracts.NFT.methods.getMetadata(hash, 'ext').call();

    if (ext) {
      if (!raw) {
        SendMessage(id, '${twitterUserId} ${id}: https://preview.exokit.org/${hash}.${ext}/preview.png');
      } else {
        const url = `https://ipfs.exokit.org/${hash}/src.${ext}`;
        const screenshotUrl = `https://app.webaverse.com/screenshot.html?url=${url}&hash=${hash}&ext=${ext}&type=png`;
        SendMessage(id, `${twitterUserId} ${id}: ${screenshotUrl}`);
      }
    } else {
      SendMessage(id, `${twitterUserId} ${id}: Cannot preview file type: ${ext}`);
    }
    SendMessage(id, 'preview')
  }

  const gif = (id, twitterUserId, nftId) => {
    const id = parseInt(nftId, 10);

    const hash = await contracts.NFT.methods.getHash(id).call();
    const ext = await contracts.NFT.methods.getMetadata(hash, 'ext').call();

    if (ext) {
      SendMessage(id, `${twitterUserId} ${id}: https://preview.exokit.org/${hash}.${ext}/preview.gif`);
    } else {
      SendMessage(id, `${twitterUserId} ${id}: Cannot preview file type ${ext}`);
    }
    SendMessage(id, 'gif')
  }

  const wget = (id, twitterUserId, nftId) => {
    SendMessage(id, 'wget')
    const id = parseInt(nftId, 10);

    if (isNaN(id)){
      SendMessage(id, `${twitterUserId} Invalid token id:${id}`);
      return;
    }

      let { mnemonic } = await _getUser(twitterUserId);
      if (!mnemonic) {
        const spec = await _genKey(twitterUserId);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
      const address = wallet.getAddressString();
      let owner = await contracts.NFT.methods.ownerOf(id).call();
      owner = owner.toLowerCase();
      if (owner === address) {
        const hash = await contracts.NFT.methods.getHash(id).call();
        const [
          name,
          ext,
        ] = await Promise.all([
          contracts.NFT.methods.getMetadata(hash, 'name').call(),
          contracts.NFT.methods.getMetadata(hash, 'ext').call(),
        ]);

        const buffer = await _readStorageHashAsBuffer(hash);

        // TODO: wget isn't really implemented, just sending IPFS URL

        SendMessage(id, `${twitterUserId} ${id} is this: https://ipfs.exokit.org/${hash}/src.${ext}`);
      } else {
        SendMessage(id, `${twitterUserId} Not your token: ${id}`);
      }

  }

  const get = (id, twitterUserId, nftId, key) => {
    const id = parseInt(nftId, 10);
    const hash = await contracts.NFT.methods.getHash(id).call();
    const value = await contracts.NFT.methods.getMetadata(hash, key).call();
    SendMessage(id, `${twitterUserId} ${id} ${key}: ${value}`);
  }

  const set = (id, twitterUserId, nftId, metaDataKey, metaDataValue) => {
    SendMessage(id, 'set')
    const id = parseInt(nftId, 10);
    const key = metaDataKey;
    const value = metaDataValue;

    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }

    const hash = await contracts.NFT.methods.getHash(id).call();

    let status, transactionHash;
    try {
      const result = await runSidechainTransaction(mnemonic)('NFT', 'setMetadata', hash, key, value);
      status = result.status;
      transactionHash = result.transactionHash;
    } catch (err) {
      console.warn(err.stack);
      status = false;
      transactionHash = '0x0';
    }

    if (status) {
      SendMessage(id, `${twitterUserId} ${id} ${key} = ${value}`);
    } else {
      SendMessage(id, `${twitterUserId} Could not set ${key} for ${id}: ${transactionHash}`);
    }
  }

  const mint = (id, twitterUserId, url, quantity = 1, attachment) => {
    let quantity = parseInt(quantity, 10);
    let manualUrl;
    if (isNaN(quantity)) {
      quantity = 1;
    }

    manualUrl = url;

    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }

    const files = [];
    if (manualUrl) {
      const match = manualUrl.match(/^http(s)?:\/\//);
      if (match) {
        const proxyRes = await new Promise((accept, reject) => {
          const proxyReq = (match[1] ? https : http).request(manualUrl, proxyRes => {
            proxyRes.name = manualUrl.match(/\/([^\/]+?)(?:\?.*)?$/)[1];
            if (!/\/..+$/.test(proxyRes.name)) {
              const contentType = proxyRes.headers['content-type'];
              if (contentType) {
                const ext = mime.getExtension(contentType) || 'bin';
                proxyRes.name += '.' + ext;
              }
            }
            accept(proxyRes);
          });
          proxyReq.once('error', reject);
          proxyReq.end();
        });
        files.push(proxyRes);
      }
    } else if (attachment) {
      // TODO: Handle uploaded attachment
      console.warn("Need to handle uploaded attachment")
        // const { name, url } = attachment;

        // const proxyRes = await new Promise((accept, reject) => {
        //   const proxyReq = https.request(url, proxyRes => {
        //     proxyRes.name = name;
        //     accept(proxyRes);
        //   });
        //   proxyReq.once('error', reject);
        //   proxyReq.end();
        // });
        // files.push(proxyRes);

      }
    if (files.length > 0) {
      await Promise.all(files.map(async file => {
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
            const { hash } = j;

            const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
            const address = wallet.getAddressString();

            const fullAmount = {
              t: 'uint256',
              v: new web3.utils.BN(1e9)
                .mul(new web3.utils.BN(1e9))
                .mul(new web3.utils.BN(1e9)),
            };
            const fullAmountD2 = {
              t: 'uint256',
              v: fullAmount.v.div(new web3.utils.BN(2)),
            };

            let status, transactionHash, tokenIds;
            try {
              let allowance = await contracts.FT.methods.allowance(address, contracts['NFT']._address).call();
              allowance = new web3.utils.BN(allowance, 10);
              if (allowance.lt(fullAmountD2.v)) {
                const result = await runSidechainTransaction(mnemonic)('FT', 'approve', contracts['NFT']._address, fullAmount.v);
                status = result.status;
              } else {
                status = true;
              }
              if (status) {
                const description = '';
                const extName = path.extname(file.name).slice(1);
                const fileName = extName ? file.name.slice(0, -(extName.length + 1)) : file.name;
                console.log('minting', ['NFT', 'mint', address, hash, fileName, extName, description, quantity]);
                const result = await runSidechainTransaction(mnemonic)('NFT', 'mint', address, hash, fileName, extName, description, quantity);
                status = result.status;
                transactionHash = result.transactionHash;
                const tokenId = new web3.utils.BN(result.logs[0].topics[3].slice(2), 16).toNumber();
                tokenIds = [tokenId, tokenId + quantity - 1];
              }
            } catch (err) {
              console.warn(err.stack);
              status = false;
              transactionHash = err.message;
              tokenIds = [];
            }

            if (status) {
              SendMessage(id, 'Minted ' + (tokenIds[0] === tokenIds[1] ? ('https://webaverse.com/assets/' + tokenIds[0]) : tokenIds.map(n => 'https://webaverse.com/assets/' + n).join(' - ')) + ' (' + hash + ')');
            } else {
              SendMessage(id, 'Mint transaction failed: ' + transactionHash);
            }
          });
          res.on('error', err => {
            console.warn(err.stack);
            SendMessage(id, 'Mint failed: ' + err.message);
          });
        });
        req.on('error', err => {
          console.warn(err.stack);
          SendMessage(id, 'Mint failed: ' + err.message);
        });
        file.pipe(req);
      }));
    } else {
      SendMessage(id, 'No files to mint');
    }
  }

  const update = (id, twitterUserId, nftId, url, attachment) => {
    const tokenId = parseInt(nftId, 10);
    const manualUrl = url;

    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }

    const files = [];
    if (manualUrl) {
      const match = manualUrl.match(/^http(s)?:\/\//);
      if (match) {
        const proxyRes = await new Promise((accept, reject) => {
          const proxyReq = (match[1] ? https : http).request(manualUrl, proxyRes => {
            proxyRes.name = manualUrl.match(/\/([^\/]+?)(?:\?.*)?$/)[1];
            if (!/\/..+$/.test(proxyRes.name)) {
              const contentType = proxyRes.headers['content-type'];
              if (contentType) {
                const ext = mime.getExtension(contentType) || 'bin';
                proxyRes.name += '.' + ext;
              }
            }
            accept(proxyRes);
          });
          proxyReq.once('error', reject);
          proxyReq.end();
        });
        files.push(proxyRes);
      }
    } else if (attachment) {
      // TODO: Handle attachment
        // const { name, url } = attachment;

        // const proxyRes = await new Promise((accept, reject) => {
        //   const proxyReq = https.request(url, proxyRes => {
        //     proxyRes.name = name;
        //     accept(proxyRes);
        //   });
        //   proxyReq.once('error', reject);
        //   proxyReq.end();
        // });
        // files.push(proxyRes);
    }
    if (files.length > 0) {
      const oldHash = await contracts.NFT.methods.getHash(tokenId).call();

      await Promise.all(files.map(async file => {
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
            const { hash } = j;

            const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
            const address = wallet.getAddressString();

            const fullAmount = {
              t: 'uint256',
              v: new web3.utils.BN(1e9)
                .mul(new web3.utils.BN(1e9))
                .mul(new web3.utils.BN(1e9)),
            };

            let status, transactionHash;
            try {
              {
                const result = await runSidechainTransaction(mnemonic)('NFT', 'updateHash', oldHash, hash);
                status = result.status;
                transactionHash = '0x0';
              }
              if (status) {
                const extName = path.extname(file.name).slice(1);
                const fileName = extName ? file.name.slice(0, -(extName.length + 1)) : file.name;
                await Promise.all([
                  runSidechainTransaction(mnemonic)('NFT', 'setMetadata', hash, 'name', fileName),
                  runSidechainTransaction(mnemonic)('NFT', 'setMetadata', hash, 'ext', extName)
                ]);
                status = true;
                transactionHash = '0x0';
              }
            } catch (err) {
              console.warn(err.stack);
              status = false;
              transactionHash = err.message;
            }

            if (status) {
              SendMessage(id, 'Updated ' + tokenId + ' to ' + hash);
            } else {
              SendMessage(id, 'Update transaction failed: ' + transactionHash);
            }
          });
          res.on('error', err => {
            console.warn(err.stack);
            SendMessage(id, 'Update failed: ' + err.message);
          });
        });
        req.on('error', err => {
          console.warn(err.stack);
          SendMessage(id, 'Update failed: ' + err.message);
        });
        file.pipe(req);
      }));
    } else {
      SendMessage(id, 'No files to update');
    }
  }

  const packs = (id, twitterUserId, userOrNftId) => {
    SendMessage(id, 'packs')
    const tokenId = parseInt(userOrNftId, 10);
    let match;
    if (!isNaN(tokenId)) {
      const packedBalance = await contracts.NFT.methods.getPackedBalance(tokenId).call();
      SendMessage(id, 'Packed balance of #' + tokenId + ': ' + packedBalance);
    } else {
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

        userLabel = userId;
      };
      const _loadFromAddress = a => {
        address = a;
        userLabel = '`0x' + a + '`';
      };
      const _loadFromTreasury = () => {
        const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(treasuryMnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
        address = wallet.getAddressString();
        userLabel = 'treasury';
      };
      if (userOrNftId && (match = userOrNftId.match(/<@!?([0-9]+)>/))) {
        await _loadFromUserId(match[1]);
      } else if (userOrNftId && (match = userOrNftId.match(/^0x([0-9a-f]+)$/i))) {
        _loadFromAddress(match[1]);
      } else if (userOrNftId >= 2 && userOrNftId === 'treasury') {
        _loadFromTreasury();
      } else {
        await _loadFromUserId(twitterUserId);
      }

      const nftBalance = await contracts.NFT.methods.balanceOf(address).call();
      const packedBalances = [];
      for (let i = 0; i < nftBalance; i++) {
        const id = await contracts.NFT.methods.tokenOfOwnerByIndex(address, i).call();
        const packedBalance = await contracts.NFT.methods.getPackedBalance(id).call();
        if (packedBalance > 0) {
          packedBalances.push({
            id,
            packedBalance,
          });
        }
      }

      let s = userLabel + '\'s packs:\n';
      if (packedBalances.length > 0) {
        s += packedBalances.map((pack, i) => `${pack.id}. contains ${pack.packedBalance} FT`).join('\n');
      } else {
        s += 'Packs empty';
      }
      SendMessage(id, s);
    }
  }

  const pack = (id, twitterUserId, nftId, amount) => {
    const tokenId = parseInt(nftId, 10);
    amount = parseInt(amount, 10);
    if (!isNaN(tokenId) && !isNaN(amount)) {
      let { mnemonic } = await _getUser(twitterUserId);
      if (!mnemonic) {
        const spec = await _genKey(twitterUserId);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
      const address = wallet.getAddressString();

      const fullAmount = {
        t: 'uint256',
        v: new web3.utils.BN(1e9)
          .mul(new web3.utils.BN(1e9))
          .mul(new web3.utils.BN(1e9)),
      };
      const fullAmountD2 = {
        t: 'uint256',
        v: fullAmount.v.div(new web3.utils.BN(2)),
      };

      let status;
      try {
        {
          let allowance = await contracts.FT.methods.allowance(address, contracts['NFT']._address).call();
          allowance = new web3.utils.BN(allowance, 10);
          if (allowance.lt(fullAmountD2.v)) {
            const result = await runSidechainTransaction(mnemonic)('FT', 'approve', contracts['NFT']._address, fullAmount.v);
            status = result.status;
          } else {
            status = true;
          }
        }
        if (status) {
          const result = await runSidechainTransaction(mnemonic)('NFT', 'pack', address, tokenId, amount);
          status = result.status;
        }
      } catch (err) {
        console.warn(err);
      }

      if (status) {
        SendMessage(id, 'Packed ' + amount + ' into #' + tokenId);
      } else {
        SendMessage(id, 'Failed to pack FT into NFT: ' + tokenId);
      }
    } else {
      SendMessage(id, 'Invalid token id: ' + tokenId);
    }
  }

  const unpack = (id, twitterUserId, nftId, amount) => {
    const tokenId = parseInt(nftId, 10);
    amount = parseInt(amount, 10);
    if (!isNaN(tokenId) && !isNaN(amount)) {
      let { mnemonic } = await _getUser(twitterUserId);
      if (!mnemonic) {
        const spec = await _genKey(twitterUserId);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
      const address = wallet.getAddressString();

      const result = await runSidechainTransaction(mnemonic)('NFT', 'unpack', address, tokenId, amount);

      if (result.status) {
        SendMessage(id, 'Unpacked ' + amount + ' from #' + tokenId);
      } else {
        SendMessage(id, 'Failed to unpack FT from NFT: ' + tokenId);
      }
    } else {
      SendMessage(id, 'Invalid token id: ' + nftId);
    }
  }

  const store = (id, twitterUserId, user) => {
    SendMessage(id, 'store')
    let address;
    if (user >= 2 && (match = user.match(/<@!?([0-9]+)>/))) {
      const userId = match[1];
      let { mnemonic } = await _getUser(userId);
      if (!mnemonic) {
        const spec = await _genKey(userId);
        mnemonic = spec.mnemonic;
      }

      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
      address = wallet.getAddressString();
    } else {
      address = treasuryAddress;
    }

    const booths = await getStores();

    let s = '';
    const booth = booths.find(booth => booth.seller === address);
    if (booth && booth.entries.length > 0) {
      try {
        const [names, packedBalances] = await Promise.all([
          Promise.all(booth.entries.map(async entry => {
            const hash = await contracts.NFT.methods.getHash(entry.tokenId).call();
            const name = await contracts.NFT.methods.getMetadata(hash, 'name').call();
            return name;
          })),
          Promise.all(booth.entries.map(async entry => {
            const packedBalance = await contracts.NFT.methods.getPackedBalance(entry.tokenId).call();
            return packedBalance;
          })),
        ]);

        s += (booth.seller !== treasuryAddress ? booth.seller : 'treasury') + '\'s store: ' + booth.entries.map((entry, i) => `#${entry.id}: NFT ${entry.tokenId} (${names[i]}${packedBalances[i] > 0 ? (' + ' + packedBalances[i] + ' FT') : ''}) for ${entry.price.toNumber()} FT`).join('\n') + '';
      } catch (err) {
        console.warn(err);
      }
    } else {
      s += (address !== treasuryAddress ? address : 'treasury') + '\'s store: empty';
    }
    SendMessage(id, s);
  }

  const sell = (id, twitterUserId, nftId, price) => {
    SendMessage(id, 'sell')
    const tokenId = nftId;
    price = parseInt(price, 10);
    if (isNaN(price)) {
      SendMessage(id, 'invalid price: ' + price);
      return;
    }

      let { mnemonic } = await _getUser(twitterUserId);
      if (!mnemonic) {
        const spec = await _genKey(twitterUserId);
        mnemonic = spec.mnemonic;
      }
      const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
      const address = wallet.getAddressString();

      const ownTokenIds = [];
      const nftBalance = await contracts.NFT.methods.balanceOf(address).call();
      for (let i = 0; i < nftBalance; i++) {
        const id = await contracts.NFT.methods.tokenOfOwnerByIndex(address, i).call();
        ownTokenIds.push(id);
      }

      const treasuryTokenIds = [];
      const member = await message.channel.guild.members.fetch(twitterUserId);
      const treasurer = member.roles.cache.some(role => role.name === treasurerRoleName);
      if (treasurer) {
        const nftBalance = await contracts.NFT.methods.balanceOf(treasuryAddress).call();
        for (let i = 0; i < nftBalance; i++) {
          const id = await contracts.NFT.methods.tokenOfOwnerByIndex(treasuryAddress, i).call();
          treasuryTokenIds.push(id);
        }
      }

      // const store = await getStore();
      if (ownTokenIds.includes(tokenId)) {
        let status, buyId;
        try {
          const isApproved = await contracts.NFT.methods.isApprovedForAll(address, contracts['Trade']._address).call();
          if (!isApproved) {
            await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts['Trade']._address, true);
          }
          // buyId = await contracts.Trade.methods.addStore(tokenId, price).call();
          const buySpec = await runSidechainTransaction(mnemonic)('Trade', 'addStore', tokenId, price);
          // console.log('got buy spec', JSON.stringify(buySpec, null, 2));
          buyId = parseInt(buySpec.logs[0].topics[1]);

          status = true;
        } catch (err) {
          console.warn(err.stack);
          status = false;
          buyId = -1;
        }

        if (status) {
          SendMessage(id, 'sale #' + buyId + ': NFT ' + tokenId + ' for ' + price + ' FT');
        } else {
          SendMessage(id, 'failed to list nft: ' + tokenId);
        }
      } else if (treasuryTokenIds.includes(tokenId)) {
        let status, buyId;
        try {
          const isApproved = await contracts.NFT.methods.isApprovedForAll(address, contracts['Trade']._address).call();
          if (!isApproved) {
            await runSidechainTransaction(treasuryMnemonic)('NFT', 'setApprovalForAll', contracts['Trade']._address, true);
          }
          const buySpec = await runSidechainTransaction(treasuryMnemonic)('Trade', 'addStore', tokenId, price);
          buyId = parseInt(buySpec.logs[0].topics[1]);

          status = true;
        } catch (err) {
          console.warn(err.stack);
          status = false;
          buyId = -1;
        }

        if (status) {
          SendMessage(id, 'sale #' + buyId + ': NFT ' + tokenId + ' for ' + price + ' FT');
        } else {
          SendMessage(id, 'failed to list nft: ' + tokenId);
        }
      } else {
        SendMessage(id, 'not your nft: ' + tokenId);
      }
  }

  const unsell = (id, twitterUserId, buyId) => {
    SendMessage(id, 'unsell')
    buyId = parseInt(buyId, 10);
    if (isNaN(buyId)){
      SendMessage(id, 'invalid sell id: ' + buyId);
      return;
    }

      let { mnemonic } = await _getUser(twitterUserId);
      if (!mnemonic) {
        const spec = await _genKey(twitterUserId);
        mnemonic = spec.mnemonic;
      }

      let status;
      try {
        await runSidechainTransaction(mnemonic)('Trade', 'removeStore', buyId);

        status = true;
      } catch (err) {
        console.warn(err.stack);
        status = false;
      }

      if (status) {
        SendMessage(id, 'unlisted sell ' + buyId);
      } else {
        SendMessage(id, 'unlist failed: ' + buyId);
      }
  }

  const buy = (id, twitterUserId, buyId) => {
    buyId = parseInt(buyId, 10);

    let { mnemonic } = await _getUser(twitterUserId);
    if (!mnemonic) {
      const spec = await _genKey(twitterUserId);
      mnemonic = spec.mnemonic;
    }
    const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
    const address = wallet.getAddressString();

    const fullAmount = {
      t: 'uint256',
      v: new web3.utils.BN(1e9)
        .mul(new web3.utils.BN(1e9))
        .mul(new web3.utils.BN(1e9)),
    };
    const fullAmountD2 = {
      t: 'uint256',
      v: fullAmount.v.div(new web3.utils.BN(2)),
    };

    let status, tokenId, price;
    try {
      {
        let allowance = await contracts.FT.methods.allowance(address, contracts['Trade']._address).call();
        allowance = new web3.utils.BN(allowance, 10);
        if (allowance.lt(fullAmountD2.v)) {
          await runSidechainTransaction(mnemonic)('FT', 'approve', contracts['Trade']._address, fullAmount.v);
        }
      }
      await runSidechainTransaction(mnemonic)('Trade', 'buy', buyId);

      const store = await contracts.Trade.methods.getStoreByIndex(buyId).call();
      tokenId = parseInt(store.id, 10);
      price = new web3.utils.BN(store.price);

      status = true;
    } catch (err) {
      console.warn(err.stack);
      status = false;
    }

    if (status) {
      SendMessage(id, 'Got sale #' + tokenId + ' for ' + price.toNumber() + ' FT.');
    } else {
      SendMessage(id, 'Buy failed');
    }
  }

  const HandleResponse = (id, name, receivedMessage) => {
    const commandType = receivedMessage.split(" ")[0].replace(".", "");
    const commandArg1 = receivedMessage.split(" ")[1] ?? null;
    const commandArg2 = receivedMessage.split(" ")[2] ?? null;
    const commandArg3 = receivedMessage.split(" ")[3] ?? null;

    switch (commandType) {
      case 'help':
        help(id, name);
        break;
      case 'status':
        status(id, name);
        break;
      case 'inventory':
        inventory(id, name, commandArg1);
        break;
      case 'address':
        address(id, name, commandArg1);
        break;
      case 'key':
        key(id, name, commandArg1);
        break;
      case 'name':
        name(id, name, commandArg1);
        break;
      case 'monitizationPointer':
        monitizationPointer(id, name, commandArg1);
        break;
      case 'avatar':
        avatar(id, name, commandArg1);
        break;
      case 'send':
        send(id, name, commandArg1, commandArg2);
        break;
      case 'transfer':
        transfer(id, name, commandArg1, commandArg2, commandArg3);
        break;
      case 'preview':
        preview(id, name, commandArg1, commandArg2);
        break;
      case 'gif':
        gif(id, name, commandArg1);
        break;
      case 'wget':
        wget(id, name, commandArg1);
        break;
      case 'get':
        get(id, name, commandArg1, commandArg2);
        break;
      case 'set':
        set(id, name, commandArg1, commandArg2);
        break;
      case 'mint':
        mint(id, name, commandArg1, commandArg2);
        break;
      case 'update':
        update(id, name, commandArg1);
        break;
      case 'packs':
        packs(id, name, commandArg1);
        break;
      case 'pack':
        pack(id, name, commandArg1, commandArg2);
        break;
      case 'unpack':
        unpack(id, name, commandArg1, commandArg2);
        break;
      case 'store':
        store(id, name, commandArg1);
        break;
      case 'sell':
        sell(id, name, commandArg1, commandArg2);
        break;
      case 'unsell':
        unsell(id, name, commandArg1);
        break;
      case 'buy':
        buy(id, name, commandArg1);
        break;
      default:
        SendMessage(id, `I don't understand. Try "help" for help.`);
    }
  }

  const validateWebhook = (token, auth) => {
    console.log("token")
    const responseToken = crypto.createHmac('sha256', auth).update(token).digest('base64');
    return { response_token: `sha256=${responseToken}` };
  }

  exports.createTwitterClient = async (getStoresFunction, runSidechainTransactionFunction, database, treasuryAddress) => {
    if (twitterConfigInvalid)
      return console.warn("*** No bot config found for Twitter client, skipping initialization")

    ddb = database;
    getStores = getStoresFunction;
    runSidechainTransaction = runSidechainTransactionFunction;

    TwitClient = new require('twit')({
      consumer_key: twitterConsumerKey,
      consumer_secret: twitterConsumerSecret,
      access_token: twitterAccessToken,
      access_token_secret: twitterAccessTokenSecret
    });

    const webhook = new Autohook({
      token: twitterAccessToken,
      token_secret: twitterAccessTokenSecret,
      consumer_key: twitterConsumerKey,
      consumer_secret: twitterConsumerSecret,
      ngrok_secret: ngrokToken,
      env: 'dev',
      port: twitterWebhookPort ?? 1337
    });
    await webhook.removeWebhooks();
    webhook.on('event', event => {

      if (typeof (event.direct_message_events) !== 'undefined') {
        if (event.direct_message_events[0].message_create.sender_id !== twitterId) {
          const id = event.direct_message_events[0].message_create.sender_id;
          const name = event.users[event.direct_message_events[0].message_create.sender_id].screen_name;
          const ReceivedMessage = event.direct_message_events[0].message_create.message_data.text;
          if (twitterId !== name)
            HandleResponse(id, name, ReceivedMessage)
        }
      }
    });
    await webhook.start();
    await webhook.subscribe({ oauth_token: twitterAccessToken, oauth_token_secret: twitterAccessTokenSecret });

    // handle this
    http.createServer((req, res) => {
      const route = url.parse(req.url, true);

      if (!route.pathname) {
        return;
      }

      if (route.query.crc_token) {
        console.log("Validating webhook")
        console.log(route.query.crc_token)
        const crc = validateWebhook(route.query.crc_token, twitterConsumerSecret);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(crc));
      }
    }).listen(serverPort ?? 3000);
  }