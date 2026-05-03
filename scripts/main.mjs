import { MODULE_ID } from "./constants.mjs";
import { registerGrimHarvest } from "./features/grim-harvest.mjs";
import { registerGraveResilience } from "./features/grave-resilience.mjs";
import { registerOverwhelmingNecrosis } from "./features/overwhelming-necrosis.mjs";
import { registerUndeadThralls } from "./features/undead-thralls.mjs";
import { registerHarvestUndead } from "./features/harvest-undead.mjs";
import { registerExtinguishUndead } from "./features/extinguish-undead.mjs";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | initializing`);
  registerGrimHarvest();
  registerGraveResilience();
  registerOverwhelmingNecrosis();
  registerUndeadThralls();
  registerHarvestUndead();
  registerExtinguishUndead();
});
