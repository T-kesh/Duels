const { ethers } = require("ethers");

const abi = [
  {
    "inputs": [
      { "internalType": "address", "name": "_cusd", "type": "address" },
      { "internalType": "address", "name": "_treasury", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  }
];

const iface = new ethers.Interface(abi);
const encoded = iface.encodeDeploy(["0x765DE816845861e75A25fCA122bb6898B8B1282a", "0xaEea89C8ac328CAD629f4F7F4F93a3C2cEB0F148"]);
console.log(encoded.slice(2)); // Remove 0x
