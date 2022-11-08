const https = require("https");
const path = require("path");
const fs = require("fs");

const Discord = require("discord.js");
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const OpenAI = require("openai-api");

const {
  discordApiToken,
  treasuryMnemonic,
  encryptionMnemonic,
  openAiKey,
  infuraProjectId,
} = require("fs").existsSync("config.json")
  ? JSON.parse(require("fs").readFileSync("config.json"))
  : {
      tradeMnemonic: process.env.tradeMnemonic,
      treasuryMnemonic: process.env.treasuryMnemonic,
      discordApiToken: process.env.discordApiToken,
      infuraProjectId: process.env.infuraProjectId,
      genesisNftStartId: process.env.genesisNftStartId,
      genesisNftEndId: process.env.genesisNftEndId,
      encryptionMnemonic: process.env.encryptionMnemonic,
    };

const dBugUserIds = [
  "284377201233887233", // avaer
  "465586113835433984",
  "559354703746564096",
];
OpenAI.prototype._send_request = (() =>
  async function (url, method, opts = {}) {
    let camelToUnderscore = (key) => {
      let result = key.replace(/([A-Z])/g, " $1");
      return result.split(" ").join("_").toLowerCase();
    };

    // console.log('got req', url, method, opts);

    const data = {};
    for (const key in opts) {
      data[camelToUnderscore(key)] = opts[key];
    }

    const rs = await new Promise((accept, reject) => {
      const req = https.request(
        url,
        {
          method,
          headers: {
            Authorization: `Bearer ${this._api_key}`,
            "Content-Type": "application/json",
          },
        },
        (res) => {
          res.setEncoding("utf8");
          accept(res);
        }
      );
      req.end(Object.keys(data).length ? JSON.stringify(data) : "");
      req.on("error", reject);
    });
    return rs;
  })(OpenAI.prototype._send_request);
const openai = new OpenAI(openAiKey);

const _openAiCodex_Interaction = async (
  interaction,
  prompt,
  stop,
  blob = false
) => {
  if (dBugUserIds.includes(interaction.user.id)) {
    const m = await interaction.channel.send("(¬‿¬ ) . . . d-bugging . . .");

    const maxTokens = 4096;
    const gptRes = await openai.complete({
      engine: "davinci-codex",
      prompt,
      stop,
      temperature: 0,
      max_tokens: maxTokens - prompt.length,
      stream: true,

      /* stream: false,
      prompt: o.prompt, // 'this is a test',
      maxTokens: o.maxTokens, // 5,
      temperature: o.temperature, // 0.9,
      topP: o.topP, // 1,
      presencePenalty: o.presencePenalty, // 0,
      frequencyPenalty: o.frequencyPenalty, // 0,
      bestOf: o.bestOf, // 1,
      n: o.n, // 1,
      stop: o.stop, // ['\n'] */
    });
    let fullS = "";
    let done = false;
    const _updateMessage = (() => {
      let running = false;
      let queued = false;
      const _recurse = async () => {
        if (!blob) {
          if (!running) {
            running = true;
            await m.edit("```" + fullS + "```" + (done ? "\n( ‾́ ◡ ‾́ )" : ""));
            running = false;
            if (queued) {
              queued = false;
              _recurse();
            }
          } else {
            queued = true;
          }
        } else {
          if (done) {
            await m.delete();
          }
        }
      };
      return _recurse;
    })();
    gptRes.on("data", (s) => {
      try {
        if (!s.startsWith(`data: [DONE]`)) {
          s = s.replace(/^data: /, "").replace(/\n[\s\S]*$/m, "");
          console.log("got", { s });
          const j = JSON.parse(s);
          const { choices } = j;
          const { text } = choices[0];

          process.stdout.write(text);

          fullS += text;
          fullS = fullS.replace(/^\s+/, "").replace(/```+/g, "`");
          if (fullS) {
            _updateMessage();
          }
        } else {
          console.log();

          done = true;
          _updateMessage();
        }
      } catch (err) {
        console.log("got error", err);
      }
    });
    /* gptRes.on('end', () => {
      console.log('end');
    }); */

    // message.channel.send('```' + gptResponse.data.replace(/```/g, '`') +  '```');
  } else {
    interaction.channel.send(
      "no d-bug detected for user id " + interaction.user.id
    );
  }
};

// isCollaborator
// only collaborator can set
// only collaborator or owner can get

const { jsonParse } = require("../utilities.js");
const { usersTableName, treasurerRoleName } = require("../constants.js");
const { deploy_commands } = require("./deploy-commands.js");

// encryption/decryption of unlocks

const unlockableKey = "unlockable";

// locals

exports.trades = [];
exports.helps = [];
exports.inventories = [];
let nextTradeId = 0;
exports.updateTradeId = (increase) => {
  if (increase) {
    nextTradeId++;
  } else {
    nextTradeId--;
  }
  return nextTradeId;
};

exports.createDiscordClient = (
  web3,
  contracts,
  getStores,
  runSidechainTransaction,
  ddb,
  treasuryAddress
) => {
  if (
    discordApiToken === undefined ||
    discordApiToken === "" ||
    discordApiToken === null
  )
    return console.warn("*** WARNING: Discord API token is not defined");

  const client = new Client({
    intents: [
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.DirectMessages,
    ],
    presence: {
      status: "online",
      afk: false,
      activities: [
        {
          name: "Webaverse.com",
          type: Discord.ActivityType.Playing,
          url: "https://webaverse.com",
        },
      ],
    },
  });

  client.on("ready", async function () {
    console.log(`the client becomes ready to start`);
    console.log(`I am ready! Logged in as ${client.user.tag}!`);
    console.log(
      `Bot has started, with ${client.users.cache.size} users, in ${client.channels.cache.size} channels of ${client.guilds.cache.size} guilds.`
    );
    deploy_commands(client);

    // console.log('got', client.guilds.cache.get(guildId).members.cache);

    const commandsPath = path.join(__dirname, "commands");
    const commandσFolders = fs.readdirSync(commandsPath);

    client.on("interactionCreate", async (interaction) => {
      let command = null;
      for (const folder of commandσFolders) {
        if (folder === "not_used") {
          continue;
        }

        const _folder = commandsPath + "/" + folder;
        const commandFiles = fs
          .readdirSync(_folder)
          .filter((file) => file.endsWith(".js"));

        for (const file of commandFiles) {
          if (file === interaction.commandName + ".js") {
            const filePath = path.join(_folder, file);
            command = require(filePath);
            break;
          }
        }

        if (command && command !== undefined) {
          break;
        }
      }
      if (command && command !== undefined) {
        await interaction.reply({
          content: "running command " + interaction.commandName,
          ephemeral: command.isHidden,
        });

        const _getUser = async (id = interaction.user.id) => {
          const tokenItem = await ddb
            .getItem({
              TableName: usersTableName,
              Key: {
                email: { S: id + ".discordtoken" },
              },
            })
            .promise();

          let mnemonic =
            tokenItem.Item && tokenItem.Item.mnemonic
              ? tokenItem.Item.mnemonic.S
              : null;
          return { mnemonic };
        };
        const _genKey = async (id = interaction.user.id) => {
          const mnemonic = bip39.generateMnemonic();

          await ddb
            .putItem({
              TableName: usersTableName,
              Item: {
                email: { S: id + ".discordtoken" },
                mnemonic: { S: mnemonic },
              },
            })
            .promise();
          return { mnemonic };
        };

        const _getPage = () => {
          let page = interaction.options.getInteger("page");
          if (isNaN(page)) {
            page = 1;
          }
          return page;
        };
        const _items =
          (contractName, page, user, isUser, _address) =>
          async (getEntries) => {
            let address, userLabel, userName;
            const _loadFromUserId = async (userId) => {
              const spec = await _getUser(userId);
              let mnemonic = spec.mnemonic;
              if (!mnemonic) {
                const spec = await _genKey(userId);
                mnemonic = spec.mnemonic;
              }

              const wallet = hdkey
                .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
                .derivePath(`m/44'/60'/0'/0/0`)
                .getWallet();
              address = wallet.getAddressString();

              userLabel = "<@!" + userId + ">";
              const o = await Promise.all([
                contracts.Account.methods.getMetadata(address, "name").call(),
                contracts.Account.methods
                  .getMetadata(address, "avatarPreview")
                  .call(),
              ]);
              userName = o[0];
              avatarPreview = o[1];
            };
            const _loadFromAddress = async (a) => {
              address = a;
              userLabel = a;
              userName = a;
              avatarPreview = await contracts.Account.methods
                .getMetadata(address, "avatarPreview")
                .call();
            };
            const _loadFromTreasury = async () => {
              const wallet = hdkey
                .fromMasterSeed(bip39.mnemonicToSeedSync(treasuryMnemonic))
                .derivePath(`m/44'/60'/0'/0/0`)
                .getWallet();
              address = wallet.getAddressString();
              userLabel = "treasury";
              userName = userLabel;
              avatarPreview = await contracts.Account.methods
                .getMetadata(address, "avatarPreview")
                .call();
            };
            if (isUser) {
              await _loadFromUserId(user.id);
            } else if ((match = _address?.match(/^(0x[0-9a-f]+)$/i))) {
              await _loadFromAddress(match[1]);
            } else {
              await _loadFromTreasury();
            }

            const nftBalance = await contracts[contractName].methods
              .balanceOf(address)
              .call();
            const maxEntriesPerPage = 10;
            const numPages = Math.max(
              Math.ceil(nftBalance / maxEntriesPerPage),
              1
            );
            page = Math.min(Math.max(page, 1), numPages);
            const startIndex = (page - 1) * maxEntriesPerPage;
            const endIndex = Math.min(page * maxEntriesPerPage, nftBalance);

            const entries = await getEntries(address, startIndex, endIndex);

            return {
              userLabel,
              userName,
              avatarPreview,
              numPages,
              entries,
            };
          };

        try {
          await command.execute({
            interaction,
            client,
            _getUser,
            _genKey,
            web3,
            contracts,
            runSidechainTransaction,
            treasuryMnemonic,
            usersTableName,
            getStores,
            _getPage,
            _items,
            ddb,
            treasurerRoleName,
            treasuryAddress,
            unlockableKey,
            _openAiCodex: _openAiCodex_Interaction,
            encryptionMnemonic,
            infuraProjectId,
          });
        } catch (e) {
          console.log(e);
          await interaction.editReply({
            content: "There was an error executing " + interaction.commandName,
          });
        }
      } else {
        await interaction.reply({
          content: interaction.commandName + " not found!",
        });
      }
    });
    client.on("messageReactionAdd", async (reaction, user) => {
      const { message, emoji } = reaction;
      // console.log('emoji identifier', message, data, emoji);
      if (user.id !== client.user.id && emoji.identifier === "%E2%9D%8C") {
        // x
        if (message.channel.type === ChannelType.DM) {
          message.delete();
        } else {
          let helpIndex, trade, index;
          if (
            (helpIndex = exports.helps.findIndex(
              (help) => help.id === message.id
            )) !== -1
          ) {
            const help = exports.helps[helpIndex];
            if (help.requester.id === user.id) {
              await help.delete();
              exports.helps.splice(helpIndex, 1);
            }
          } else if (
            (trade = exports.trades.find((trade) => trade.id === message.id)) &&
            (index = exports.trade.userIds.indexOf(user.id)) !== -1
          ) {
            trade.cancel();
            exports.trades.splice(trades.indexOf(trade), 1);
          }
        }
      } else if (
        user.id !== client.user.id &&
        emoji.identifier === "%E2%9C%85"
      ) {
        // white check mark
        const trade = exports.trades.find((trade) => trade.id === message.id);
        if (trade) {
          const index = trade.userIds.indexOf(user.id);
          if (index >= 0) {
            trade.confirmations[index] = true;
            trade.render();

            if (trade.confirmations.every((confirmation) => !!confirmation)) {
              if (
                trade.confirmations2.every((confirmation) => !!confirmation)
              ) {
                trade.finish();
                exports.trades.splice(trades.indexOf(trade), 1);
              } else {
                trade.react("💞");
              }
            }
          }
        }
      } else if (
        user.id !== client.user.id &&
        emoji.identifier === "%F0%9F%92%9E"
      ) {
        // rotating hearts
        const trade = exports.trades.find((trade) => trade.id === message.id);
        if (trade) {
          const index = trade.userIds.indexOf(user.id);
          if (index >= 0) {
            trade.confirmations2[index] = true;
            trade.render();

            if (
              trade.confirmations.every((confirmation) => !!confirmation) &&
              trade.confirmations2.every((confirmation) => !!confirmation)
            ) {
              trade.finish();
              exports.trades.splice(trades.indexOf(trade), 1);
            }
          }
        }
      } else if (
        user.id !== client.user.id &&
        emoji.identifier === "%E2%97%80%EF%B8%8F"
      ) {
        // left arrow ◀️
        if (
          (inventoryIndex = exports.inventories.findIndex(
            (i) => i.id === message.id
          )) !== -1
        ) {
          const inventory = exports.inventories[inventoryIndex];
          if (inventory.requester.id === user.id) {
            inventory.left();
          }
        }
      } else if (
        user.id !== client.user.id &&
        emoji.identifier === "%E2%96%B6%EF%B8%8F"
      ) {
        // right arrow ▶️
        if (
          (inventoryIndex = exports.inventories.findIndex(
            (i) => i.id === message.id
          )) !== -1
        ) {
          const inventory = exports.inventories[inventoryIndex];
          if (inventory.requester.id === user.id) {
            inventory.right();
          }
        }
      }
    });
    client.on("messageReactionRemove", async (reaction, user) => {
      const { message, emoji } = reaction;
      if (user.id !== client.user.id && emoji.identifier === "%E2%9C%85") {
        // white check mark
        let trade, index;
        if (
          (trade = exports.trades.find((trade) => trade.id === message.id)) &&
          (index = trade.userIds.indexOf(user.id)) !== -1
        ) {
          trade.confirmations[index] = false;
          trade.render();

          const doneReactions = trade.reactions.cache.filter(
            (reaction) => reaction.emoji.identifier === "%F0%9F%92%9E"
          );
          // console.log('got done reactions', Array.from(doneReactions.values()).length);
          try {
            for (const reaction of doneReactions.values()) {
              const users = Array.from(reaction.users.cache.values());
              console.log(
                "got reaction users",
                users.map((u) => u.id)
              );
              for (const user of users) {
                await reaction.users.remove(user.id);
              }
            }
          } catch (error) {
            console.error("Failed to remove reactions.", error.stack);
          }
        }
      } else if (
        user.id !== client.user.id &&
        emoji.identifier === "%E2%97%80%EF%B8%8F"
      ) {
        // left arrow ◀️
        if (
          (inventoryIndex = exports.inventories.findIndex(
            (i) => i.id === message.id
          )) !== -1
        ) {
          const inventory = exports.inventories[inventoryIndex];
          if (inventory.requester.id === user.id) {
            inventory.left();
          }
        }
      } else if (
        user.id !== client.user.id &&
        emoji.identifier === "%E2%96%B6%EF%B8%8F"
      ) {
        // right arrow ▶️
        if (
          (inventoryIndex = exports.inventories.findIndex(
            (i) => i.id === message.id
          )) !== -1
        ) {
          const inventory = exports.inventories[inventoryIndex];
          if (inventory.requester.id === user.id) {
            inventory.right();
          }
        }
      }
    });
  });

  client.login(discordApiToken);
};
