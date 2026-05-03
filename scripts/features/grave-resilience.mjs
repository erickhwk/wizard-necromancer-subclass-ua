import { MODULE_ID } from "../constants.mjs";
import { getPrimaryHandlerId } from "../util.mjs";

const FEATURE_ID = "grave-power";
const ARCANE_RECOVERY_ID = "arcane-recovery";
const ARCANE_RECOVERY_NAME = "arcane recovery";

export function registerGraveResilience() {
  Hooks.on("dnd5e.postUseActivity", onActivityUsed);
}

function onActivityUsed(activity, _usageConfig, _results) {
  try {
    const actor = activity?.actor;
    if (!actor) return;

    const featureItem = actor.items.find(
      i => i.getFlag(MODULE_ID, "feature") === FEATURE_ID
    );
    if (!featureItem) return;

    const sourceItem = activity.item;
    const isArcaneRecovery = sourceItem?.system?.identifier === ARCANE_RECOVERY_ID
      || (sourceItem?.name?.toLowerCase?.() === ARCANE_RECOVERY_NAME);
    if (!isArcaneRecovery) return;

    if (game.user.id !== getPrimaryHandlerId(actor)) return;

    const current = actor.system?.attributes?.exhaustion ?? 0;
    if (current <= 0) return;

    actor.update({ "system.attributes.exhaustion": current - 1 });
    ui.notifications.info(
      `${actor.name}: Grave Resilience reduced Exhaustion (${current} → ${current - 1}).`
    );
  } catch (err) {
    console.error(`${MODULE_ID} | Grave Resilience hook failed`, err);
  }
}
