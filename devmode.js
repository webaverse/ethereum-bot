const { accessKeyId, secretAccessKey, discordApiToken, tradeMnemonic, treasuryMnemonic } = require('./config.json');

// TODO: Make this a nice array and loop check
const devMode = (accessKeyId === undefined ||
    secretAccessKey === undefined ||
    discordApiToken === undefined ||
    tradeMnemonic === undefined ||
    treasuryMnemonic === undefined ||
    accessKeyId === null ||
    secretAccessKey === null ||
    discordApiToken === null ||
    tradeMnemonic === null ||
    treasuryMnemonic === null ||
    accessKeyId === "" ||
    secretAccessKey === "" ||
    discordApiToken === "" ||
    tradeMnemonic === "" ||
    treasuryMnemonic === ""
    );

exports.devMode = devMode