//SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.9.0;

contract Auction{
    address payable public owner;
    uint256 public startDate;
    uint256 public endDate;
    string public ipfsHashes;

    string public auctionTitle;
    string public auctionDescription;
    
    enum State {Started, Running, Ended, Canceled}
    State public auctionState;
    
    uint public highestBindingBid;
    
    address payable public highestBidder;
    mapping(address => uint) public bids;
    uint bidIncrement;
    
    //the owner can finalize the auction and get the highestBindingBid only once
    bool public ownerFinalized = false;
    
    event AuctionUpdated(address _address);

    constructor(address payable eoa) {
        owner = eoa;
        auctionState = State.Started;

        //setIpfsHashes(_imagesHashes);
        //setTitle(_title);
        //setDescription(_description);(_description);

        startDate = block.timestamp;
        endDate = 0;
        bidIncrement = 500000000000000;
    }
    
    // declaring function modifiers
    modifier notOwner() {
        require(msg.sender != owner);
        _;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }
    
    modifier auctionIsRunning() {
        require(auctionState == State.Running);
        _;
    }
    
    //a helper pure function (it neither reads, nor it writes to the blockchain)
    function min(uint a, uint b) pure internal returns(uint) {
        if (a <= b){
            return a;
        } else {
            return b;
        }
    }
    
    function setIpfsHashes(string memory _imagesHashes) private {
        ipfsHashes = _imagesHashes;
    }

    function setTitle(string memory _title) private {
        auctionTitle = _title;
        emit AuctionUpdated(address(this));
    }

    function setDescription(string memory _description) private {
        auctionDescription = _description;
        emit AuctionUpdated(address(this));
    }

    function updateAuction(string memory _title, string memory _description, string memory _ipfsHashes, uint256 _endDate) public onlyOwner {
        if( keccak256(bytes(auctionTitle)) != keccak256(bytes(_title)) ){
            setTitle(_title);
        }
        if( keccak256(bytes(auctionDescription)) != keccak256(bytes(_description)) ){
            setDescription(_description);
        }
        if( keccak256(bytes(ipfsHashes)) != keccak256(bytes(_ipfsHashes)) ){
           ipfsHashes = _ipfsHashes;
        }
        if( endDate != _endDate ){
            endDate = _endDate;
        }
        if( auctionState == State.Started && keccak256(bytes(auctionTitle)) != keccak256(bytes("")) && endDate != 0 ){
            auctionState = State.Running;
        }
        emit AuctionUpdated(address(this));
    }

    function isBidder(address _sender) public view returns (bool) {
        return bids[_sender] > 0;
    }

    function canBid(address _sender) public view returns (bool) {
        return (_sender != owner) && (auctionState == State.Running);
    }

    function canFinalize(uint _timestamp, address _sender) public view returns (bool) {
        return  (auctionState == State.Canceled || _timestamp > endDate) &&  
                ((_sender == owner && (ownerFinalized == false)) || bids[_sender] > 0);
    }

    // only the owner can cancel the Auction
    function cancelAuction() public onlyOwner {
        auctionState = State.Canceled;
        emit AuctionUpdated(address(this));
    }

    // the main function called to place a bid
    function placeBid() public auctionIsRunning notOwner payable returns(bool) {
        // Check if auction is running
        require(auctionState == State.Running);
        
        uint currentBid = bids[msg.sender] + msg.value;
        
        // the currentBid should be greater than the highestBindingBid. 
        require(currentBid > highestBindingBid);
        
        bids[msg.sender] = currentBid;
        
        if (currentBid <= bids[highestBidder]) { // highestBidder is unchanged
            highestBindingBid = min(currentBid + bidIncrement, bids[highestBidder]);
        } else { // highestBidder is another bidder
             highestBindingBid = min(currentBid, bids[highestBidder] + bidIncrement);
             highestBidder = payable(msg.sender);
        }
        emit AuctionUpdated(address(this));
        return true;
    } 
    
    function finalizeAuction() public {
        // the auction has been Canceled or Ended
        require(auctionState == State.Canceled || block.timestamp > endDate); 
        // only the owner or a bidder can cancel the auction
        require((msg.sender == owner && ownerFinalized == false) || bids[msg.sender] > 0);
        // the recipient will get the value
        address payable recipient;
        uint value;
       
        if (auctionState == State.Canceled) { // auction canceled, not ended
            recipient = payable(msg.sender);
            value = bids[msg.sender];
        } else { // auction ended, not canceled
            if (msg.sender == owner) {
                if (ownerFinalized == false) { //the owner finalizes the auction
                    recipient = owner;
                    value = highestBindingBid;
                    //the owner can finalize the auction and get the highestBindingBid only once
                    ownerFinalized = true; 
                } else {
                    // owner already finalized
                    return;
                }
            } else { // another user (not the owner) finalizes the auction
                if (msg.sender == highestBidder) {
                    recipient = highestBidder;
                    value = bids[highestBidder] - highestBindingBid;
                } else {//this isn't the owner or the highest bidder
                    recipient = payable(msg.sender);
                    value = bids[msg.sender];
                }
            }
        }
        // resetting the bids of the recipient to avoid multiple transfers to the same recipient
        bids[recipient] = 0;
        //sends value to the recipient
        recipient.transfer(value);
        emit AuctionUpdated(address(this));
    }
}
