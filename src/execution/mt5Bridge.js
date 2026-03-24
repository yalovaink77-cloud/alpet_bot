const { APP_CONFIG } = require('../../config/app');

async function placeOrder(order) {
  return {
    broker: 'MT5',
    brokerOrderId: `mt5-${Date.now()}`,
    status: APP_CONFIG.execution.liveTradingEnabled ? 'ROUTED' : 'PAPER'
  };
}

module.exports = {
  placeOrder
};