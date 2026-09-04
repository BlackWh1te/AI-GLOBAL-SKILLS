const keytar = require('keytar');
keytar.setPassword('test-service', 'test-account', 'test-secret').then(() => {
  return keytar.getPassword('test-service', 'test-account');
}).then((pass) => {
  console.log('Secret:', pass);
}).catch(console.error);
