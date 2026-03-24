const mt5Bridge = require('./mt5Bridge');
const viopBridge = require('./viopBridge');
const bistBrokerBridge = require('./bistBrokerBridge');

function selectBridge(instrument) {
  if (['USDTRY', 'XAUUSD', 'BRENT'].includes(instrument)) {
    return mt5Bridge;
  }

  if (['VIOP30'].includes(instrument)) {
    return viopBridge;
  }

  return bistBrokerBridge;
}

async function placeSignalOrder(signal) {
  const bridge = selectBridge(signal.instrument);
  return bridge.placeOrder(signal);
}

module.exports = {
  placeSignalOrder
};