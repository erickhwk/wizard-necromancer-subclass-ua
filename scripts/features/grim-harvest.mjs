import { MODULE_ID } from "../constants.mjs";
import { getPrimaryHandlerId } from "../util.mjs";

const FEATURE_ID = "grim-harvest";
const RANGE_FEET = 60;
const FLAG_TYPE = "grim-harvest-prompt";
const FLAG_APPLIED = "applied";

const recentlyHandled = new Set();

export function registerGrimHarvest() {
  Hooks.on("dnd5e.postUseActivity", onActivityUsed);
  Hooks.on("renderChatMessageHTML", attachCardButtons);
}

function onActivityUsed(activity, usageConfig, results) {
  try {
    const messageId = results?.message?.id;
    if (messageId) {
      if (recentlyHandled.has(messageId)) return;
      recentlyHandled.add(messageId);
      setTimeout(() => recentlyHandled.delete(messageId), 5000);
    }

    const actor = activity?.actor;
    if (!actor) return;

    const featureItem = actor.items.find(
      i => i.getFlag(MODULE_ID, "feature") === FEATURE_ID
    );
    if (!featureItem) return;

    const item = activity.item;
    if (item?.type !== "spell") return;
    if (item.system?.school !== "nec") return;

    const consume = usageConfig?.consume;
    const consumedSlot = consume === true || consume?.spellSlot === true;
    if (!consumedSlot) return;

    const baseLevel = item.system.level ?? 0;
    const scaling = usageConfig?.scaling ?? 0;
    const slotLevel = baseLevel + scaling;
    if (slotLevel < 1) return;

    const wizardLevels = actor.classes?.wizard?.system?.levels
      ?? actor.system?.details?.level
      ?? 0;
    const heal = slotLevel + wizardLevels;
    if (heal <= 0) return;

    if (game.user.id !== getPrimaryHandlerId(actor)) return;

    postCard({ caster: actor, sourceItem: featureItem, spell: item, slotLevel, heal });
  } catch (err) {
    console.error(`${MODULE_ID} | Grim Harvest hook failed`, err);
  }
}

async function postCard({ caster, sourceItem, spell, slotLevel, heal }) {
  const ownerIds = game.users
    .filter(u => caster.testUserPermission(u, "OWNER"))
    .map(u => u.id);
  const whisper = ownerIds.length < game.users.size ? ownerIds : [];

  const icon = sourceItem?.img || "icons/svg/mystery-man.svg";
  const spellName = spell?.name ?? "Necromancy spell";

  const content = `
<div class="dnd5e2 chat-card activation-card">
  <section class="card-header description">
    <header class="summary">
      <img class="gold-icon" src="${icon}" alt="Grim Harvest">
      <div class="name-stacked border">
        <span class="title">Grim Harvest</span>
        <span class="subtitle">Necromancer Feature</span>
      </div>
    </header>
    <section class="details card-content">
      <div class="wrapper">
        <p><em>${spellName}</em> cast at level ${slotLevel}.</p>
        <p>Target an Undead within ${RANGE_FEET} ft and click below to heal it for <strong>${heal}</strong> HP.</p>
      </div>
    </section>
  </section>
  <div class="card-buttons">
    <button type="button" data-action="grim-harvest-apply">
      <i class="fa-solid fa-heart-pulse"></i>
      <span>Heal targeted Undead (${heal} HP)</span>
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
        heal,
        slotLevel,
      }
    }
  });
}

function attachCardButtons(message, html) {
  if (message.getFlag(MODULE_ID, "type") !== FLAG_TYPE) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const button = root?.querySelector('button[data-action="grim-harvest-apply"]');
  if (!button) return;

  if (message.getFlag(MODULE_ID, FLAG_APPLIED)) {
    button.disabled = true;
    button.textContent = "Already applied";
    return;
  }

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    await applyGrimHarvest(message, button);
  });
}

async function applyGrimHarvest(message, button) {
  const casterUuid = message.getFlag(MODULE_ID, "casterUuid");
  const heal = message.getFlag(MODULE_ID, "heal");
  if (!casterUuid || !heal) return;

  const caster = await fromUuid(casterUuid);
  if (!caster) {
    ui.notifications.error("Grim Harvest: caster actor not found.");
    return;
  }

  if (!caster.isOwner) {
    ui.notifications.warn("Grim Harvest: only the caster's owner may apply.");
    return;
  }

  const targets = Array.from(game.user.targets);
  if (targets.length === 0) {
    ui.notifications.warn(`Grim Harvest: target an Undead token within ${RANGE_FEET} ft first.`);
    return;
  }
  if (targets.length > 1) {
    ui.notifications.warn("Grim Harvest: target exactly one Undead.");
    return;
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;
  if (!targetActor) return;

  const creatureType = (targetActor.system?.details?.type?.value ?? "").toLowerCase();
  if (creatureType !== "undead") {
    ui.notifications.warn(`Grim Harvest: ${targetActor.name} is not Undead (creature type: ${creatureType || "unset"}).`);
    return;
  }

  const casterTokens = caster.getActiveTokens();
  if (casterTokens.length === 0) {
    ui.notifications.warn("Grim Harvest: caster has no token on the active scene.");
    return;
  }
  const distance = Math.min(...casterTokens.map(t => measureDistance(t, targetToken)));
  if (distance > RANGE_FEET) {
    ui.notifications.warn(`Grim Harvest: ${targetActor.name} is ~${Math.round(distance)} ft away (max ${RANGE_FEET}).`);
    return;
  }

  await targetActor.applyDamage([{ value: heal, type: "healing" }]);

  await message.setFlag(MODULE_ID, FLAG_APPLIED, true);
  if (button) {
    button.disabled = true;
    button.textContent = "Applied";
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<p><strong>Grim Harvest:</strong> ${targetActor.name} regains ${heal} hit points.</p>`,
  });
}

function measureDistance(tokenA, tokenB) {
  const a = tokenA.center ?? { x: tokenA.x, y: tokenA.y };
  const b = tokenB.center ?? { x: tokenB.x, y: tokenB.y };
  if (canvas.grid?.measurePath) {
    const result = canvas.grid.measurePath([a, b]);
    return result?.distance ?? 0;
  }
  const dx = (a.x - b.x) / canvas.grid.size;
  const dy = (a.y - b.y) / canvas.grid.size;
  return Math.hypot(dx, dy) * (canvas.scene?.grid?.distance ?? 5);
}

