import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const SOMNIA_RPC_URL = process.env.SOMNIA_RPC_URL || "https://rpc.somnia.network";
const SOMNIA_PRIVATE_KEY = process.env.SOMNIA_PRIVATE_KEY ? [process.env.SOMNIA_PRIVATE_KEY] : [];
const SOMNIASCAN_API_KEY = process.env.SOMNIASCAN_API_KEY || "empty";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Recommended for 0.8.24 to enable advanced Yul gas optimization
      metadata: {
        bytecodeHash: "none", // Gas optimization: removes bytecode hash to save deploy/runtime gas
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    somnia: {
      url: SOMNIA_RPC_URL,
      accounts: SOMNIA_PRIVATE_KEY,
      chainId: 50312, // Somnia Chain L1 ID
      gasPrice: "auto",
    },
  },
  etherscan: {
    apiKey: {
      somnia: SOMNIASCAN_API_KEY,
    },
    customChains: [
      {
        network: "somnia",
        chainId: 50312,
        urls: {
          apiURL: "https://explorer-api.somnia.network/api", // Somnia block explorer API
          browserURL: "https://explorer.somnia.network",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;
