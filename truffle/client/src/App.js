import "./App.css";import React, { Component } from "react";
import AuctionManagerContract from "./contracts/AuctionManager.json";
import AuctionContract from "./contracts/Auction.json";
import getWeb3 from "./getWeb3";
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
momentDurationFormatSetup(moment);


// single entry of auction lists
class AuctionComponent extends React.Component {
  formatedLeftTime = (endDate) => {
    var now  = new Date();
    var LeftMs = moment(endDate, "DD/MM/YYYY HH:mm:ss").diff(moment(now, "DD/MM/YYYY HH:mm:ss"));
    var dur = moment.duration(LeftMs);
    if (LeftMs < 0){ //Check if auction isn't running
      return null;
    }
    else if(LeftMs < 60*60*1000){ //Check if left time is under 1 hour
      return dur.format("m[m] s[s]");
    }
    else if (LeftMs < 24*60*60*1000){ //Check if left time is under 1 day
      return dur.format("h[h] m[m]");
    }
    else{
      return dur.format("d[d] h[h]");
    } 
  }

  render() {
    return (
      <div className="col">
      <div className="card" onClick={ () => this.props.handler(this.props.auction) }  style={{maxWidth: "300px"}}>
        {this.props.auction.ipfsHashes[0] != null && <img className="card-img-top" src={this.props.auction.ipfsHashes[0]} alt="Card image cap" /> }
        <div className="card-body">
          <h5 className="card-title">{this.props.auction.title || "No title"}</h5>
          <h3 className="card-text">Last bid: {this.props.web3.utils.fromWei(this.props.auction.highestBindingBid)} ETH</h3>
        </div>
        <div className="card-footer">
          {this.formatedLeftTime(this.props.auction.endDate) != null && <small className="text-muted">Left: {this.formatedLeftTime(this.props.auction.endDate)} </small> }
          {this.formatedLeftTime(this.props.auction.endDate) == null && <small className="text-muted">Auction isn't running </small> }
        </div>
      </div>
      </div>
    );
    /*return (
      <div>
        <button className="btn" onClick={ () => this.props.handler(this.props.auction) }>
          <div align="left">
            <p>{this.props.auction.title || "No title"}</p>
            <p>{this.props.auction.description}</p>
            <p>End: {this.props.auction.endDate.toString()}</p>
            <span>{this.props.auction.address}</span>
          </div>
        </button>
      </div>
    );*/
  }
}

// auction list with filtering
class AuctionList extends React.Component {
  render() {
    return (
      <div className="row row-cols-1 row-cols-md-5 g-4" style={{paddingTop: "25px"}}>
        { this.props.list.filter(this.props.filter).map((element, index) => (
          <AuctionComponent auction={element} web3={this.props.web3} handler={this.props.handler} key={index}></AuctionComponent>
        ))}
      </div>
    );
  }
}

class AuctionTitle extends React.Component {
  render() {
    return (
      <div className="container-fluid p-3 bg-primary text-white text-center">
        <h1>{this.props.title}</h1>
      </div>
    );
  }
}

class App extends Component {
  state = { loaded: false, sellersCount: "unknown", 
            auctionsCount: "unknown", currentAccount: "unknown", 
            AllAuctions: [], currentAuction: null,
            abid: "", createAuctionPage: false };

  constructor(props){
    super(props);
    const serverUrl = "https://mntv9lfhen4r.usemoralis.com:2053/server";
    const appId = "OLqNLYhM6D6LYLHlVyV9M3h9kH1kDm0KYt8vakfT";
    window.Moralis.start({ serverUrl, appId });
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      this.web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      this.accounts = await this.web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await this.web3.eth.net.getId();
      const deployedNetwork = AuctionManagerContract.networks[networkId];
      this.auctionManager = new this.web3.eth.Contract(
        AuctionManagerContract.abi,
        deployedNetwork && deployedNetwork.address
      );

      this.auction = new this.web3.eth.Contract(
        AuctionContract.abi,
        deployedNetwork && deployedNetwork.address
      );

      this.timerIds = [];
      this.listenToAuctionCreatedEvent();
      this.listenToAccountChangeEvent();
      this.listenToNetworkChangeEvent();
      this.updateData();
      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.setState({ loaded: true });
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  }

  listenToAuctionCreatedEvent = () => {
    let self = this;
    this.auctionManager.events.AuctionCreated().on("data", async function (evt) {
      console.log(evt);
      self.updateData();
    });
  }

  listenToAuctionUpdatedEvent = (contract) => {
    let self = this;
    contract.events.AuctionUpdated().on("data", async function (evt) {
      console.log(evt);
      self.updateData();
    });
  }

  listenToAccountChangeEvent = () => {
    let self = this;
    window.ethereum.on('accountsChanged', async function (accounts) {
      console.log("account change")
      self.accounts = await self.web3.eth.getAccounts();
      self.updateData();
    })
  }

  listenToNetworkChangeEvent = () => {
    let self = this;
    window.ethereum.on('chainChanged', async function (networks) {
      console.log("chain change")
      self.accounts = await self.web3.eth.getAccounts();
      self.updateData();
    })
  }

  updateData = async () => { 
    console.log("Update triggered");
    this.clearTimers();
    const responseSellersCount = await this.auctionManager.methods.sellersCount().call();
    const responseAuctionsCount = await this.auctionManager.methods.auctionsCount(this.accounts[0]).call();
    //const responseAuctionState = await this.auctionManager.methods.auctionState().call();
    await this.readAllAuctions();
    // Update state with the result.
    this.setState({ sellersCount: responseSellersCount, auctionsCount: responseAuctionsCount, currentAccount: this.accounts[0] });
  }

  handleNewAuctionPage = async () => {
    const account = this.accounts[0];
    let result = await this.auctionManager.methods.createAuction().send({from: account});
    console.log(result);
    //window.Moralis.authenticate()
    //this.setState( {createAuctionPage: true} )
  }

  /*handleNewAuction = async () => {
    const files = this.imageFiles.files;
    const title = this.state.title;
    const description = this.state.description;
    const endtime = new Date(this.state.endtime);
    var endtimeInSec = endtime.getTime() / 1000;
    /*let files = document.getElementById('imageFiles').files;
    let title = document.getElementById('title');
    let description = document.getElementById('description');
    let endtime = document.getElementById('endtime').valueAsNumber;
    *//*
    console.log("files: ", files);
    console.log("endtime: ", endtime);
    let readers = [];

    // Abort if there were no files selected
    if(!files.length) return;

    // Store promises in array
    for(let i = 0;i < files.length;i++){
      readers.push(await this.readFileAsText(files[i]));
    }
              
    // Trigger Promises
    Promise.all(readers).then((values) => {  
      console.log(values);
      this.createAuction(values.toString(), title, description, endtimeInSec);
    });
  }
  */
  readFileAsText = (file) => {
    return new Promise(function(resolve,reject){
      let fr = new FileReader();
      fr.readAsDataURL(file);

      fr.onload = async function(){
        //fr.result;
        let buf = fr.result;
        const file = new window.Moralis.File("imageName", {base64: buf})
        await file.saveIPFS();
        console.log(file.ipfs());
        resolve(file.ipfs());
      };
    }); 
  }

  clearTimers = () => {
    this.timerIds.forEach(function(timerId) {
      clearTimeout(timerId)
    });
    this.timerIds = [];
  }

  updateTimer = (endDate) => {
    let timeLimit = endDate.getTime() - (new Date()).getTime();
    if (timeLimit > 0) {
      this.timerIds.push(setTimeout( async () => {
        await this.updateData();
      }, timeLimit + 10000)); // add 10 sec due to timing issues
    }
  }

  readAllAuctions = async () => {
    var auctions = [];
    var currentAuction = null;

    const sellersCount = await this.auctionManager.methods.sellersCount().call();
    for (var sellerIndex = 0; sellerIndex < sellersCount; sellerIndex++) {
      const seller = await this.auctionManager.methods.sellers(sellerIndex).call();
      const auctionsForSeller = await this.auctionManager.methods.auctionsCount(seller).call();
      for (var auctionIndex = 0; auctionIndex < auctionsForSeller; auctionIndex++) {
        const auctionAddress = await this.auctionManager.methods.getAuctionAddress(seller, auctionIndex).call();
        let auctionContract = await this.getAuctionContact(auctionAddress);
        let auctionState = await auctionContract.methods.auctionState().call();

        let auctionTitle = await auctionContract.methods.auctionTitle().call();
        let auctionDescription = await auctionContract.methods.auctionDescription().call();
        let ipfsHashesString = await auctionContract.methods.ipfsHashes().call();
        console.log("ipfsHashesString: ", ipfsHashesString);
        let ipfsHashesArray = (ipfsHashesString === "") ? [] : ipfsHashesString.split(",");
        let auctionIsBidder = await auctionContract.methods.isBidder(this.accounts[0]).call();
        let auctionCanBid = await auctionContract.methods.canBid(this.accounts[0]).call();

        let auctionHighestBindingBid = await auctionContract.methods.highestBindingBid().call();
        let auctionHighestBidder = await auctionContract.methods.highestBidder().call();

        let endDateInUnixTimestamp = await auctionContract.methods.endDate().call();
        let endDate = new Date(endDateInUnixTimestamp * 1000);
        this.updateTimer(endDate);
        let date = (new Date()).getTime();
        let currentDate = date / 1000;
        currentDate -= currentDate % 1;
        let canFinalize = await auctionContract.methods.canFinalize(currentDate, this.accounts[0]).call();
        
        let newAuction = {address: auctionAddress, seller: seller, 
          state: auctionState, title: auctionTitle, ipfsHashes: ipfsHashesArray,
          isBidder: auctionIsBidder, canBid: auctionCanBid,
          description: auctionDescription, contract: auctionContract, 
          highestBindingBid: auctionHighestBindingBid, highestBidder: auctionHighestBidder,
          endDate: endDate, canFinalize: canFinalize };

        auctions.push(newAuction);
        if (this.state.currentAuction && this.state.currentAuction.address === auctionAddress) {
          currentAuction = newAuction;
        }
      }
    }
    this.setState( {AllAuctions: auctions, currentAuction: currentAuction} );
  }

  listAuctions = (callbackFn) => {
    const result = this.state.AllAuctions.map(callbackFn);
    return result;
  }

  getAuctionContact = async (address) => {
    const networkId = await this.web3.eth.net.getId();
    const deployedNetwork = AuctionManagerContract.networks[networkId];
    let auctionContract = new this.web3.eth.Contract(AuctionContract.abi, deployedNetwork && address);
    return auctionContract;
  }

  handleInputChange = (event) => {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value
    })
  }

  handleClickGotoAuction = (auction) => {
    console.log("going to auction: " + auction);
    console.log("ipfsArray: ", auction.ipfsHashes);
    console.log(auction.endDate.toLocaleDateString(), typeof(auction.endDate.toLocaleDateString()));
    let today = new Date();
    let tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    let aendtime = tomorrow.toLocaleDateString('en-CA') + "T" + ('0' +today.getHours()).slice(-2) + ":" + ('0' + today.getMinutes()).slice(-2);//Set defaul time for the input box
    let aminEndTime = today.toLocaleDateString('en-CA') + "T" + ('0' +today.getHours()).slice(-2) + ":" + ('0' + today.getMinutes()).slice(-2);//Set min time for the input box
    this.setState( {currentAuction: auction, atitle: auction.title, adesc: auction.description, endtime: aendtime, minEndTime: aminEndTime} )
  }

  handleUpdate = async () => {
    this.listenToAuctionUpdatedEvent(this.state.currentAuction.contract);
    let {atitle, adesc} = this.state;
    const endtime = new Date(this.state.endtime);
    const endtimeInSec = endtime.getTime() / 1000;
    console.log("endtimeInSec", endtimeInSec);
    const nowDatetime = new Date();
    if(endtime.getTime() < nowDatetime.getTime()){
      alert("End time of the auction couldn't be in the past");
      return;
    }
    const aendtime = (endtimeInSec == null) ? 0 : endtimeInSec;
    console.log("endtime", aendtime);
    const files = this.imageFiles.files;
    let ipfsHashesString = "";
    let readers = [];

    console.log("files.length", files.length);

    // Store promises in array
    for(let i = 0;i < files.length;i++){
      readers.push(await this.readFileAsText(files[i]));
    }
              
    // Trigger Promises
    await Promise.all(readers).then((values) => {  
      console.log(values);
      ipfsHashesString = values.toString();
    });
    

    console.log("ipfsHashesString: ", ipfsHashesString);
    let result = await this.state.currentAuction.contract.methods.updateAuction(atitle, adesc, ipfsHashesString, aendtime).send({ from: this.accounts[0] });
    console.log(result);

    this.listenToAuctionUpdatedEvent(this.state.currentAuction.contract);

    console.log( await this.state.currentAuction.contract.methods.auctionState().call() );



    /*if (atitle !== this.state.currentAuction.title && adesc !== this.state.currentAuction.description) {
      let result = await this.state.currentAuction.contract.methods.updateTitleAndDescription(atitle, adesc).send({ from: this.accounts[0] });
      console.log(result);
    }
    else if (atitle !== this.state.currentAuction.title) {
      let result = await this.state.currentAuction.contract.methods.setTitle(atitle).send({ from: this.accounts[0] });
      console.log(result);
    }
    else if (adesc !== this.state.currentAuction.description) {
      let result = await this.state.currentAuction.contract.methods.setDescription(adesc).send({ from: this.accounts[0] });
      console.log(result);
    }*/
  }

  handleCancel = async () => {
    this.listenToAuctionUpdatedEvent(this.state.currentAuction.contract);
    let result = await this.state.currentAuction.contract.methods.cancelAuction().send({ from: this.accounts[0] });
    console.log(result);
  }

  handleBid = async () => {
    this.listenToAuctionUpdatedEvent(this.state.currentAuction.contract);
    let valueInWei = this.web3.utils.toWei(this.state.abid, 'ether');
    let result = await this.state.currentAuction.contract.methods.placeBid().send({ from: this.accounts[0], value: valueInWei });
    console.log(result);
  }

  handleFinalize = async () => {
    this.listenToAuctionUpdatedEvent(this.state.currentAuction.contract);
    let result = await this.state.currentAuction.contract.methods.finalizeAuction().send({ from: this.accounts[0] });
    console.log(result);
  }

  render() {
    if (!this.state.loaded) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }/*else if (this.state.createAuctionPage === true){
      return (
        <div className="createAuction">
          <AuctionTitle title="Create auction" />
          <div className="form-group">
            <label>Title</label>
            <input type="text" className="form-control" id="title" name="title" onChange={this.handleInputChange} value={ this.state.title } placeholder="Enter title" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input type="text" className="form-control" id="description" name="description" onChange={this.handleInputChange} value={ this.state.description } placeholder="Describe the item" />
          </div>
          <div className="mb-3">
            <label className="form-label">Import images</label>
            <input className="form-control" type="file" id="imageFiles" name="imageFiles"  ref={(ref) => this.imageFiles = ref} multiple />
          </div>
          <label>Choose time when auction will finish</label>
          <input type="datetime-local" id="endtime" name="endtime" onChange={this.handleInputChange} value={ this.state.endtime } />

          <button id="buttonUpload" onClick={ () => this.handleNewAuction() } className="btn btn-primary">Submit</button>
        </div>
      )
    }else*/
    if (this.state.currentAuction == null) {
      return (
        <div className="MainApp">
          <AuctionTitle title="Auction" />
          <div>
            <h2>My auctions</h2>
            <AuctionList list={this.state.AllAuctions} filter={auction => auction.seller === this.accounts[0]} handler={this.handleClickGotoAuction} web3={this.web3} />
            <button className="btn btn-primary" type="button" onClick={ () => this.handleNewAuctionPage() }>Create new Auction</button>
            <br/><br/>
          </div>
          <div>
            <h2>Other auctions</h2>
            <AuctionList list={this.state.AllAuctions} filter={auction => (auction.seller !== this.accounts[0]) && (auction.state == 1 || auction.state == 2 )} handler={this.handleClickGotoAuction} web3={this.web3}/>
          </div>
          <div className="mb-3 mt-3">
            <div>Sellers count: {this.state.sellersCount}</div>
            <div>My auctions count: {this.state.auctionsCount}</div>
            <div>Current account: {this.state.currentAccount}</div>
          </div>
        </div>
      );
    } else if (this.state.currentAuction.seller === this.accounts[0]) {
      return (
        <div className="AuctionEdit">
          <AuctionTitle title="Edit Auction" />
          <div className="mb-3 mt-3">
            <label className="form-label">Title:</label>
            <input className="form-control" placeholder="Enter title" type="text" id="atitle" name="atitle" onChange={this.handleInputChange} value={ this.state.atitle } />
          </div>
          <div className="mb-3 mt-3">
            <label className="form-label">Description:</label>
            <textarea className="form-control" placeholder="Enter description" rows="5" name="adesc" id="adesc" onChange={this.handleInputChange} value={ this.state.adesc }></textarea><br/>
          </div>
          <div className="row">
          {this.state.currentAuction.ipfsHashes.map(imageHash => (
            <div className="col-md-4" key={imageHash} >
              <img style={{width: "100%", maxWidth: "300px"}} className="img-responsive" src={imageHash} alt={imageHash}/>
            </div> 
          ))}
          </div>
          <div className="mb-3">
            <label className="form-label">Images</label>
            <input className="form-control" type="file" id="imageFiles" name="imageFiles" ref={(ref) => this.imageFiles = ref} multiple />
          </div>
          <div className="mb-3">
            <p>End: {this.state.currentAuction.endDate.toString()}</p>
          </div>
          <label>Update end:</label>
          <input type="datetime-local" id="endtime" name="endtime" onChange={this.handleInputChange} value={ this.state.endtime } min={this.state.minEndTime} />
          <div className="mb-3">
            <p>Auction State: {this.state.currentAuction.state}</p>
          </div>
          { this.state.currentAuction.highestBindingBid > 0 &&
            <div className="mb-3">Highest bid: {this.web3.utils.fromWei(this.state.currentAuction.highestBindingBid)} ETH from {this.state.currentAuction.highestBidder}</div>
          }
          <button className="btn btn-primary" type="button" onClick={ () => this.handleUpdate() }>Update Auction</button>
          <div className="mb-3 mt-3">
            <button className="btn btn-danger" type="button" onClick={ () => this.handleCancel() }>Cancel Auction</button>&nbsp;
            { this.state.currentAuction.canFinalize &&
              <span>
                <button className="btn btn-warning" type="button" onClick={ () => this.handleFinalize() }>Finalize Auction</button>&nbsp;
              </span>
            }
            <button className="btn btn-info" type="button" onClick={ () => this.setState( {currentAuction: null} )}>Back</button>&nbsp;
            <div>Current account: {this.state.currentAccount}</div>
            <div>Contract address: {this.state.currentAuction.address}</div>
          </div>
        </div>
      );
    } else if (this.state.currentAuction.seller !== this.accounts[0]) {
      return (
        <div className="Auction">
          <AuctionTitle title="Auction" />
          <h2>{ this.state.currentAuction.title || "No title" }</h2>
          <div className="row" style={{paddingBottom: "50px"}}>
          {this.state.currentAuction.ipfsHashes.map(imageHash => (
            <div className="col-md-4" key={imageHash} >
              <img style={{width: "100%", maxWidth: "300px"}} className="img-responsive" src={imageHash} alt={imageHash}/>
            </div> 
          ))}
          </div>
          <div className="mb-3 mt-3">{ this.state.currentAuction.description }</div>
          
          <div className="mb-3 mt-3">End: { this.state.currentAuction.endDate.toString() }</div>
          { this.state.currentAuction.highestBindingBid > 0 &&
            <div>Highest bid: {this.web3.utils.fromWei(this.state.currentAuction.highestBindingBid)} ETH from {this.state.currentAuction.highestBidder}</div>
          }
          { this.state.currentAuction.canBid &&
            <div className="mb-3 mt-3">
              <label className="form-label">Bid (in ETH):</label>
              <input className="form-control" placeholder="Enter your bid in ETH" type="text" id="abid" name="abid" onChange={this.handleInputChange} value={ this.state.abid } />
              <button className="btn btn-primary" type="button" onClick={ () => this.handleBid() }>Place Bid</button><br/>
            </div>
          }
          <div className="mb-3 mt-3">
            { this.state.currentAuction.canFinalize &&
              <span>
                <button className="btn btn-warning" type="button" onClick={ () => this.handleFinalize() }>Finalize Auction</button>&nbsp;
              </span>
            }
            <button className="btn btn-info" type="button" onClick={ () => this.setState( {currentAuction: null} )}>Back</button>&nbsp;
            <div>Current account: {this.state.currentAccount}</div>
            <div>Contract address: {this.state.currentAuction.address}</div>
          </div>
        </div>
      );
    }
  }
}

export default App;
