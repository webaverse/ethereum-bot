const { SlashCommandBuilder } = require("@discordjs/builders");
const { hdkey } = require("ethereumjs-wallet");
const { https } = require("follow-redirects");
const path = require("path");
const { storageHost } = require("../../../constants");
const bip39 = require("bip39");
const mime = require("mime");

module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder()
    .setName("update")
    .setDescription("Update NFT content")
    .addIntegerOption((option) =>
      option.setName("id").setRequired(true).setDescription("ID")
    )
    .addStringOption((option) =>
      option.setName("url").setRequired(false).setDescription("URL")
    )
    .addAttachmentOption((option) =>
      option.setName("file").setRequired(false).setDescription("File")
    ),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    const tokenId = data.interaction.options.getInteger("id");
    const manualUrl = data.interaction.options.getString("url");
    const attachment = data.interaction.options.getAttachment("file");

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
    } else if (attachment && attachment !== undefined) {
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
      const oldHash = await data.contracts.NFT.methods.getHash(tokenId).call();

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
                const j = JSON.parse(s);
                const { hash } = j;

                const wallet = hdkey
                  .fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic))
                  .derivePath(`m/44'/60'/0'/0/0`)
                  .getWallet();

                let status, transactionHash;
                try {
                  {
                    const result = await data.runSidechainTransaction(mnemonic)(
                      "NFT",
                      "updateHash",
                      oldHash,
                      hash
                    );
                    status = result.status;
                    transactionHash = "0x0";
                  }
                  if (status) {
                    const extName = path.extname(file.name).slice(1);
                    const fileName = extName
                      ? file.name.slice(0, -(extName.length + 1))
                      : file.name;
                    await Promise.all([
                      data.runSidechainTransaction(mnemonic)(
                        "NFT",
                        "setMetadata",
                        hash,
                        "name",
                        fileName
                      ),
                      data.runSidechainTransaction(mnemonic)(
                        "NFT",
                        "setMetadata",
                        hash,
                        "ext",
                        extName
                      ),
                    ]);
                    status = true;
                    transactionHash = "0x0";
                  }
                } catch (err) {
                  console.warn(err.stack);
                  status = false;
                  transactionHash = err.message;
                }

                if (status) {
                  data.interaction.editReply({
                    content:
                      "<@!" +
                      data.interaction.user.id +
                      ">: updated " +
                      tokenId +
                      " to " +
                      hash,
                    ephemeral: this.isHidden,
                  });
                } else {
                  data.interaction.editReply({
                    content:
                      "<@!" +
                      data.interaction.user.id +
                      ">: update transaction failed: " +
                      transactionHash,
                    ephemeral: this.isHidden,
                  });
                }
              });
              res.on("error", (err) => {
                console.warn(err.stack);
                data.interaction.editReply({
                  content:
                    "<@!" +
                    data.interaction.user.id +
                    ">: update failed: " +
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
                ">: update failed: " +
                err.message,
              ephemeral: this.isHidden,
            });
          });
          file.pipe(req);
        })
      );
    } else {
      data.interaction.editReply({
        content: "<@!" + data.interaction.user.id + ">: no files to update",
        ephemeral: this.isHidden,
      });
    }
  },
};
