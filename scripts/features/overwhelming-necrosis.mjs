import { MODULE_ID } from "../constants.mjs";
import { isWizardSpellOrFeature, resolveOriginatingMessage } from "../util.mjs";

const FEATURE_ID = "grave-power";

export function registerOverwhelmingNecrosis() {
  Hooks.on("dnd5e.preCalculateDamage", onPreCalculateDamage);
}

function onPreCalculateDamage(_targetActor, damages, options) {
  try {
    if (!Array.isArray(damages) || damages.length === 0) return;
    if (!damages.some(d => d?.type === "necrotic")) return;

    const message = resolveOriginatingMessage(options?.originatingMessage);
    if (!message) return;

    const sourceItem = typeof message.getAssociatedItem === "function"
      ? message.getAssociatedItem()
      : null;
    if (!sourceItem) return;

    // Damage Roll messages don't carry actor in `message.actor`; derive from
    // the embedded source item (which knows its parent actor) and fall back
    // to the speaker's actor id.
    const sourceActor = sourceItem.actor
      ?? message.actor
      ?? (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null);
    if (!sourceActor) return;

    const hasFeature = sourceActor.items.some(
      i => i.getFlag(MODULE_ID, "feature") === FEATURE_ID
    );
    if (!hasFeature) return;

    if (!isWizardSpellOrFeature(sourceItem)) return;

    options.ignore ??= {};
    if (options.ignore.resistance === true) return;

    let resistanceIgnore = options.ignore.resistance;
    if (!(resistanceIgnore instanceof Set)) {
      resistanceIgnore = new Set(
        Array.isArray(resistanceIgnore) ? resistanceIgnore
          : (resistanceIgnore ? [resistanceIgnore] : [])
      );
      options.ignore.resistance = resistanceIgnore;
    }
    resistanceIgnore.add("necrotic");
  } catch (err) {
    console.error(`${MODULE_ID} | Overwhelming Necrosis hook failed`, err);
  }
}
