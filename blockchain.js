const crypto = require('crypto');
const fetch = require('node-fetch');
const bip39 = require('bip39');
const flowJs = require('./flow.js');
const flow = {
  sdk: require('@onflow/sdk'),
  types: require('@onflow/types'),
  crypto: flowJs.crypto,
  signingFunction: flowJs.signingFunction,
};
const wordList = require('./wordlist.json');
const flowConstants = require('./flow-constants.js');
const config = require('./config.json');

let FungibleToken, NonFungibleToken, WebaverseToken, WebaverseNFT, WebaverseAccount, host;
flowConstants.load()
  .then(o => {
    FungibleToken = o.FungibleToken;
    NonFungibleToken = o.NonFungibleToken;
    WebaverseToken = o.WebaverseToken;
    WebaverseNFT = o.WebaverseNFT;
    WebaverseAccount = o.WebaverseAccount;
    host = o.host;
  });

// const makeMnemonic = () => bip39.entropyToMnemonic(crypto.randomBytes(32));
const genKeys = async mnemonic => {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  return flow.crypto.genKeys({
    entropy: seed.toString('hex'),
    entropyEnc: 'hex',
  });
};
function uint8Array2hex(uint8Array) {
  return Array.prototype.map.call(uint8Array, x => ('00' + x.toString(16)).slice(-2)).join('');
}
/* const _isSealed = tx => tx.status >= 4;
const _waitForTx = async txid => {
  for (;;) {
    const response2 = await flow.sdk.send(await flow.sdk.pipe(await flow.sdk.build([
      flow.sdk.getTransactionStatus(txid),
    ]), [
      flow.sdk.resolve([
        flow.sdk.resolveParams,
      ]),
    ]), { node: host });
    if (_isSealed(response2.transaction)) {
      return response2;
    } else {
      await new Promise((accept, reject) => {
        setTimeout(accept, 500);
      });
    }
  }
}; */

const createAccount = async ({bake = false} = {}) => {
  const res = await fetch('https://accounts.exokit.org/', {
    method: 'POST',
    body: JSON.stringify({
      bake,
    }),
  });
  return await res.json();
};

const signingFunction2 = flow.signingFunction.signingFunction(config.privateKey);
const _getType = type => {
  if (Array.isArray(type)) {
    return [_getType(type[0])];
  } else {
    return flow.types[type];
  }
};
/* const runTransaction = async spec => {
  let {
    address,
    privateKey,
    publicKey,
    mnemonic,

    limit,
    transaction,
    script,
    args = [],
    wait = false,
  } = spec;
  args = args.map(({value, type}) => {
    return flow.sdk.arg(value, _getType(type));
  });
  
  if (mnemonic) {
    const userKeys = await genKeys(mnemonic);
    privateKey = userKeys.privateKey;
    publicKey = userKeys.publicKey;
  }
  
  const chain = [];
  if (address) {
    const acctResponse = await flow.sdk.send(await flow.sdk.pipe(await flow.sdk.build([
      flow.sdk.getAccount(address),
    ]), [
      flow.sdk.resolve([
        flow.sdk.resolveParams,
      ]),
    ]), { node: host });
    const seqNum = acctResponse.account.keys[0].sequenceNumber;

    const signingFunction = flow.signingFunction.signingFunction(privateKey);

    chain.push(
      flow.sdk.authorizations([flow.sdk.authorization(address, signingFunction, 0)]),
      flow.sdk.payer(flow.sdk.authorization(config.address, signingFunction2, 0)),
      flow.sdk.proposer(flow.sdk.authorization(address, signingFunction, 0, seqNum)),
    );
  }
  if (limit) {
    chain.push(flow.sdk.limit(limit));
  }
  if (transaction) {
    chain.push(flow.sdk.transaction(transaction));
  } else if (script) {
    chain.push(flow.sdk.script(script));
  }
  if (args) {
    chain.push(flow.sdk.args(args));
  }
  let response = await flow.sdk.send(await flow.sdk.pipe(await flow.sdk.build(chain), [
    flow.sdk.resolve([
      flow.sdk.resolveArguments,
      flow.sdk.resolveParams,
      flow.sdk.resolveAccounts,
      flow.sdk.resolveRefBlockId({ node: host }),
      flow.sdk.resolveSignatures,
    ]),
  ]), { node: host });
  
  if (transaction) {
    if (wait) {
      response = await _waitForTx(response.transactionId);
    }
  }
  
  return response;
}; */

const contractSourceCache = {};
async function getContractSource(p) {
  let contractSource = contractSourceCache[p];
  if (!contractSource) {
    const res = await fetch('https://contracts.webaverse.com/flow/' + p);
    contractSource = await res.text();
    contractSource = await resolveContractSource(contractSource);
    contractSourceCache[p] = contractSource;
  }
  return contractSource;
}

async function resolveContractSource(contractSource) {
  const {FungibleToken, NonFungibleToken, WebaverseToken, WebaverseNFT, WebaverseAccount} = await flowConstants.load();
  return contractSource
    .replace(/NONFUNGIBLETOKENADDRESS/g, NonFungibleToken)
    .replace(/FUNGIBLETOKENADDRESS/g, FungibleToken)
    .replace(/WEBAVERSETOKENADDRESS/g, WebaverseToken)
    .replace(/WEBAVERSENFTADDRESS/g, WebaverseNFT)
    .replace(/WEBAVERSEACCOUNTADDRESS/g, WebaverseAccount);
}

function hexToWordList(hex) {
  const words = [];
  let n = BigInt('0x' + hex);
  n <<= 2n;
  while (n !== 0n) {
    const a = n & 0x7FFn;
    words.push(wordList[Number(a)]);
    n -= a;
    n >>= 11n;
  }
  return words.join(' ');
}
function wordListToHex(words) {
  words = words.split(/\s+/);

  let n = 0n;
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    const index = wordList.indexOf(word);
    const a = BigInt(index);
    n <<= 11n;
    n |= a;
  }
  n >>= 2n;
  return n.toString(16);
}

module.exports = {
  // makeMnemonic,
  genKeys,
  createAccount,
  // runTransaction,
  getContractSource,
  resolveContractSource,
  hexToWordList,
  wordListToHex,
};