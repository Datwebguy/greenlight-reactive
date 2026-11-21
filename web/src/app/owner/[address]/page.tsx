import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { OwnerDashboard } from "@/components/owner-dashboard";

export default async function OwnerPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  return <OwnerDashboard owner={getAddress(address)} />;
}
