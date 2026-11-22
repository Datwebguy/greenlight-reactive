/** The exact text an owner signs to ask their agent for a decision now. Signing costs nothing and moves no funds. */
export function decideMessage(owner: string, time: number) {
  return `Greenlight: ask my agent to decide now\nOwner: ${owner.toLowerCase()}\nTime: ${time}`;
}
