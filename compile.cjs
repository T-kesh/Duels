const path = require("path");
const fs = require("fs");
const solc = require("solc");

const contractPath = path.resolve(__dirname, "src/contracts/DuelRewards.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "DuelRewards.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasError = false;
  output.errors.forEach((e) => {
    console.error(e.formattedMessage);
    if (e.severity === "error") hasError = true;
  });
  if (hasError) process.exit(1);
}

const contract = output.contracts["DuelRewards.sol"]["DuelRewards"];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

fs.writeFileSync(
  path.resolve(__dirname, "DuelRewards.json"),
  JSON.stringify({ abi, bytecode }, null, 2)
);

console.log("Compilation successful. Saved to DuelRewards.json");
