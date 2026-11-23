import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  bitgetWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  safepalWallet,
  tokenPocketWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";

export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "doommarket-placeholder-project-id";

const connectors = connectorsForWallets(
  [
    { groupName: "Popular on BNB Chain", wallets: [metaMaskWallet, binanceWallet, trustWallet, okxWallet] },
    {
      groupName: "More wallets",
      wallets: [bitgetWallet, safepalWallet, tokenPocketWallet, rabbyWallet, coinbaseWallet, walletConnectWallet, injectedWallet],
    },
  ],
  { appName: "Doom Market", projectId: WC_PROJECT_ID },
);

const defaultTestnet = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID === "97";

export const wagmiConfig = createConfig({
  connectors,
  chains: defaultTestnet ? [bscTestnet, bsc] : [bsc, bscTestnet],
  transports: { [bsc.id]: http(), [bscTestnet.id]: http() },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
