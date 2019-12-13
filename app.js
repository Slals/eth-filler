const lightwallet = require('eth-lightwallet');
const request = require('request');
const argv = require('yargs').argv;
const fs = require('fs');

const password = '';

// Number of addresses per request
const poolSize = argv.poolsize || 5;

// Start by address index = offset
const offset = argv.offset || 0;

// Number of addresses to generate
const total_addresses = argv.total_addresses || 100;

lightwallet.keystore.createVault({
  seedPhrase: 'owner tobacco diet panda melody change mean melt donkey tone pyramid brass', // Optionally provide a 12-word seed phrase
  password,
  hdPathString: `m/44'/60'/0'/0`,
}, function (err, ks) {
  ks.keyFromPassword('', function (err, pwDerivedKey) {
    if (err) throw err;

    ks.generateNewAddress(pwDerivedKey, total_addresses);
    var addr = ks.getAddresses();

    const failedAddresses = new Array();

    let i = offset;
    const reqFaucetFn = function() {
      let retryLength = failedAddresses.length;

      for(let a of failedAddresses) {
        console.log(`\nRetry request for ${a.address}...`);
        requestFaucet(a.index, a.address, failedAddresses);
      }
      for(let j = i; j < (i + poolSize - retryLength); j++) {
        console.log(`\nRequest for ${addr[j]}...`);
        requestFaucet(j, addr[j], failedAddresses);
      }

      i += poolSize;
    }

    reqFaucetFn();

    setInterval(reqFaucetFn, 1000);
  });
});

function requestFaucet(index, address, failedAddresses) {
  request(`https://faucet.ropsten.be/donate/${address}`, function(error, res, body) {
    let data = JSON.parse(body);
    if (res.statusCode === 200) {
      console.log(`${data.amount} Wei has been sent to ${address}`);
    } else if (res.statusCode === 403) {
      let duration = Math.round(data.duration);
      let d = new Date(duration);
      console.log(`${index} - ${address} | Failed because of 403 : ${data.message} for ${d.getUTCMinutes()}min${d.getUTCSeconds()}s`);
      saveFail(index, address, failedAddresses);
    } else if (err) {
      console.error(`${index} - ${address} | Failed to request faucet : `, err);
      saveFail(index, address, failedAddresses);
    } else {
      console.log(`Unknow status code ${res.statusCode}`);
    }
  });
}

function saveFail(index, addr, failedAddresses) {
  failedAddresses.push({index, address: addr});

  let f = '';
  for (let fa of failedAddresses) {
    f += `${fa.index};${fa.address}\n`;
  }

  // to keep track
  fs.writeFile('failed_addresses', f, 'ascii', function() {});
}
