const _commandToValue = ([name, args, description]) =>
  ["." + name, args.join(" "), "-", description].join(" ");
exports._commandToDescription = ([name, args, description]) =>
  "```css\n" + ["." + name, args.join(" "), "-", description].join(" ") + "```";
const _commandsToValue = (commands) =>
  "```css\n" +
  commands.map((command) => _commandToValue(command)).join("\n") +
  "```";

const helpFields = [
  {
    name: "Info",
    shortname: "info",
    commands: [
      ["status", [], "show account details"],
      ["balance", ["[@user|0xaddr]?"], "show FT balance"],
      ["inventory", ["[@user|0xaddr]?", "[page]?"], "show NFTs"],
      ["address", ["[@user]?"], "print address"],
      ["key", ["[@user]?"], "private key (DM)"],
    ],
  },
  {
    name: "Tokens",
    shortname: "tokens",
    commands: [
      ["inspect", ["[id]"], "inspect token details"],
      [
        "send",
        ["[@user|0xaddr|treasury]", "[amount]"],
        "send [amount] of SILK to user/address",
      ],
      [
        "transfer",
        ["[@user|0xaddr|treasury]", "[id]", "[quantity]?"],
        "send NFT",
      ],
      ["preview", ["[id]"], "preview NFT [id]; .gif for gif"],
      ["wget", ["[id]"], "get NFT [id] in DM"],
      ["get", ["[id]", "[key]"], "get metadata for NFT"],
      ["set", ["[id]", "[key]", "[value]"], "set metadata for NFT"],
    ],
  },
  {
    name: "Account",
    shortname: "account",
    commands: [
      ["name", ["[newname]"], "set name to [name]"],
      ["monetizationpointer", ["[mp]"], "set monetization pointer"],
      ["avatar", ["[id]"], "set avatar"],
      ["loadout", ["[num]", "[id]"], "set loadout NFT [1-8] to [id]"],
      ["homespace", ["[id]"], "set NFT as home space"],
      ["redeem", [], "redeem NFT roles"],
    ],
  },
  {
    name: "Secure commands (DM the bot)",
    shortname: "secure",
    commands: [
      ["gets", [""], "encrypted get"],
    ],
  },
  {
    name: "Help",
    shortname: "help",
    commands: [
      [
        "help",
        ["[topic]"],
        "show help on a topic (info, tokens, account, minting, packing, trade, store, land, secure)",
      ],
    ],
  },
].map((o) => {
  o.value = _commandsToValue(o.commands);
  return o;
});

exports._findCommand = (commandName) => {
  let command = null;
  for (const helpField of helpFields) {
    for (const c of helpField.commands) {
      const [name, args, description] = c;
      if (name === commandName) {
        command = c;
        break;
      }
    }
    if (command !== null) {
      break;
    }
  }
  return command;
};

exports.embedColor = "#000000";

exports._getAllCommandNames = () => {
  const arr = [];

  for (const helpField of helpFields) {
    for (const c of helpField.commands) {
      const [name, args, description] = c;
      arr.push(name);
    }
  }

  return arr.filter((element) => {
    return element !== undefined;
  });
};
