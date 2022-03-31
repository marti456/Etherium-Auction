//SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.9.0;

import "./Auction.sol";

// this contract will deploy the Auction contract
contract AuctionManager {
    // declaring a dynamic array with addresses of deployed contracts
    //Auction[] public auctions;

    mapping (address => Auction[]) public auctions;
    mapping (address => uint) public auctionsCount;
    address[] public sellers;
    uint256 public sellersCount = 0;
    
    event AuctionCreated(address _address);

    // declaring the function that will deploy contract Auction
    function createAuction() public {
        
        // passing msg.sender to the constructor of Auction 
        Auction newAuction = new Auction(payable(msg.sender)); 
        // adding the address of the instance to the dynamic array
        auctions[msg.sender].push(newAuction); 

        if (auctionsCount[msg.sender] > 0){
            auctionsCount[msg.sender] +=1;
        }
        else {
            auctionsCount[msg.sender] = 1;
        }
        bool newSeller = true;
        for (uint i = 0; i < sellersCount; i++) {
            if(sellers[i] == msg.sender) {
                newSeller = false;
                break;
            }
        }
        if (newSeller) {
            sellers.push(msg.sender);
            sellersCount += 1;
        }

        emit AuctionCreated(address(newAuction));
    }

    function getAuctionAddress(address seller, uint256 index) public view returns(address) {
        return address(auctions[seller][index]);
    }
}
