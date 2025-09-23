/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

let mod;

if (process.env.NO_SERVER === 'true') {
  require('ts-node/register');
  mod = require('./index.ts');
} else {
  try {
    mod = require('./dist/index.js');
  } catch (distError) {
    require('ts-node/register');
    mod = require('./index.ts');
  }
}

if (require.main === module && process.env.NO_SERVER !== 'true') {
  const serverModule = mod.default ?? mod;

  if (typeof mod.startServer === 'function') {
    mod.startServer();
  } else if (serverModule && typeof serverModule.listen === 'function') {
    const PORT = Number(process.env.PORT) || 3001;
    serverModule.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  }
}

const exported = mod.default ?? mod;

if (exported && typeof exported === 'function' && mod && typeof mod === 'object') {
  Object.assign(exported, mod);
} else if (exported && typeof exported === 'object' && mod && typeof mod === 'object') {
  exported.default = exported.default ?? mod.default;
  Object.assign(exported, mod);
}

module.exports = exported;
