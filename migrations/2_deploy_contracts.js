var AuctionManager = artifacts.require("./AuctionManager.sol");

module.exports = function(deployer) {
  deployer.deploy(AuctionManager);
};
