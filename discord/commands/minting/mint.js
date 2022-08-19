const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const { https, http } = require("follow-redirects");
const path = require("path");
const { storageHost } = require("../../../constants");
const bip39 = require('bip39');

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("mint")
    .setDescription("Mint NFTs from file drag n drop or from [url]")
    .addIntegerOption((option) =>
      option.setName("count").setRequired(true).setDescription("Count")
    )
    .addStringOption((option) =>
      option.setName("url").setRequired(false).setDescription("URL")
    )
    .addAttachmentOption((option) =>
      option.setName("file").setRequired(false).setDescription("File")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    let quantity = data.interaction.options.getInteger("count");
    const isUrl = data.interaction.options.getString("url")?.length > 0;
    const _url = data.interaction.options.getString("url");
    const attachment = data.interaction.options.getAttachment("file");

    let manualUrl;
    if (isNaN(quantity)) {
      quantity = 1;

      if (
        isUrl &&
        /^https?:\/\//.test(data.interaction.options.getString("url"))
      ) {
        manualUrl = _url;
      }
    } else {
      manualUrl = _url;
    }

    let { mnemonic } = await data._getUser();
    if (!mnemonic) {
      const spec = await data._genKey();
      mnemonic = spec.mnemonic;
    }

    const files = [];
    if (manualUrl) {
      const match = manualUrl.match(/^http(s)?:\/\//);
      if (match) {
        const proxyRes = await new Promise((accept, reject) => {
          const proxyReq = (match[1] ? https : http).request(
            manualUrl,
            (proxyRes) => {
              proxyRes.name = manualUrl.match(/\/([^\/]+?)(?:\?.*)?$/)[1];
              if (!/\/..+$/.test(proxyRes.name)) {
                const contentType = proxyRes.headers["content-type"];
                if (contentType) {
                  const ext = mime.getExtension(contentType) || "bin";
                  proxyRes.name += "." + ext;
                }
              }
              accept(proxyRes);
            }
          );
          proxyReq.once("error", reject);
          proxyReq.end();
        });
        files.push(proxyRes);
      }
    } else if (attachment) {
      const { name, url } = attachment;

      const proxyRes = await new Promise((accept, reject) => {
        const proxyReq = https.request(url, (proxyRes) => {
          proxyRes.name = name;
          accept(proxyRes);
        });
        proxyReq.once("error", reject);
        proxyReq.end();
      });
      files.push(proxyRes);
    }
    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          const req = https.request(
            storageHost,
            {
              method: "POST",
            },
            (res) => {
              const bs = [];
              res.on("data", (d) => {
                bs.push(d);
              });
              res.on("end", async () => {
                const b = Buffer.concat(bs);
                const s = b.toString("utf8");
                // console.log('got s', s);
                const j = JSON.parse(s);
                const { hash } = j;

                const wallet = hdkey
                  .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
                  .derivePath(`m/44'/60'/0'/0/0`)
                  .getWallet();
                const address = wallet.getAddressString();

                const fullAmount = {
                  t: "uint256",
                  v: new data.web3.utils.BN(1e9)
                    .mul(new data.web3.utils.BN(1e9))
                    .mul(new data.web3.utils.BN(1e9)),
                };
                const fullAmountD2 = {
                  t: "uint256",
                  v: fullAmount.v.div(new data.web3.utils.BN(2)),
                };

                let status, transactionHash, tokenIds;
                try {
                  let allowance = await data.contracts.FT.methods
                    .allowance(address, data.contracts["NFT"]._address)
                    .call();
                  allowance = new data.web3.utils.BN(allowance, 10);
                  if (allowance.lt(fullAmountD2.v)) {
                    const result = await data.runSidechainTransaction(mnemonic)(
                      "FT",
                      "approve",
                      data.contracts["NFT"]._address,
                      fullAmount.v
                    );
                    status = result.status;
                  } else {
                    status = true;
                  }
                  if (status) {
                    const description = "";
                    const extName = path.extname(file.name).slice(1);
                    const fileName = extName
                      ? file.name.slice(0, -(extName.length + 1))
                      : file.name;
                    console.log("minting", [
                      "NFT",
                      "mint",
                      address,
                      hash,
                      fileName,
                      extName,
                      description,
                      quantity,
                    ]);
                    const result = await data.runSidechainTransaction(mnemonic)(
                      "NFT",
                      "mint",
                      address,
                      hash,
                      fileName,
                      extName,
                      description,
                      quantity
                    );
                    status = result.status;
                    transactionHash = result.transactionHash;
                    const tokenId = new data.web3.utils.BN(
                      result.logs[0].topics[3].slice(2),
                      16
                    ).toNumber();
                    tokenIds = [tokenId, tokenId + quantity - 1];
                  }
                } catch (err) {
                  console.warn(err.stack);
                  status = false;
                  transactionHash = err.message;
                  tokenIds = [];
                }

                // console.log('minted 1', status);

                if (status) {
                  data.interaction.editReply({
                    content:
                      "<@!" +
                      data.interaction.user.id +
                      ">: minted " +
                      (tokenIds[0] === tokenIds[1]
                        ? "https://webaverse.com/assets/" + tokenIds[0]
                        : tokenIds
                            .map((n) => "https://webaverse.com/assets/" + n)
                            .join(" - ")) +
                      " (" +
                      hash +
                      ")",
                    ephemeral: this.isHidden,
                  });
                } else {
                  const balance = await data.contracts.FT.methods
                    .balanceOf(address)
                    .call();
                  if (balance < 10) {
                    data.interaction.editReply({
                      content:
                        "<@!" +
                        data.interaction.user.id +
                        ">: mint transaction failed: you do not have enough SILK. Ask the Webaverse team for some! https://discord.gg/webaverse",
                      ephemeral: this.isHidden,
                    });
                  } else {
                    data.interaction.editReply({
                      content:
                        "<@!" +
                        data.interaction.user.id +
                        ">: mint transaction failed: this item has already been minted.",
                      ephemeral: this.isHidden,
                    });
                  }
                }

                // console.log('minted 2', status);
              });
              res.on("error", (err) => {
                console.warn(err.stack);
                data.interaction.editReply({
                  content:
                    "<@!" +
                    data.interaction.user.id +
                    ">: mint failed: " +
                    err.message,
                  ephemeral: this.isHidden,
                });
              });
            }
          );
          req.on("error", (err) => {
            console.warn(err.stack);
            data.interaction.editReply({
              content:
                "<@!" +
                data.interaction.user.id +
                ">: mint failed: " +
                err.message,
              ephemeral: this.isHidden,
            });
          });
          file.pipe(req);
        })
      );
    } else {
      data.interaction.editReply({
        content: "<@!" + data.interaction.user.id + ">: no files to mint",
        ephemeral: this.isHidden,
      });
    }
  },
};
