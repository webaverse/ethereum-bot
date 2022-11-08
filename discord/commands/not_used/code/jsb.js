const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder().setName("jsb").setDescription("jsb"),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    data._openAiCodex(
      data.interaction,
      `\
/* Command: Add "Hello World", by adding an HTML DOM node */
var helloWorld = document.createElement('div');
helloWorld.innerHTML = 'Hello World';
document.body.appendChild(helloWorld);
/* Command: Clear the page. */
while (document.body.firstChild) {
document.body.removeChild(document.body.firstChild);
}

/* Command: ${s.replace(/^\s*\S+\s*/, "")} */`,
      `/* Command:`,
      true
    );
  },
};
