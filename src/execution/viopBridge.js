const { APP_CONFIG } = require('../../config/app');

async function placeOrder(order) {
  return {
    broker: 'VIOP',
    brokerOrderId: `viop-${Date.now()}`,
    status: APP_CONFIG.execution.liveTradingEnabled ? 'ROUTED' : 'PAPER'
  };
}

module.exports = {
  placeOrder
};