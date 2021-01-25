const {
    accessKeyId,
    secretAccessKey,
    tradeMnemonic,
    treasuryMnemonic,
    discordApiToken
} = require('./config.json');

exports.devMode = accessKeyId === undefined ||
    secretAccessKey === undefined ||
    // tradeMnemonic === undefined ||
    // treasuryMnemonic === undefined ||
    accessKeyId === null ||
    secretAccessKey === null ||
    // tradeMnemonic === null ||
    // treasuryMnemonic === null ||
    accessKeyId === "" ||
    secretAccessKey === "" ||
    discordApiToken === "";
    // tradeMnemonic === "" ||
    // treasuryMnemonic === "";
