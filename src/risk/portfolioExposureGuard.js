function evaluatePortfolioCrowding(openPositions = [], signal) {
  const matchingPositions = openPositions.filter((position) => position.instrument === signal.instrument);
  return {
    allowed: matchingPositions.length === 0,
    count: matchingPositions.length
  };
}

module.exports = {
  evaluatePortfolioCrowding
};