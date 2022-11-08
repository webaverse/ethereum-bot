const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder().setName("sh").setDescription("sh"),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    data._openAiCodex(
      data.interaction,
      `\
# Command: echo all lines in file "file.txt"
cat file.txt | while read line; do
echo $line
done

# Command: for loop over the glob /etc/rc.*
for i in /etc/rc.*; do
echo $i
done

# Command: declare and call a function myfunc() which uses a local variable to return the string 'some value'
myfunc() {
local myresult='some value'
echo $myresult
}
result="$(myfunc)"

# Command: ${s.replace(/^\s*\S+\s*/, "")}`,
      `# Command:`
    );
  },
};
