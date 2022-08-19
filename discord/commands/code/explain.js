const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder().setName("explain").setDescription("explain"),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    data._openAiCodex(
      data.interaction,
      `\
/* Code */
var helloWorld = document.createElement('div');
helloWorld.innerHTML = 'Hello World';
document.body.appendChild(helloWorld);
/* Explanation:
- Prints "Hello World", by adding an HTML DOM node to the document
*/

/* Code */
while (document.body.firstChild) {
document.body.removeChild(document.body.firstChild);
}
/* Explanation:
- Clears the document
*/

/* Code */
const div = document.createElement('div');
div.classList.add('drop-zone');
div.addEventListener('drop', e => {
...
});
document.body.appendChild(div);
/* Explanation:
- Add a .drop-zone DOM node and listen for drop events
*/

/* Code */
num = 12
for i in range(1, 11):
print(num, 'x', i, '=', num*i)
/* Explanation:
- Outputs a multiplication table for the number 12
*/

/* Code */
FROM node:12-alpine
RUN apk add --no-cache python g++ make
WORKDIR /app
COPY . .
RUN yarn install --production
CMD ["node", "src/index.js"]
/* Explanation:
- Dockerfile based on node:12-alpine
- Installs a node app and starts it
*/

/* Code */
var importObject = {
imports: {
imported_func: function(arg) {
console.log(arg);
}
}
};

fetch('simple.wasm').then(response =>
response.arrayBuffer()
).then(bytes =>
WebAssembly.instantiate(bytes, importObject)
).then(result =>
result.instance.exports.exported_func()
);
/* Explanation:
- Load a WebAssembly binary (simple.wasm)
- Instantiate WebAssembly module with imports
- Call the exported function, exported_func()
*/

/* Code */
${s.replace(/^\s*\S+\s*/, "")}
/* Explanation:`,
      `*/

/* Code`
    );
  },
};
