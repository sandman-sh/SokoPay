import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deploymentPath = path.join(__dirname, "deployed.json");

let localDeployment = {};
try {
  localDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
} catch {
  localDeployment = {
    escrowAddress: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    tokens: {
      cUSD: { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3", symbol: "cUSD", decimals: 18 },
      cNGN: { address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", symbol: "cNGN", decimals: 18 },
      USAT: { address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", symbol: "USAT", decimals: 6 },
    },
  };
}

let mainnetDeployment = {};
try {
  mainnetDeployment = JSON.parse(fs.readFileSync(path.join(__dirname, "deployed-mainnet.json"), "utf-8"));
} catch {}

let sepoliaDeployment = {};
try {
  sepoliaDeployment = JSON.parse(fs.readFileSync(path.join(__dirname, "deployed-sepolia.json"), "utf-8"));
} catch {}

export const NETWORKS = {
  "celo-sepolia": {
    id: "celo-sepolia",
    name: "Celo Sepolia Testnet",
    chainId: 11142220,
    hexChainId: "0xaa044c",
    rpcUrl: process.env.CELO_SEPOLIA_RPC_URL || "https://forno.celo-sepolia.celo-testnet.org",
    explorerUrl: "https://celo-sepolia.blockscout.com",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    escrowAddress: process.env.ESCROW_ADDRESS_SEPOLIA || sepoliaDeployment.escrowAddress || localDeployment.escrowAddress || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    oracleAddress: process.env.ORACLE_ADDRESS_SEPOLIA || sepoliaDeployment.oracleAddress || null,
    tokens: {
      cUSD: {
        symbol: "cUSD",
        name: "Celo Dollar",
        address: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
        decimals: 18,
      },
      cEUR: {
        symbol: "cEUR",
        name: "Celo Euro",
        address: "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F",
        decimals: 18,
      },
      cREAL: {
        symbol: "cREAL",
        name: "Celo Real",
        address: "0xE4D517785D091D3c54818832dB606C3cA5241471",
        decimals: 18,
      },
      cNGN: {
        symbol: "cNGN",
        name: "cNGN Stablecoin",
        address: "0x4b786f1e8f237f3ff7a65977114389df95b364a2",
        decimals: 18,
      },
      USAT: {
        symbol: "USAT",
        name: "USA₮ (Self x Tether)",
        address: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",
        decimals: 6,
      },
      USDT: {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
        decimals: 18,
      },
      USDC: {
        symbol: "USDC",
        name: "Circle USD",
        address: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
        decimals: 18,
      },
    },
  },
  "celo-mainnet": {
    id: "celo-mainnet",
    name: "Celo Mainnet",
    chainId: 42220,
    hexChainId: "0xa4ec",
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    escrowAddress: process.env.ESCROW_ADDRESS_MAINNET || mainnetDeployment.escrowAddress || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    oracleAddress: process.env.ORACLE_ADDRESS_MAINNET || mainnetDeployment.oracleAddress || null,
    tokens: {
      cUSD: {
        symbol: "cUSD",
        name: "Celo Dollar",
        address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
        decimals: 18,
      },
      cEUR: {
        symbol: "cEUR",
        name: "Celo Euro",
        address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
        decimals: 18,
      },
      cREAL: {
        symbol: "cREAL",
        name: "Celo Real",
        address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
        decimals: 18,
      },
      cNGN: {
        symbol: "cNGN",
        name: "cNGN Stablecoin",
        address: "0x4b786f1e8f237f3ff7a65977114389df95b364a2",
        decimals: 18,
      },
      USAT: {
        symbol: "USAT",
        name: "USA₮ (Self x Tether)",
        address: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",
        decimals: 6,
      },
      USDT: {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
        decimals: 6,
      },
      USDC: {
        symbol: "USDC",
        name: "Circle USD",
        address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
        decimals: 6,
      },
    },
  },
  localhost: {
    id: "localhost",
    name: "Celo Local Node",
    chainId: 31337,
    hexChainId: "0x7a69",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "http://localhost:8545",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    escrowAddress: localDeployment.escrowAddress || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    tokens: localDeployment.tokens || {
      cUSD: { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3", symbol: "cUSD", decimals: 18 },
      cNGN: { address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", symbol: "cNGN", decimals: 18 },
      USAT: { address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", symbol: "USAT", decimals: 6 },
    },
  },
};

// Default to localhost, switchable at runtime or via ACTIVE_NETWORK env
let activeNetworkKey = process.env.ACTIVE_NETWORK || "localhost";

export function getActiveNetwork() {
  const net = NETWORKS[activeNetworkKey] || NETWORKS.localhost;
  return {
    ...net,
    blockExplorerUrls: [net.explorerUrl],
  };
}

export function setActiveNetwork(networkKey) {
  if (!NETWORKS[networkKey]) {
    throw new Error(`Unsupported network: ${networkKey}. Supported: ${Object.keys(NETWORKS).join(", ")}`);
  }
  activeNetworkKey = networkKey;
  return getActiveNetwork();
}

export function getExplorerTxUrl(txHash, networkKey = activeNetworkKey) {
  const net = NETWORKS[networkKey] || getActiveNetwork();
  if (net.id === "localhost") return `${net.rpcUrl}/tx/${txHash}`;
  return `${net.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address, networkKey = activeNetworkKey) {
  const net = NETWORKS[networkKey] || getActiveNetwork();
  if (net.id === "localhost") return `${net.rpcUrl}/address/${address}`;
  return `${net.explorerUrl}/address/${address}`;
}
