import { MODULE_ID } from "../constants.mjs";

const FEATURE_ID = "undead-thralls";
const ANIMATE_DEAD_ID = "animate-dead";

export function registerUndeadThralls() {
  // UA's "+1 effective level on Animate Dead" applies only to scaling-based
  // effects of the spell (its summon count). Mutating `usageConfig.scaling`
  // also bleeds into Grim Harvest's heal computation and the cast-level label,
  // both of which UA defines on the actual slot expended (not effective level).
  // So we leave scaling alone and bump only the chosen summon profile's count.
  // Animate Dead scales at +2 summons per upcast level, so +2 is the correct
  // delta for "+1 effective level".
  Hooks.on("dnd5e.preSummon", onPreSummon);
}

function onPreSummon(activity, profile, _options) {
  try {
    const actor = activity?.actor;
    if (!actor) return;

    const hasFeature = actor.items.some(
      i => i.getFlag(MODULE_ID, "feature") === FEATURE_ID
    );
    if (!hasFeature) return;

    const item = activity.item;
    if (item?.type !== "spell") return;
    if (item.system?.identifier !== ANIMATE_DEAD_ID) return;

    if (!profile) return;
    profile.count = `(${profile.count ?? "1"}) + 2`;
  } catch (err) {
    console.error(`${MODULE_ID} | Undead Thralls (preSummon) hook failed`, err);
  }
}
