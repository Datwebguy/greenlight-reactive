import { redirect } from "next/navigation";

/** "Live" is the hosted agent's own page. Every other agent belongs to its owner and is reached from their account. */
export default function LivePage() {
  const owner = process.env.NEXT_PUBLIC_DEMO_OWNER;
  redirect(owner ? `/owner/${owner}` : "/app");
}
