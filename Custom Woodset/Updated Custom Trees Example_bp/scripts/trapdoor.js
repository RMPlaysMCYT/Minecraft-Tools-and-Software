// Import necessary modules from Minecraft server API
import { world, BlockPermutation, ItemStack } from '@minecraft/server';
import { trapSet } from './main';

// Subscribe to the 'worldInitialize' event to register custom components
world.beforeEvents.worldInitialize.subscribe(eventData => {
    // Register a custom component named wiki:on_interact for trapdoor interaction
    eventData.blockComponentRegistry.registerCustomComponent('wiki:TD_interact', {
        // Define the behavior when a player interacts with the trapdoor block
        onPlayerInteract(e) {
            // Destructure event data for easier access
            const { block, player } = e;

            // Get the equipment component for the player
            const equipment = player.getComponent('equippable');

            // Get the selected item from the player's mainhand
            const selectedItem = equipment.getEquipment('Mainhand');

            // Get the current state of the 'wiki:open' block trait
            const currentState = block.permutation.getState('wiki:open');

            // Determine the new state of the 'wiki:open' block trait (toggle between true and false)
            const newOpenState = !currentState;

            // Resolve the new block permutation based on the current block type and updated states
            const newPermutation = BlockPermutation.resolve(block.typeId, {
                ...block.permutation.getAllStates(),
                'wiki:open': newOpenState
            });

            // Set the block permutation to the newly resolved permutation
            block.setPermutation(newPermutation);

            // Determine the sound effect to play based on the current state of the trapdoor
            const sound = currentState ? 'open.wooden_trapdoor' : 'close.wooden_trapdoor';

            // Play the corresponding sound effect for opening or closing the trapdoor
            player.playSound(sound);

            // Check if the current dimension is not the Nether
        if (e.dimension.id !== "minecraft:nether") {
            // Check if the selected item is a water bucket
            if (selectedItem?.typeId === 'minecraft:water_bucket') {
                // Play sound effect
                player.playSound( "bucket.empty_water" );
                // If not in creative mode, replace water bucket with empty bucket
                if (player.getGameMode() !== "creative") {
                    equipment.setEquipment('Mainhand', new ItemStack('minecraft:bucket', 1));
                }
            }
            // Check if the block interacted is a wiki:trapdoor and the player is using a water bucket
            if (selectedItem?.typeId === 'minecraft:water_bucket') {
                // Save the current block states
                const currentStates = block.permutation.getAllStates();

                const verticalHalf = block.permutation.getState(
                    "minecraft:vertical_half"
                  );
                const structureName = generateStructureName(block.typeId, verticalHalf);

                // Place the structure
                const { x, y, z } = block.location;
                world.structureManager.place(structureName, e.dimension, { x, y, z });

                // Get the new block at the same location
                const newBlock = e.dimension.getBlock({ x, y, z });

                // Reapply the old block states to the new block
                const newStates = { ...newBlock.permutation.getAllStates(), ...currentStates };
                const newPermutation = BlockPermutation.resolve(newBlock.typeId, newStates);
                newBlock.setPermutation(newPermutation);
            }
            // Check if the selected item is a empty bucket and handle un-waterlogging
            else if ( selectedItem?.typeId === "minecraft:bucket" ) {

                if (block.permutation.getState("wiki:waterlogged") ) {
        
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
            }
        } else if (trapSet.has(block.typeId) && selectedItem?.typeId === 'minecraft:water_bucket') {
                e.dimension.spawnParticle("minecraft:water_evaporation_bucket_emitter", block.center());
                player.playSound( "bucket.empty_water" );
                player.playSound("random.fizz", { pitch: 1.0, volume: 1.0 });
                // If not in creative mode, replace water bucket with empty bucket
                if (player.getGameMode() !== "creative") {
                  equipment.setEquipment( "Mainhand", new ItemStack("minecraft:bucket", 1) );
                }
              }
        }
    });
});

function generateStructureName(blockTypeId, verticalHalf) {
    // Remove the namespace and quotation marks, and keep the full name of the block
    const blockNamePart = blockTypeId.replace(/^wiki:/, "");
  
    // Construct the structure name
    const structureName =
      verticalHalf === "bottom"
        ? `bottom_${blockNamePart}`
        : `top_${blockNamePart}`;
  
    return structureName;
  }