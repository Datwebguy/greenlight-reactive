/** A short, friendly name for an agent, derived from its owner's address so it is the same everywhere. */
const first = ["Amber", "Atlas", "Birch", "Cedar", "Cobalt", "Coral", "Echo", "Ember", "Fern", "Flint", "Harbor", "Indigo", "Juniper", "Lumen", "Maple", "Nova", "Onyx", "Orbit", "Pine", "Quartz", "Raven", "Sage", "Sol", "Summit", "Tide", "Vale", "Willow", "Zephyr"];
const second = ["Falcon", "Fox", "Heron", "Lynx", "Otter", "Owl", "Wren", "Hare", "Kestrel", "Marten", "Swift", "Badger", "Crane", "Finch", "Ibis", "Robin"];

export function agentName(address: string): string {
  const h = BigInt(address.toLowerCase().startsWith("0x") ? address : `0x${address}`);
  return `${first[Number(h % BigInt(first.length))]} ${second[Number((h / 97n) % BigInt(second.length))]}`;
}
