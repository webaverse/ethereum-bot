const { default: Common } = require('@ethereumjs/common');

exports.jsonParse = (s, d = null) => {
  try {
    return JSON.parse(s);
  } catch (err) {
    return d;
  }
}

exports.readStorageHashAsBuffer = async hash => {
  const req = await fetch(`${storageHost}/${hash}`);
  if (!req.ok) return null;

  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer;
};

exports.makePromise = () => {
  let accept, reject;
  const p = new Promise((a, r) => {
    accept = a;
    reject = r;
  });
  p.accept = accept;
  p.reject = reject;
  return p;
};
