const { APP_CONFIG } = require('../../config/app');

async function placeOrder(order) {
  return {
    broker: 'BIST',
    brokerOrderId: `bist-${Date.now()}`,
    status: APP_CONFIG.execution.liveTradingEnabled ? 'ROUTED' : 'PAPER'
  };
}

module.exports = {
  placeOrder
};