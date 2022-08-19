const { SlashCommandBuilder } = require("@discordjs/builders");
const bip39 = require("bip39");


module.exports = {
  isHidden: false,
  data: new SlashCommandBuilder().setName("glsl").setDescription("glsl"),
  async execute(data) {
    if (!data.interaction.isChatInputCommand()) return;

    data._openAiCodex(
      data.interaction,
      `\
<|endoftext|>/* I start with a blank HTML page, and incrementally modify it via <script> injection. Written for Chrome. */

/***
JavaScript
***/

/* Command: Add "Hello World", by adding an HTML DOM node */
var helloWorld = document.createElement('div');
helloWorld.innerHTML = 'Hello World';
document.body.appendChild(helloWorld);
/* EOF */

/* Command: Clear the page. */
while (document.body.firstChild) {
document.body.removeChild(document.body.firstChild);
}
/* EOF */

/***
GLSL (Shader Toy API)
***/

/* Command: Solid red color. */
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
fragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
/* EOF */

/* Command: A bunch of white circles. */
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
vec2 uv = (fragCoord-iResolution.xy*.5)/iResolution.y;
uv = (uv-.5)*5.;

vec2 coords = fract(uv);
vec2 id = floor(uv);

float m = 0.;

vec2 point = coords;
vec2 centre = vec2(0.5, 0.5);
float radius = .45;
float width = .01;
float a = -abs(length(point-centre)-radius)+width;
float blur = (width*1000./iResolution.y);
float b = smoothstep(0.-blur,0.+blur,a);
m += b;

vec3 col = vec3(m);

fragColor = vec4(col,1);
}
/* EOF */

/* Command: ${s.replace(/^\s*\S+\s*/, "")} */`,
      `/* EOF`
    );
  },
};
