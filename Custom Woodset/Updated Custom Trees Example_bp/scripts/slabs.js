import { world, ItemStack, system, BlockPermutation } from "@minecraft/server";
import { isSlab } from './main';

export const slabComponent = {
  onPlayerInteract(e) {
    const { block, player, face } = e;
    const equipment = player.getComponent("equippable");
    const selectedItem = equipment.getEquipment("Mainhand");

    if (!selectedItem || selectedItem === undefined) return;

    // Check if the selected item is a water bucket and handle waterlogging
    if ( selectedItem?.typeId === "minecraft:water_bucket" ) {

      if (!block.permutation.getState("wiki:double") ) {

        // Check if the current dimension is not the Nether
        if (e.dimension.id !== "minecraft:nether") {

          // If not in creative mode, replace water bucket with empty bucket
          if (player.getGameMode() !== "creative") {
            equipment.setEquipment( "Mainhand", new ItemStack("minecraft:bucket", 1) );
          }

          player.playSound( "bucket.empty_water" );

          // Set block to waterlogged and place corresponding structure
          const verticalHalf = block.permutation.getState(
            "minecraft:vertical_half"
          );

          // place the waterlogged block structure into the world
          const structureName = generateStructureName(block.typeId, verticalHalf);
          const { x, y, z } = block;
          world.structureManager.place(structureName, e.dimension, { x, y, z });

          // Need to set the waterlogged state after placing the structure
          block.setPermutation(
            block.permutation.withState("wiki:waterlogged", true)
          );
        } else {
          e.dimension.spawnParticle("minecraft:water_evaporation_bucket_emitter", block.center());
          player.playSound( "bucket.empty_water" );
          player.playSound("random.fizz", { pitch: 1.0, volume: 1.0 });
          // If not in creative mode, replace water bucket with empty bucket
          if (player.getGameMode() !== "creative") {
            equipment.setEquipment( "Mainhand", new ItemStack("minecraft:bucket", 1) );
          }
        }
      }

      return; // Exit the function after handling water bucket
    }
    // Check if the selected item is a empty bucket and handle un-waterlogging
    else if ( selectedItem?.typeId === "minecraft:bucket" ) {

      if ( block.permutation.getState("wiki:waterlogged") ) {

        // Save the state of the block
        const currentPermutation = block.permutation;
        const currentBlock = block.typeId;

        player.playSound( "bucket.fill_water" );
        block.setType("minecraft:air");

        // If not in creative mode, replace empty bucket with water bucket
        if (player.getGameMode() !== "creative") {
          equipment.setEquipment(
            "Mainhand",
            new ItemStack("minecraft:water_bucket", 1)
          );
        }
       
        // Apply the new permutation
        block.setType(currentBlock);

        // Apply the previous permutation (now un waterlogged)
        const newPermutation = currentPermutation
          .withState("wiki:waterlogged", false)
          .withState("minecraft:vertical_half", currentPermutation.getState("minecraft:vertical_half"));
        block.setPermutation(newPermutation);       
      }

      return;  // Exit the function after handling bucket
    }

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

    const adjacentBlock = e.dimension.getBlock(adjacentBlockPos);

    // Check if the adjacent block is air, water, or lava
    if (
      ["minecraft:air", "minecraft:water", "minecraft:lava"].includes(
        adjacentBlock.typeId
      )
    ) {
      const verticalHalf = block.permutation.getState(
        "minecraft:vertical_half"
      );

      // Check if the selected item is a slab
      if (isSlab.has(selectedItem.typeId)) {
        // Determine if we should create a double slab or place a new slab
        const isBottomUp = verticalHalf === "bottom" && face === "Up";
        const isTopDown = verticalHalf === "top" && face === "Down";

        if ((isBottomUp || isTopDown) && selectedItem.typeId === block.typeId) {
          // Create a double slab
          if (!block.permutation.getState("wiki:double")) {
            const waterlogged = block.permutation.getState("wiki:waterlogged");
            if (waterlogged) {
                block.setType( "minecraft:air" ); // remove waterlogged slab..
                block.setType( selectedItem.typeId );
            }
            block.setPermutation( block.permutation.withState("wiki:double", true) );

            player.playSound("use.stone");
            if (player.getGameMode() !== "creative") {
              if (selectedItem.amount === 1) {
                equipment.setEquipment("Mainhand", undefined);
              } else {
                selectedItem.amount -= 1;
                equipment.setEquipment("Mainhand", selectedItem);
              }
            }
          } else {
            // Manually handle placement against double slabs
            placeSlab(
              player,
              selectedItem,
              adjacentBlockPos,
              face,
              equipment,
              block,
              true
            );
          }
        } else if (block.permutation.getState("wiki:double")) {
          // Handle placement against the side of a double slab
          placeSlab(
            player,
            selectedItem,
            adjacentBlockPos,
            face,
            equipment,
            block,
            true
          );
        } else {
          // Place a slab on top, bottom, or side of a single slab
          placeSlab(
            player,
            selectedItem,
            adjacentBlockPos,
            face,
            equipment,
            block,
            false
          );
        }
      } else {
        // Handle non-slab block placement with state
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
  },
};

export function placeSlab(
  player,
  selectedItem,
  adjacentBlockPos,
  face,
  equipment,
  targetBlock,
  isDoubleSlab
) {
  let verticalHalf;

  // Use getBlockFromViewDirection to get the exact hit location on the block face
  const raycastOptions = {
    maxDistance: 5, // Adjust as needed
    includePassableBlocks: false,
  };

  const raycastHit = player.getBlockFromViewDirection(raycastOptions);

  if (raycastHit && isDoubleSlab) {
    const faceLocation = raycastHit.faceLocation;

    if (face === "Up" || face === "Down") {
      verticalHalf = face === "Up" ? "bottom" : "top";
    } else {
      // For side faces, use the y-coordinate of the faceLocation
      verticalHalf = faceLocation.y > 0.5 ? "top" : "bottom";
    }
  } else {
    // Fallback to default behavior if raycast fails
    if (face === "Up") {
      verticalHalf = "bottom";
    } else if (face === "Down") {
      verticalHalf = "top";
    } else {
      // For side placement, match the vertical half of the target block if it's a slab
      if (isSlab.has(targetBlock.typeId)) {
        verticalHalf = targetBlock.permutation.getState(
          "minecraft:vertical_half"
        );
      } else {
        verticalHalf = "bottom"; // Default to bottom for non-slab blocks
      }
    }
  }

  const command = `setblock ${adjacentBlockPos.x} ${adjacentBlockPos.y} ${adjacentBlockPos.z} ${selectedItem.typeId} ["minecraft:vertical_half"="${verticalHalf}"]`;

  system.runTimeout(() => {
    try {
      player.runCommand(command);
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

function getBlockStatesAndDirection(player, selectedItem, face) {
  const blockPermutation = BlockPermutation.resolve(selectedItem.typeId);
  const blockStates = blockPermutation.getAllStates();
  let stateName = null;
  let stateValue = null;

  // Prioritize block states in a specific order
  const statePriority = [
    "minecraft:block_face",
    "minecraft:cardinal_direction",
    "pillar_axis",
  ];
  for (const state of statePriority) {
    if (blockStates[state] !== undefined) {
      stateName = state;
      if (state === "pillar_axis") {
        // Determine pillar_axis based on face
        if (["North", "South"].includes(face)) {
          stateValue = "z";
        } else if (["East", "West"].includes(face)) {
          stateValue = "x";
        } else {
          stateValue = "y";
        }
      } else if (state === "minecraft:cardinal_direction") {
        // Calculate direction based on player's rotation
        const rotation = player.getRotation();
        const rad = (rotation.y * Math.PI) / 180;
        const directionX = -Math.sin(rad);
        const directionZ = Math.cos(rad);

        // Determine cardinal direction based on calculated direction
        if (Math.abs(directionX) > Math.abs(directionZ)) {
          stateValue = directionX > 0 ? "east" : "west";
        } else {
          stateValue = directionZ > 0 ? "south" : "north";
        }
      } else if (state === "minecraft:block_face") {
        // Determine block_face based on face
        stateValue = face.toLowerCase();
      } else {
        stateValue = blockStates[state];
      }
      break;
    }
  }

  return { stateName, stateValue };
}

function generateStructureName(blockTypeId, verticalHalf) {
  // Remove the namespace and quotation marks, and keep the full name of the block
  const blockNamePart = blockTypeId.replace(/^wiki:/, "");

  // Construct the structure name
  const structureName =
    verticalHalf === "bottom"
      ? `bottomSlab_${blockNamePart}`
      : `topSlab_${blockNamePart}`;

  return structureName;
}