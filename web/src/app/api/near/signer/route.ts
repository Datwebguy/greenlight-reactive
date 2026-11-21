import { NextResponse } from "next/server";
import { NEAR_MODEL, nearSigners } from "@/lib/server/models";

export const dynamic = "force-dynamic";

/** The signing address NEAR AI Cloud's attestation report currently vouches for. */
export async function GET() {
  try {
    const signers = await nearSigners();
    return NextResponse.json({ model: NEAR_MODEL, signers });
  } catch (e) {
    return NextResponse.json({ model: NEAR_MODEL, signers: [], error: (e as Error).message }, { status: 502 });
  }
}
