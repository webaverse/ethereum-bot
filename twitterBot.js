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

const ResponseHandler = {
    '.help': (id) => {
      SendMessage(id, 'Commands')
    },
    default(id) {
      SendMessage(id, `I don't understand`)
    }
  }

const validateWebhook = (token, auth) => {
  console.log("token")
  const responseToken = crypto.createHmac('sha256', auth).update(token).digest('base64');
  return { response_token: `sha256=${responseToken}` };
}

const event_ = (event) => {
  if (typeof (event.direct_message_events) !== 'undefined') {
    if (event.direct_message_events[0].message_create.sender_id == twitterId) return;
    const id = event.direct_message_events[0].message_create.sender_id;
    const name = event.users[event.direct_message_events[0].message_create.sender_id].screen_name;
    const ReceivedMessage = event.direct_message_events[0].message_create.message_data.text;
    const Response = ResponseHandler[ReceivedMessage.split(" ")[0]]
    if (Response) {
      Response(id, ReceivedMessage, name);
    } else {
      ResponseHandler['default'](id)
    }
  }
};

exports.createTwitterClient = async (getStores, runSidechainTransaction, ddb, treasuryAddress) => {
  if (twitterConfigInvalid)
    return console.warn("*** No bot config found for Twitter client, skipping initialization")

console.log(twitterConsumerKey)
console.log(twitterConsumerSecret)
console.log(twitterAccessToken)
console.log(twitterAccessTokenSecret)


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

        const Response = ResponseHandler[ReceivedMessage.split(" ")[0]]
        if (Response) {
          Response(id, ReceivedMessage, name);
        } else {
          ResponseHandler['default'](id)
        }
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

    if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        event_(body, req)
        res.writeHead(200);
        res.end();
      });
    }
  }).listen(serverPort ?? 3000);
}