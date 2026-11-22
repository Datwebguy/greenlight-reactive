/** The text a visitor signs to receive test ETH. Signing is free and moves nothing. */
export function dripMessage(wallet: string, time: number) {
  return `Greenlight: send me test ETH to try Greenlight\nWallet: ${wallet.toLowerCase()}\nTime: ${time}`;
}

/** What each new wallet receives per chain: enough to open an account and keep it updated. */
export const DRIP_ETH = "0.004";
