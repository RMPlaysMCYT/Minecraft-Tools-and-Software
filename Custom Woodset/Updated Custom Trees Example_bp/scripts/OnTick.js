import { system, ItemStack } from '@minecraft/server';
import { growTree, getGrowthStage } from './tree';
import { saplingBlocks, logSet, leafSet, leafDropMap, sapSet, fruitSet } from './main';


// Initialize a Map to store the state of each block for tracking changes
const blockStates = new Map();
export const OnTickComponent = {
  onTick(e) {
    // Destructure event data for easier access
    const { block } = e;

    // Get adjacent blocks
    const north = block.north();
    const east = block.east();
    const south = block.south();
    const west = block.west();

    // Define an array of block types to exclude from connections
    const excludeBlocksArray = [
      "minecraft:air",
      "minecraft:wooden_door",
      "minecraft:iron_door",
      "minecraft:acacia_door",
      "minecraft:birch_door",
      "minecraft:crimson_door",
      "minecraft:dark_oak_door",
      "minecraft:jungle_door",
      "minecraft:oak_door",
      "minecraft:spruce_door",
      "minecraft:warped_door",
      "minecraft:mangrove_door",
      "minecraft:cherry_door",
      "minecraft:bamboo_door",
      "minecraft:iron_trapdoor",
      "minecraft:acacia_trapdoor",
      "minecraft:birch_trapdoor",
      "minecraft:crimson_trapdoor",
      "minecraft:dark_oak_trapdoor",
      "minecraft:jungle_trapdoor",
      "minecraft:oak_trapdoor",
      "minecraft:spruce_trapdoor",
      "minecraft:warped_trapdoor",
      "minecraft:mangrove_trapdoor",
      "minecraft:cherry_trapdoor",
      "minecraft:bamboo_trapdoor",
      "minecraft:trapdoor",
      "minecraft:glass",
      "minecraft:glass_pane",
      "wiki:fence_inventory",
      "minecraft:water",
      "minecraft:lava",
      "minecraft:flowing_lava",
      "minecraft:flowing_water",
      // Add other block types you want to exclude
    ];

    // Check if the adjacent block is not in the excludeBlocksArray
    const northConnects = !excludeBlocksArray.includes(north?.typeId);
    const eastConnects = !excludeBlocksArray.includes(east?.typeId);
    const southConnects = !excludeBlocksArray.includes(south?.typeId);
    const westConnects = !excludeBlocksArray.includes(west?.typeId);

    // Update block states based on the presence of adjacent blocks
    block.setPermutation(
      block.permutation.withState("wiki:north_picket", northConnects ? 1 : 0)
    );
    block.setPermutation(
      block.permutation.withState("wiki:south_picket", southConnects ? 1 : 0)
    );
    block.setPermutation(
      block.permutation.withState("wiki:east_picket", eastConnects ? 1 : 0)
    );
    block.setPermutation(
      block.permutation.withState("wiki:west_picket", westConnects ? 1 : 0)
    );
  },
};

export const randomTickComponent = {
  onRandomTick(e) {
    const { block, dimension } = e;
    
    if (sapSet.has(block.typeId)) {
      handleSaplingGrowth(block, dimension);
    } else if (fruitSet.has(block.typeId)) {
      if (isAir(block, dimension)) {
        handleFruitGrowth(block);
        handleLeafDecay(block, dimension);  
      }
    } else if (leafSet.has(block.typeId)) {
      handleLeafDecay(block, dimension);
    } 
  }
};

function randomNum(min, max) {
  //return a random number
  return Math.random() * (max - min) + min;
}

function handleSaplingGrowth(block, dimension) {
  const data = saplingBlocks.find((f) => f.blockID === block.typeId);
  if (!data) return;

  const stage = getGrowthStage(block);
  if (stage >= data.maxStage) return;

  const num = randomNum(0, data.growChance.denominator);
  if (num > data.growChance.numerator) return;

  const newStage = stage + 1;
  block.setPermutation(block.permutation.withState("wiki:growth_stage", newStage));

  if (newStage === data.maxStage) {
    growTree(block, dimension);
  }
}

function handleLeafDecay(block, dimension) {
  const shouldDecay = block.permutation.getState("wiki:should_decay");
  if (!shouldDecay) return;

  const currentTier = block.permutation.getState("wiki:decay_tier") || 0;

  const newDecayTier = getNewDecayTier(block, dimension, currentTier);
  
  if (newDecayTier === 0) {
    leafDrop(block);
  } else if (newDecayTier !== currentTier) {
    block.setPermutation(block.permutation.withState("wiki:decay_tier", newDecayTier));
  }
}

function getNewDecayTier(block, dimension, currentTier) {
  // Check for nearby logs first
  if (hasNearbyLog(block, dimension, 2)) {
    return currentTier; 
  }

  let num = Math.random();
  // Control decay speed with this, only if no logs are nearby
  if (num > 0.4) { // 40% chance to decay 1 stage
    return Math.max(0, currentTier - 1);
  } else if (num < 0.6) { // 60% chance to decay fully
    leafDrop(block);
  }

  return currentTier;
}

function hasNearbyLog(block, dimension, radius) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const checkLocation = {
          x: block.location.x + dx,
          y: block.location.y + dy,
          z: block.location.z + dz
        };
        const checkBlock = dimension.getBlock(checkLocation);
        if (checkBlock && logSet.has(checkBlock.type.id)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function leafDrop(block, broken) {
  const leafType = block.type.id;
  const dropLocation = block.location;
  const saplingType = leafDropMap.get(leafType);
  const randomValue = Math.random();

  if (fruitSet.has(leafType) && getGrowthStage(block) === 2) {
    system.runTimeout(() => {
      block.dimension.spawnItem(new ItemStack(saplingType, 3), dropLocation);
  },1);
  }

  if (randomValue < 0.02) {
    // 2% chance to drop a sapling
    if (saplingType) {
    system.runTimeout(() => {
      block.dimension.spawnItem(new ItemStack(saplingType, 1), dropLocation);
  },1);
}
  } else if (randomValue > 0.95) {
    // 5% chance to drop sticks 
    system.runTimeout(() => {
      block.dimension.spawnItem(new ItemStack("minecraft:stick", 1), dropLocation);
  },1);
  }
  // 93% chance to drop nothing 

  if (!broken) {
    // Remove the leaf block if it decayed natually, skip if player broken. 
  block.setType("minecraft:air");
  }
}

function handleFruitGrowth(block) {
  const data = saplingBlocks.find((f) => f.blockID === block.typeId);
  if (!data) return;

  const stage = getGrowthStage(block);
  if (stage >= data.maxStage) return;

  const num = randomNum(0, data.growChance.denominator);
  if (num > data.growChance.numerator) return;

  const newStage = stage + 1;
  block.setPermutation(block.permutation.withState("wiki:growth_stage", newStage));
};

// this function looks if there is an air block to the sides before advancing growth of the fruit
function isAir(block, dim) {
  const directions = ["North", "South", "East", "West"];
  for (const direction of directions) {
    let adjacentBlockPos;
    switch (direction) {
      case "North":
        adjacentBlockPos = {
          x: block.location.x,
          y: block.location.y,
          z: block.location.z - 1,
        };
        break;
      case "South":
        adjacentBlockPos = {
          x: block.location.x,
          y: block.location.y,
          z: block.location.z + 1,
        };
        break;
      case "East":
        adjacentBlockPos = {
          x: block.location.x + 1,
          y: block.location.y,
          z: block.location.z,
        };
        break;
      case "West":
        adjacentBlockPos = {
          x: block.location.x - 1,
          y: block.location.y,
          z: block.location.z,
        };
        break;
    }

    try {
      const adjacentBlock = dim.getBlock(adjacentBlockPos);
      if (adjacentBlock.typeId === "minecraft:air") {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.warn(`Error: ${error}`);
    }
  }
}