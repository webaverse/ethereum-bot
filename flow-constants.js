const fetch = require('node-fetch');

const loadPromise = (async () => {
  const res = await fetch('https://contracts.webaverse.com/flow/flow-constants.js');
  let s = await res.text();
  s = s.replace(/^export default /, '');
  const j = eval(s);
  return j;
})();

module.exports = {
	async load() {
	  return await loadPromise;
  },
};