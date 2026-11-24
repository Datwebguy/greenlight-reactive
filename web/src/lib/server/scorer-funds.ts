import "server-only";
import { formatEther, parseAbi, type Address } from "viem";
import { lasna } from "../config";
import { clientFor } from "./logs";

const SYSTEM = "0x8888888888888888888888888888888888888888" as const;
const abi = parseAbi(["function debt(address) view returns (uint256)", "function reserves(address) view returns (uint256)"]);
/** Below this, the scorer has roughly a day of reactions left at the current pace. */
const LOW_REACT = Number(process.env.SCORER_LOW_REACT ?? "3");

/** The scorer's REACT on Reactive Network. A scorer in debt stops reacting, so this is worth watching. */
export async function scorerFunds() {
  if (!lasna.scorer) return null;
  const c = clientFor(lasna.chain.id);
  const rc = lasna.scorer as Address;
  const [debt, reserve, balance] = await Promise.all([
    c.readContract({ address: SYSTEM, abi, functionName: "debt", args: [rc] }),
    c.readContract({ address: SYSTEM, abi, functionName: "reserves", args: [rc] }),
    c.getBalance({ address: rc }),
  ]);
  const available = Number(formatEther(reserve + balance)) - Number(formatEther(debt));
  return {
    debt: Number(formatEther(debt)),
    reserve: Number(formatEther(reserve)),
    balance: Number(formatEther(balance)),
    status: debt > 0n ? "in debt: reactions paused" : available < LOW_REACT ? "low: top up soon" : "healthy",
  };
}
