const { Autohook } = require('twitter-autohook');
const crypto = require('crypto');
const http = require('http');
const url = require('url');

const {
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

const status = (id, name) => {
  SendMessage(id, 'Status')
}

const inventory = (id, name) => {
  SendMessage(id, 'Inventory')
}

const address = (id, name) => {
  SendMessage(id, 'Address')
}

const avatar = (id, name, nftId) => {
  SendMessage(id, 'avatar')
}

const monitizationPointer = (id, name, pointerAddress) => {
  SendMessage(id, 'monitizationPointer')
}

const key = (id, name) => {
  SendMessage(id, 'Key')
}

const send = (id, name, userOrAddressOrTreasury, amount) => {
  SendMessage(id, 'send')
}

const transfer = (id, name, userOrAddressOrTreasury, amount, quantity) => {
  SendMessage(id, 'transfer')
}

const preview = (id, name, nftId) => {
  SendMessage(id, 'preview')
}

const gif = (id, name, nftId) => {
  SendMessage(id, 'gif')
}

const wget = (id, name, nftId) => {
  SendMessage(id, 'wget')
}

const get = (id, name, nftId, metaDataKey) => {
  SendMessage(id, 'get')
}

const set = (id, name, nftId, metaDataKey, metaDataValue) => {
  SendMessage(id, 'set')
}

const mint = (id, name, url) => {
  SendMessage(id, 'mint')
}

const update = (id, name, url) => {
  SendMessage(id, 'update')
}

const packs = (id, name, userOrNftId) => {
  SendMessage(id, 'packs')
}

const pack = (id, name, nftId, amount) => {
  SendMessage(id, 'pack')
}

const unpack = (id, name, nftId, amount) => {
  SendMessage(id, 'unpack')
}

const store = (id, name, user) => {
  SendMessage(id, 'store')
}

const sell = (id, name, nftId, price) => {
  SendMessage(id, 'sell')
}

const unsell = (id, name, saleid) => {
  SendMessage(id, 'unsell')
}

const buy = (id, name, saleid) => {
  SendMessage(id, 'Buy')
}

const HandleResponse = (id, name, receivedMessage ) => {
  const commandType = receivedMessage.split(" ")[0].replace(".", "");
  const commandArg1 = receivedMessage.split(" ")[1] ?? null;
  const commandArg2 = receivedMessage.split(" ")[2] ?? null;
  const commandArg3 = receivedMessage.split(" ")[3] ?? null;

  switch(commandType){
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
      preview(id, name, commandArg1);
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

exports.createTwitterClient = async (getStores, runSidechainTransaction, ddb, treasuryAddress) => {
  if (twitterConfigInvalid)
    return console.warn("*** No bot config found for Twitter client, skipping initialization")

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
        if(twitterId !== name)
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