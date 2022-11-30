require("@nomiclabs/hardhat-etherscan")
require("@nomiclabs/hardhat-waffle")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL 
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        goerli: {
            url: GOERLI_RPC_URL,
            accounts: [PRIVATE_KEY],
            blockConfirmations: 6,
            chainId: 5,
        },
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
        }
    },
    gasReporter: {
        enabled: false,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
    },
    solidity: "0.8.7",
    namedAccounts: {
        deployer: {
            default: 0,
            1:0,    
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 500000,
    }
}
