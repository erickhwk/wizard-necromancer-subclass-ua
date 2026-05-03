import { MODULE_ID } from "../constants.mjs";

const FEATURE_ID = "extinguish-undead";

export function registerExtinguishUndead() {
  Hooks.on("dnd5e.preUseActivity", onPreUseActivity);
  Hooks.on("dnd5e.preCreateActivityTemplate", onPreCreateTemplate);
}

async function onPreUseActivity(activity, usageConfig, dialogConfig, _messageConfig) {
  try {
    const featureItem = activity?.item;
    if (featureItem?.getFlag(MODULE_ID, "feature") !== FEATURE_ID) return;

    const caster = activity.actor;
    if (!caster) return false;

    const targets = Array.from(game.user.targets);
    if (targets.length !== 1) {
      ui.notifications.warn("Extinguish Undead: target exactly one Undead at 0 HP first.");
      return false;
    }
    const targetActor = targets[0]?.actor;
    if (!targetActor) {
      ui.notifications.warn("Extinguish Undead: targeted token has no actor.");
      return false;
    }
    if (targetActor.uuid === caster.uuid) {
      ui.notifications.warn("Extinguish Undead: target must be a separate Undead.");
      return false;
    }

    const creatureType = (targetActor.system?.details?.type?.value ?? "").toLowerCase();
    if (creatureType !== "undead") {
      ui.notifications.warn(`Extinguish Undead: ${targetActor.name} is not Undead.`);
      return false;
    }

    const targetHP = targetActor.system?.attributes?.hp?.value ?? 0;
    if (targetHP > 0) {
      ui.notifications.warn(`Extinguish Undead: ${targetActor.name} is not at 0 HP.`);
      return false;
    }

    const isOwned = await isControlledByCaster(targetActor, caster);
    if (!isOwned) {
      const slotKey = await promptSpellSlot(caster);
      if (!slotKey) {
        ui.notifications.info("Extinguish Undead: cancelled.");
        // The activity has already proceeded (Hooks.call is sync; can't abort
        // from an async hook). Sweep up the chat card and template the system
        // produced so the user can't bypass the slot cost.
        scheduleCleanup(activity, caster);
        return false;
      }
      const path = `system.spells.${slotKey}.value`;
      const current = foundry.utils.getProperty(caster, path) ?? 0;
      if (current <= 0) {
        ui.notifications.warn("Extinguish Undead: selected spell slot is depleted.");
        scheduleCleanup(activity, caster);
        return false;
      }
      await caster.update({ [path]: current - 1 });
    }

    const hd = targetActor.system?.attributes?.hd;
    const hdValue = (typeof hd?.value === "number" ? hd.value : null)
      ?? (typeof hd?.max === "number" ? hd.max : null)
      ?? 1;
    const dice = Math.max(1, Math.ceil(hdValue / 2));

    const part = activity.damage?.parts?.[0];
    if (part) {
      part.number = dice;
      part.denomination = 6;
      part.bonus = "";
      part.types = (part.types instanceof Set)
        ? new Set(["necrotic"])
        : ["necrotic"];
    }

    foundry.utils.setProperty(caster, `flags.${MODULE_ID}.extinguishTargetUuid`, targetActor.uuid);

    if (dialogConfig) dialogConfig.configure = false;
  } catch (err) {
    console.error(`${MODULE_ID} | Extinguish Undead preUseActivity failed`, err);
    return false;
  }
}

function onPreCreateTemplate(activity, templateData) {
  try {
    const featureItem = activity?.item;
    if (featureItem?.getFlag(MODULE_ID, "feature") !== FEATURE_ID) return;

    const caster = activity.actor;
    const targetUuid = foundry.utils.getProperty(caster, `flags.${MODULE_ID}.extinguishTargetUuid`);
    let targetToken = null;
    if (targetUuid) {
      const targetActor = fromUuidSync(targetUuid);
      targetToken = targetActor?.getActiveTokens?.()[0] ?? null;
    }
    if (!targetToken) {
      const targets = Array.from(game.user.targets);
      targetToken = targets[0] ?? null;
    }
    if (!targetToken) return;

    const center = targetToken.center ?? { x: targetToken.x, y: targetToken.y };
    templateData.x = center.x;
    templateData.y = center.y;

    // Distance/size is left as-is (UA's 10 ft from YAML). The dnd5e `radius`
    // template type carries `adjustedSize: true`, which makes Foundry add
    // (tokenSize × gridDist / 2) on top during interactive placement, yielding
    // 12.5 / 15 / 17.5 / 20 ft for Medium / Large / Huge / Gargantuan — the
    // 2024 emanation-from-edge math, computed by the system itself.
  } catch (err) {
    console.error(`${MODULE_ID} | Extinguish Undead template hook failed`, err);
  }
}

function scheduleCleanup(activity, caster) {
  const startedAt = Date.now();
  const itemUuid = activity?.item?.uuid;
  const activityUuid = activity?.uuid;
  const casterId = caster?.id;
  if (!itemUuid && !activityUuid) return;

  const interval = setInterval(async () => {
    if (Date.now() - startedAt > 6000) {
      clearInterval(interval);
      return;
    }

    let foundAnything = false;

    // Sweep matching chat messages from the past few seconds.
    const candidateMessages = game.messages.contents.filter(m => {
      const flagItem = m.getFlag?.("dnd5e", "item");
      const matches = flagItem?.uuid === itemUuid && m.speaker?.actor === casterId;
      const recent = Date.now() - new Date(m.timestamp ?? 0).getTime() < 6500;
      return matches && recent;
    });
    for (const msg of candidateMessages) {
      try { await msg.delete(); foundAnything = true; } catch (_) {}
    }

    // Sweep any template created with this activity's origin uuid.
    const templates = canvas?.scene?.templates?.contents ?? [];
    const candidateTemplates = templates.filter(t =>
      t.getFlag?.("dnd5e", "origin") === activityUuid
    );
    for (const t of candidateTemplates) {
      try { await t.delete(); foundAnything = true; } catch (_) {}
    }

    if (foundAnything) clearInterval(interval);
  }, 200);
}

async function isControlledByCaster(targetActor, casterActor) {
  const originUuid = targetActor.flags?.dnd5e?.summon?.origin;
  if (!originUuid) return false;
  const origin = await fromUuid(originUuid);
  const originActor = origin?.actor ?? origin?.parent?.actor ?? null;
  return originActor?.uuid === casterActor.uuid;
}

async function promptSpellSlot(actor) {
  const spells = actor.system?.spells ?? {};
  const available = Object.entries(spells)
    .map(([key, data]) => ({ key, level: data.level, value: data.value, max: data.max }))
    .filter(s => typeof s.level === "number" && s.level >= 5 && s.value > 0)
    .sort((a, b) => a.level - b.level);

  if (available.length === 0) {
    ui.notifications.warn("Extinguish Undead: no spell slot of level 5 or higher available.");
    return null;
  }

  const options = available.map(s =>
    `<option value="${s.key}">Level ${s.level} (${s.value}/${s.max})</option>`
  ).join("");

  const content = `
<div class="standard-form">
  <p>The targeted Undead is not under your control. Spend a spell slot of level 5 or higher to detonate it.</p>
  <div class="form-group">
    <label>Spell Slot</label>
    <div class="form-fields">
      <select name="slot">${options}</select>
    </div>
  </div>
</div>`.trim();

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Extinguish Undead — Spend Spell Slot" },
    content,
    buttons: [
      {
        action: "confirm",
        label: "Spend Slot",
        default: true,
        callback: (_event, button) => button.form.elements.slot?.value ?? null
      },
      { action: "cancel", label: "Cancel", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });
}
