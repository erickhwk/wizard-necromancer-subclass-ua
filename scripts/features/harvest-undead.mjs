import { MODULE_ID } from "../constants.mjs";
import { getPrimaryHandlerId } from "../util.mjs";

const FEATURE_ID = "harvest-undead";
const FLAG_TYPE = "harvest-undead-prompt";
const FLAG_APPLIED = "applied";

export function registerHarvestUndead() {
  Hooks.on("dnd5e.applyDamage", onDamageApplied);
  Hooks.on("renderChatMessageHTML", attachCardButtons);
}

function onDamageApplied(actor, amount, _options) {
  try {
    if (typeof amount !== "number" || amount <= 0) return;

    const featureItem = actor.items.find(
      i => i.getFlag(MODULE_ID, "feature") === FEATURE_ID
    );
    if (!featureItem) return;

    const hp = actor.system?.attributes?.hp;
    if (!hp) return;

    const newHP = hp.value;
    const maxHP = hp.max;
    if (!maxHP) return;
    const bloodied = Math.floor(maxHP / 2);
    const oldHP = newHP + amount;

    if (oldHP <= bloodied) return;
    if (newHP > bloodied) return;
    if (newHP <= 0) return;

    if (game.user.id !== getPrimaryHandlerId(actor)) return;

    postCard({ caster: actor, sourceItem: featureItem });
  } catch (err) {
    console.error(`${MODULE_ID} | Harvest Undead hook failed`, err);
  }
}

async function postCard({ caster, sourceItem }) {
  const ownerIds = game.users
    .filter(u => caster.testUserPermission(u, "OWNER"))
    .map(u => u.id);
  const whisper = ownerIds.length < game.users.size ? ownerIds : [];

  const wizardLevel = caster.classes?.wizard?.system?.levels
    ?? caster.system?.details?.level
    ?? 0;

  const icon = sourceItem?.img || "icons/svg/explosion.svg";

  const content = `
<div class="dnd5e2 chat-card activation-card">
  <section class="card-header description">
    <header class="summary">
      <img class="gold-icon" src="${icon}" alt="Harvest Undead">
      <div class="name-stacked border">
        <span class="title">Harvest Undead</span>
        <span class="subtitle">Necromancer Feature — Reaction</span>
      </div>
    </header>
    <section class="details card-content">
      <div class="wrapper">
        <p>You became Bloodied. As a Reaction, target an Undead under your control that you can see; reduce it to 0 HP and regain <strong>${wizardLevel}</strong> hit points.</p>
      </div>
    </section>
  </section>
  <div class="card-buttons">
    <button type="button" data-action="harvest-undead-apply">
      <i class="fa-solid fa-skull"></i>
      <span>Sacrifice targeted Undead (heal ${wizardLevel} HP)</span>
    </button>
  </div>
</div>`.trim();

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content,
    whisper,
    flags: {
      [MODULE_ID]: {
        type: FLAG_TYPE,
        casterUuid: caster.uuid,
        heal: wizardLevel,
      }
    }
  });
}

function attachCardButtons(message, html) {
  if (message.getFlag(MODULE_ID, "type") !== FLAG_TYPE) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const button = root?.querySelector('button[data-action="harvest-undead-apply"]');
  if (!button) return;

  if (message.getFlag(MODULE_ID, FLAG_APPLIED)) {
    button.disabled = true;
    button.textContent = "Already applied";
    return;
  }

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    await applyHarvestUndead(message, button);
  });
}

async function applyHarvestUndead(message, button) {
  const casterUuid = message.getFlag(MODULE_ID, "casterUuid");
  const heal = message.getFlag(MODULE_ID, "heal");
  if (!casterUuid || heal == null) return;

  const caster = await fromUuid(casterUuid);
  if (!caster) {
    ui.notifications.error("Harvest Undead: caster actor not found.");
    return;
  }

  if (!caster.isOwner) {
    ui.notifications.warn("Harvest Undead: only the caster's owner may apply.");
    return;
  }

  const targets = Array.from(game.user.targets);
  if (targets.length === 0) {
    ui.notifications.warn("Harvest Undead: target an Undead under your control first.");
    return;
  }
  if (targets.length > 1) {
    ui.notifications.warn("Harvest Undead: target exactly one Undead.");
    return;
  }

  const targetActor = targets[0]?.actor;
  if (!targetActor) return;

  if (targetActor.uuid === caster.uuid) {
    ui.notifications.warn("Harvest Undead: target must be a separate Undead.");
    return;
  }

  const creatureType = (targetActor.system?.details?.type?.value ?? "").toLowerCase();
  if (creatureType !== "undead") {
    ui.notifications.warn(`Harvest Undead: ${targetActor.name} is not Undead.`);
    return;
  }

  const targetHP = targetActor.system?.attributes?.hp?.value ?? 0;
  if (targetHP <= 0) {
    ui.notifications.warn(`Harvest Undead: ${targetActor.name} is already at 0 HP.`);
    return;
  }

  // Strict "under your control": target was summoned by an item owned by caster.
  const originUuid = targetActor.flags?.dnd5e?.summon?.origin;
  if (!originUuid) {
    ui.notifications.warn(`Harvest Undead: ${targetActor.name} was not summoned by you.`);
    return;
  }
  const origin = await fromUuid(originUuid);
  const originActor = origin?.actor ?? origin?.parent?.actor ?? null;
  if (!originActor || originActor.uuid !== caster.uuid) {
    ui.notifications.warn(`Harvest Undead: ${targetActor.name} is not under your control.`);
    return;
  }

  await targetActor.update({ "system.attributes.hp.value": 0 });
  await caster.applyDamage([{ value: heal, type: "healing" }]);

  await message.setFlag(MODULE_ID, FLAG_APPLIED, true);
  if (button) {
    button.disabled = true;
    button.textContent = "Applied";
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<p><strong>Harvest Undead:</strong> ${targetActor.name} reduced to 0 HP. ${caster.name} regains ${heal} hit points.</p>`,
  });
}
