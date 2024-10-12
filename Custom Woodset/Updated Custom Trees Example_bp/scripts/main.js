import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import { randomTickComponent, OnTickComponent, leafDrop } from "./OnTick"
import { treeInteractComponent, leafDefaultComponent } from './tree';
import { FenceInteractComponent, PlaceComponent, PlaceGateComponent, GateInteract } from './fence';
import { slabComponent } from './slabs';
import 'door'
import 'trapdoor'

// Add more mappings here as needed - Note, the doors need to be set on door.js at line 237.
const isSlab = new Set([
  "wiki:white_oak_slab",
  "wiki:orange_tree_slab"
]);
const fenceSet = new Set([
  "wiki:white_oak_fence",
  "wiki:white_oak_fence_gate",
  "wiki:orange_tree_fence",
  "wiki:orange_tree_fence_gate"
]);
const fenceMap = new Map([
  ["wiki:orange_tree_fence_inventory", "wiki:orange_tree_fence"],
  ["wiki:fence_inventory", "wiki:white_oak_fence"]
]);
const leafSet = new Set([
  "wiki:white_oak_leaves",
  "wiki:orange_tree_leaves"
]);
const fruitSet = new Set([
  "wiki:orange_tree_leaves"
]);
const leafDropMap = new Map([
  ["wiki:orange_tree_leaves", "wiki:orange_item"],
  ["wiki:white_oak_leaves", "wiki:custom_sapling_placer"]
]);
const saplingBlocks = [
  {
    blockID: "wiki:white_oak_sapling",
    maxStage: 2,
    growChance: {
      numerator: 1,
      denominator: 3
    }
  },
  {
    blockID: "wiki:orange_tree_sapling",
    maxStage: 2,
    growChance: {
      numerator: 1,
      denominator: 3
    }
  },
  {
    blockID: "wiki:orange_tree_leaves",
    maxStage: 3,
    growChance: {
      numerator: 1,
      denominator: 7 // adjust this to adjust speed of fruit growth
    }
  }
  // Add other sapling types here
];
const logSet = new Set([
  "wiki:white_oak_log",
  "wiki:orange_tree_log"
]);
const sapSet = new Set([
  "wiki:white_oak_sapling",
  "wiki:orange_tree_sapling"
]);
const logMap = new Map([
  ["wiki:orange_tree_log", "wiki:stripped_orange_tree_log"],
  ["wiki:white_oak_log", "wiki:stripped_white_oak_log"]
]);
const trapSet = new Set([
  "wiki:white_oak_trapdoor",
  "wiki:orange_tree_trapdoor"
]);

// This handles the durality damage for all blocks (except slabs - handled in slabs.js) and removing the block above for fences and gates
const DestroyComponent = {
  onPlayerDestroy(e) {
    const { block, player } = e;
    const aboveBlock = block.above();
    const blockBelow = block.below();

    // Remove wiki:fence_inventory or invisible fence gate on top if present
    if ((aboveBlock.typeId.includes("_inventory")) || (fenceSet.has(aboveBlock.typeId) && aboveBlock.permutation.getState('wiki:invisible'))) {
      aboveBlock.setType("minecraft:air");
    }

    // add wiki:fence_inventory if fence present below
    if (fenceSet.has(blockBelow.typeId)) {
      block.setPermutation(
        BlockPermutation.resolve("wiki:fence_inventory", { "wiki:post": 1 })
      );
    }
    const inventory = player.getComponent("inventory");
    const selectedItem = inventory.container.getItem(player.selectedSlotIndex);
    if (
      selectedItem &&
      (selectedItem.typeId.includes("shovel") ||
        selectedItem.typeId.includes("hoe") ||
        selectedItem.typeId.includes("_axe") ||
        selectedItem.typeId.includes("_pickaxe") ||
        selectedItem.typeId.includes("shears"))
    ) {
      system.runTimeout(() => {
        applyDurabilityDamage(
          player,
          selectedItem,
          inventory,
          player.selectedSlotIndex
        );
      }, 1);
    } 
  },
};

const customComponents = {
  "wiki:fence_interact": FenceInteractComponent,
  "wiki:on_player_destroy": DestroyComponent,
  "wiki:on_tick": OnTickComponent,
  "wiki:on_player_placed": PlaceComponent,
  "wiki:random_tick": randomTickComponent,
  "wiki:slab_interact": slabComponent,
  "wiki:interact_tree": treeInteractComponent,
  "wiki:gate_interact": GateInteract,
  "wiki:gate_placed": PlaceGateComponent,
  "wiki:leaf_place": leafDefaultComponent
};

let lastBrokenBlockType = null;
let lastBrokenBlockIsDouble = false;

// Use this world initialization event to register all custom components
world.beforeEvents.worldInitialize.subscribe(({ blockComponentRegistry }) => {
  for (const [componentName, componentImplementation] of Object.entries(customComponents)) {
    blockComponentRegistry.registerCustomComponent(componentName, componentImplementation);
  }
});

world.beforeEvents.playerBreakBlock.subscribe((eventData) => {
  const { block, player, dimension } = eventData;
  const blockBelow = block.below();
  const inventory = player.getComponent("inventory");
  const selectedItem = inventory.container.getItem(player.selectedSlotIndex);
  const { hasSilkTouch } = getRelevantEnchantments(selectedItem);

  if (selectedItem && leafSet.has(block.typeId) && selectedItem.typeId ===  "minecraft:shears" && !hasSilkTouch) {
    const spawnItem = block.typeId;
    system.runTimeout(() => {
      block.dimension.spawnItem(new ItemStack(spawnItem, 1), block.location);
    }, 1);
  } else if(leafSet.has(block.typeId) && !hasSilkTouch){
    leafDrop(block, true);
  }

  if (isSlab.has(block.typeId)) {
    lastBrokenBlockType = block.typeId;
    lastBrokenBlockIsDouble =
      block.permutation.getState("wiki:double") === true;
  system.runTimeout(() => {
    if (!selectedItem) {
      slabDrop(block, dimension, player);
      
    } else if (
      selectedItem.typeId.includes("shovel") ||
      selectedItem.typeId.includes("hoe") ||
      selectedItem.typeId.includes("_axe") ||
      selectedItem.typeId.includes("_pickaxe")
    ) {
      applyDurabilityDamage(
        player,
        selectedItem,
        inventory,
        player.selectedSlotIndex
      );
      slabDrop(block, dimension, player);
    } else {
      slabDrop(block, dimension, player);
    }
  }, 1);
} else if (fenceSet.has(blockBelow.typeId)) {
  system.runTimeout(() => {
      if (blockBelow.typeId.includes("wiki:") && blockBelow.typeId.includes("_gate")) {
        const currentStates = blockBelow.permutation.getAllStates();

        const cardinalDirection = currentStates['minecraft:cardinal_direction'];
            const newAboveStates = { ...currentStates };
            if (cardinalDirection === 'south') {
                delete newAboveStates['minecraft:cardinal_direction'];
            }
            newAboveStates['wiki:invisible'] = true;
            block.setPermutation(BlockPermutation.resolve(blockBelow.typeId, newAboveStates));
          
      } else if (blockBelow.typeId.includes("wiki:") && !blockBelow.typeId.includes("_gate")) {
        block.setPermutation(
          BlockPermutation.resolve("wiki:fence_inventory", { "wiki:post": 1 })
        );
      }
  }, 1);
  } 
});

function slabDrop(block, dimension, player) {
  if (player.getGameMode() !== "creative") {
    if (lastBrokenBlockType) {
      const blockData = lastBrokenBlockType;
  
      if (blockData) {
        let dropItem;
  
        if (
          lastBrokenBlockIsDouble
        ) {
          dropItem = new ItemStack(lastBrokenBlockType, 1);
        } 
        if (dropItem) {
          dimension.spawnItem(dropItem, block.location);
        }
      }
      lastBrokenBlockType = null;
      lastBrokenBlockIsDouble = false;
    }
  }
}

function applyDurabilityDamage(player, item, inventory, slotIndex) {
  const durabilityComponent = item.getComponent("minecraft:durability");
  if (durabilityComponent) {
    const { unbreakingLevel } = getRelevantEnchantments(item);
    
    if (Math.random() < 1 / (unbreakingLevel + 1)) {
      const newDamage = durabilityComponent.damage + 1;
      if (newDamage >= durabilityComponent.maxDurability) {
        inventory.container.setItem(slotIndex, undefined);
        player.playSound("random.break");
      } else {
        durabilityComponent.damage = newDamage;
        inventory.container.setItem(slotIndex, item);
      }
    }
  }
}

function getRelevantEnchantments(item) {
  let unbreakingLevel = 0;
  let hasSilkTouch = false;

  try {
      const enchantableComponent = item.getComponent("minecraft:enchantable");
      if (enchantableComponent) {
          const enchantments = enchantableComponent.getEnchantments();
          for (const enchant of enchantments) {
              if (enchant.type.id === "unbreaking") {
                  unbreakingLevel = enchant.level;
              } else if (enchant.type.id === "silk_touch") {
                  hasSilkTouch = true;
              }
          }
      }
  } catch (error) {
  }
  return { unbreakingLevel, hasSilkTouch };
}



export {
  applyDurabilityDamage,
  getRelevantEnchantments,
  isSlab,
  fenceSet,
  fenceMap,
  leafSet,
  leafDropMap,
  saplingBlocks,
  logSet,
  sapSet,
  logMap,
  trapSet,
  fruitSet
}