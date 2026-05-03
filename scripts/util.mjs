/**
 * Pick the single client that should run a side-effect for a given actor,
 * to avoid duplicate writes when multiple clients have the actor loaded.
 * Prefers the actor's primary online player owner; falls back to active GM.
 */
export function getPrimaryHandlerId(actor) {
  const playerOwners = game.users.filter(
    u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER")
  );
  if (playerOwners.length > 0) {
    return [...playerOwners].sort((a, b) => a.id.localeCompare(b.id))[0].id;
  }
  const activeGMs = game.users.filter(u => u.isGM && u.active);
  return activeGMs.length > 0
    ? [...activeGMs].sort((a, b) => a.id.localeCompare(b.id))[0].id
    : null;
}

/**
 * Resolve a chat message from the various forms it may take in dnd5e damage
 * application options (instance, id, or undefined).
 */
export function resolveOriginatingMessage(originatingMessage) {
  if (!originatingMessage) return null;
  if (originatingMessage instanceof ChatMessage) return originatingMessage;
  if (typeof originatingMessage === "string") return game.messages.get(originatingMessage) ?? null;
  return null;
}

/**
 * True when the item is attributable to the Wizard class — either a spell
 * learned as a Wizard, or a feat whose requirements reference Wizard.
 */
export function isWizardSpellOrFeature(item) {
  if (!item) return false;
  if (item.type === "spell") {
    if (item.system?.sourceItem === "class:wizard") return true;
    if (item.system?.sourceClass === "wizard") return true; // pre-5.3 fallback
    return false;
  }
  if (item.type === "feat") {
    const reqs = String(item.system?.requirements ?? "").toLowerCase();
    return reqs.includes("wizard");
  }
  return false;
}
