import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { applyDurabilityDamage, sapSet, logMap, fruitSet, leafDropMap, saplingBlocks, isSlab } from "./main";
import { generateStructureName, getBlockStatesAndDirection } from "./fence"; 

export const treeInteractComponent = {
  onPlayerInteract(eventData) {
    const { player, block, dimension, face } = eventData;
    const inventory = player.getComponent("inventory");
    const equipment = player.getComponent("equippable");
    const selectedItem = equipment.getEquipment("Mainhand");

    if (logMap.has(block.typeId) && selectedItem.hasTag("minecraft:is_axe")) {
      eventData.cancel = true;

    system.runTimeout(() => {
      try {
        stripLog(
          player,
          block,
          selectedItem,
          inventory,
          player.selectedSlotIndex
        );
      } catch (error) {
        console.warn(`Error in stripLog: ${error.message}`);
      }
    }, 1);
    } 
    const data = saplingBlocks.find((f) => f.blockID === block.typeId);
    if (fruitSet.has(block.typeId) && getGrowthStage(block) === data.maxStage) {
      harvestTree(block)
      return;
    } 

    if (selectedItem.typeId === "minecraft:bone_meal") {

    if (!block || !sapSet.has(block.typeId)) return;

    // Get the current growth stage
    const currentStage = getGrowthStage(block);

    // 45% chance to advance the stage
    if (Math.random() < 0.45) {
      // Increment the stage, but don't exceed maxStage (2 in this case)
      const newStage = Math.min(currentStage + 1, 2);

      // Apply bonemeal effect
      applyBonemeal(block, dimension, player, equipment, selectedItem, newStage);

      // Check if the sapling should grow into a tree
      if (newStage === 2) {
        growTree(block, dimension);
      }
    } else {
      // Bonemeal was used but didn't advance the stage
      applyBonemealEffect(block, dimension, player, equipment, selectedItem);
    }
    return;
  } else {
    
    // Get block states and player direction
    const { stateName, stateValue } = getBlockStatesAndDirection(
      player,
      selectedItem,
      face
    );

    // Determine the adjacent block position based on the face
    let adjacentBlockPos;
    switch (face) {
      case "North":
        adjacentBlockPos = { x: block.x, y: block.y, z: block.z - 1 };
        break;
      case "South":
        adjacentBlockPos = { x: block.x, y: block.y, z: block.z + 1 };
        break;
      case "East":
        adjacentBlockPos = { x: block.x + 1, y: block.y, z: block.z };
        break;
      case "West":
        adjacentBlockPos = { x: block.x - 1, y: block.y, z: block.z };
        break;
      case "Up":
        adjacentBlockPos = { x: block.x, y: block.y + 1, z: block.z };
        break;
      case "Down":
        adjacentBlockPos = { x: block.x, y: block.y - 1, z: block.z };
        break;
    }

    const adjacentBlock = eventData.dimension.getBlock(adjacentBlockPos);
    if (face) {
      if (
        adjacentBlock.typeId === "minecraft:air" ||
        adjacentBlock.typeId.includes("_inventory")
      ) {
        // Handle block placement with state against a log
        const commandBlock = stateName
          ? `setblock ${adjacentBlockPos.x} ${adjacentBlockPos.y} ${adjacentBlockPos.z} ${selectedItem.typeId} ["${stateName}"="${stateValue}"]`
          : `setblock ${adjacentBlockPos.x} ${adjacentBlockPos.y} ${adjacentBlockPos.z} ${selectedItem.typeId}`;

        system.runTimeout(() => {
          try {
            player.runCommand(commandBlock);
            if (player.getGameMode() !== "creative") {
              if (selectedItem.amount === 1) {
                equipment.setEquipment("Mainhand", undefined);
              } else {
                selectedItem.amount -= 1;
                equipment.setEquipment("Mainhand", selectedItem);
              }
            }
          } catch (error) {
            console.warn(`Error: ${error.message}`);
          }
        }, 1);
      }
    }
  }
  }
};

export const leafDefaultComponent = {
  beforeOnPlayerPlace(e) {
    e.permutationToPlace = e.permutationToPlace.withState("wiki:should_decay", false);
  }
};

function getGrowthStage(block) {
  // Assuming the growth state ID is "wiki:growth_stage"
  return block.permutation.getState("wiki:growth_stage") || 0;
}

function applyBonemealEffect(block, dimension, player, inventory, selectedItem) {
  try {
    dimension.spawnParticle("minecraft:crop_growth_emitter", block.center());
  } catch (error) {
    // Handle or ignore the error
  }
  dimension.playSound("item.bone_meal.use", block.center());

  // Reduce bone meal item
  if (player.getGameMode() !== "creative") {
    if (selectedItem.amount === 1) {
      inventory.setEquipment("Mainhand", undefined);
    } else {
      selectedItem.amount -= 1;
      inventory.setEquipment("Mainhand", selectedItem);
    }
  }
}

function applyBonemeal(block, dimension, player, equipment, selectedItem, newStage) {
  applyBonemealEffect(block, dimension, player, equipment, selectedItem);
  
  // Set the new growth stage
  block.setPermutation(block.permutation.withState("wiki:growth_stage", newStage));
}

function growTree(block, dimension) {
  const { x, y, z } = block;
  const randomNumber = Math.floor(Math.random() * 4) + 1;
  const baseTreeType = generateStructureName(block.typeId);
  const treeType = `${baseTreeType}_${randomNumber}`;
  
  // Define the area to check based on your tree size
  const checkRadius = 2; // Adjust based on your tree's maximum width
  const checkHeight = 7; // Adjust based on your tree's maximum height

  // Check if the area is clear (air, grass, saplings or leaves can be replaced) - will not replace the air blocks in structure if set up correct fyi
  if (isAreaClear(dimension, x, y, z, checkRadius, checkHeight)) {
    world.structureManager.place(treeType, dimension, { x: x - checkRadius, y, z: z - checkRadius });
  } else {
    console.warn("Unable to grow tree: area is not clear");
  }
}

function isAreaClear(dimension, x, y, z, radius, height) {
  let heightAdjust = 3; //adjust this based on how high up your leaves start

  // Check the first two blocks above the sapling
  for (let i = 1; i <= heightAdjust; i++) {
      let blockAbove = dimension.getBlock({x, y: y + i, z});
      if (blockAbove.type.id !== "minecraft:air" &&
          blockAbove.type.id !== "minecraft:grass" &&
          blockAbove.type.id !== "minecraft:tall_grass" &&
          !blockAbove.type.id.includes("leaves") &&
          !blockAbove.type.id.includes("sapling") &&
          !blockAbove.type.id.includes("snow")) {
          return false;
      }
  }

  // Check the 5x5 area on the third block above
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
        for (let dy = heightAdjust; dy < height; dy++) {
          let blockAbove = dimension.getBlock({x: x + dx, y: y + dy, z: z + dz});
          if (blockAbove.type.id !== "minecraft:air" &&
              blockAbove.type.id !== "minecraft:grass" &&
              blockAbove.type.id !== "minecraft:tall_grass" &&
              !blockAbove.type.id.includes("leaves") &&
              !blockAbove.type.id.includes("sapling") &&
              !blockAbove.type.id.includes("snow")) {
              return false;
          }
      }
    }
  }

  return true;
}

function stripLog(player, block, selectedItem, inventory, selectedSlotIndex) {
  const stippedLogType = logMap.get(block.typeId);
  if (!stippedLogType) return;

  const currentPermutation = block.permutation;
  const blockStates = currentPermutation.getAllStates();
  const customBlockFace = blockStates["minecraft:block_face"];
  const strippedLogPermutation = BlockPermutation.resolve(
    stippedLogType
  ).withState("minecraft:block_face", customBlockFace);

  block.setPermutation(strippedLogPermutation);
  player.playSound("item.axe.strip");
  // Apply durability damage for log stripping
  applyDurabilityDamage(player, selectedItem, inventory, selectedSlotIndex);
}

function harvestTree(block) {
  const fruit = leafDropMap.get(block.typeId)
  system.runTimeout(() => {
    block.dimension.spawnItem(new ItemStack(fruit, 3), block.location);
    block.setPermutation(block.permutation.withState("wiki:growth_stage", 0));
},1);
};

export {
  growTree,
  getGrowthStage
};