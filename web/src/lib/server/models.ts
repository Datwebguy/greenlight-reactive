import "server-only";
import { createHash, randomBytes } from "node:crypto";

const NEAR_BASE = process.env.NEAR_AI_BASE_URL ?? "https://cloud-api.near.ai/v1";
export const NEAR_MODEL = process.env.NEAR_AI_MODEL ?? "Qwen/Qwen3.8-27B";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

function nearHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json", ...extra };
  if (process.env.NEAR_AI_API_KEY) h.Authorization = `Bearer ${process.env.NEAR_AI_API_KEY}`;
  return h;
}

export interface Decision {
  action: "buy" | "sell" | "hold";
  order: string;
  confidence: number;
  reason: string;
}

export const decisionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "order", "confidence", "reason"],
  properties: {
    action: { type: "string", enum: ["buy", "sell", "hold"] },
    order: { type: "string" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
} as const;

export interface SignedDecision {
  decision: Decision;
  requestBytes: Buffer;
  responseBytes: Buffer;
  chatId: string;
  latencyMs: number;
}

/** Ask NEAR AI Cloud's confidential (TEE) model. Returns the exact request and response bytes it will sign. */
export async function askNear(system: string, user: string, timeoutMs = 150_000): Promise<SignedDecision> {
  const body = Buffer.from(
    JSON.stringify({
      model: NEAR_MODEL,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "decision", strict: true, schema: decisionSchema } },
    }),
  );
  const t0 = Date.now();
  const res = await fetch(`${NEAR_BASE}/chat/completions`, {
    method: "POST",
    body,
    headers: nearHeaders({ "Content-Type": "application/json", "Accept-Encoding": "identity", "x-no-aliasing": "true" }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`NEAR AI Cloud answered ${res.status}: ${raw.toString().slice(0, 200)}`);
  const json = JSON.parse(raw.toString());
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("NEAR AI Cloud returned no answer");
  return {
    decision: parseDecision(content),
    requestBytes: body,
    responseBytes: raw,
    chatId: json.id,
    latencyMs: Date.now() - t0,
  };
}

export interface NearSignature {
  text: string;
  signature: `0x${string}`;
  signingAddress: `0x${string}`;
  kind: string;
}

/** The enclave's signature over sha256(request) and sha256(response). Available a moment after the answer. */
export async function nearSignature(chatId: string): Promise<NearSignature> {
  const url = `${NEAR_BASE}/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(NEAR_MODEL)}&signing_algo=ecdsa`;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url, { headers: nearHeaders(), signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      const s = await res.json();
      if (s.signature) {
        const sig = String(s.signature);
        return {
          text: s.text,
          signature: (sig.startsWith("0x") ? sig : `0x${sig}`) as `0x${string}`,
          signingAddress: s.signing_address,
          kind: s.signature_kind,
        };
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("NEAR AI Cloud did not return a signature");
}

/** Signing addresses the model's attestation report vouches for, fetched with a fresh nonce. */
export async function nearSigners(): Promise<string[]> {
  const nonce = randomBytes(32).toString("hex");
  const url = `${NEAR_BASE}/attestation/report?model=${encodeURIComponent(NEAR_MODEL)}&signing_algo=ecdsa&nonce=${nonce}`;
  const res = await fetch(url, { headers: nearHeaders(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Attestation report unavailable (${res.status})`);
  const rep = await res.json();
  const list: { signing_address?: string }[] = rep.model_attestations ?? (rep.signing_address ? [rep] : []);
  return [...new Set(list.map((a) => a.signing_address?.toLowerCase()).filter(Boolean) as string[])];
}

/** Fallback when the confidential model is unavailable. Its decisions are never signed, so they always wait for
 * the owner's approval. */
export async function askOpenAI(system: string, user: string): Promise<{ decision: Decision; latencyMs: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OPENAI_API_KEY) headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "decision", strict: true, schema: decisionSchema } },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI answered ${res.status}`);
  return { decision: parseDecision(json.choices[0].message.content), latencyMs: Date.now() - t0 };
}

function parseDecision(content: string): Decision {
  const d = JSON.parse(content);
  const action = ["buy", "sell", "hold"].includes(d.action) ? d.action : "hold";
  return {
    action,
    order: typeof d.order === "string" ? d.order : "",
    confidence: typeof d.confidence === "number" ? d.confidence : 0,
    reason: typeof d.reason === "string" ? d.reason.slice(0, 600) : "",
  };
}

export const sha256Hex = (b: Buffer) => `0x${createHash("sha256").update(b).digest("hex")}` as `0x${string}`;
