<template>
  <div class="bg-white/20 p-2 flex items-center text-white rounded-lg backdrop-blur-md gap-3 ">
    <div class="hover:bg-white/30 rounded-lg p-1 cursor-pointer transition-all" @click="setActiveMode('TRANSLATE')" 
    :class="{
      'bg-white/30': activeMode == 'TRANSLATE',
    }">
      <Icon name="ph:corners-out" class="h-6 w-6"></Icon>
    </div>
    <div class="hover:bg-white/30 rounded-lg p-1 cursor-pointer transition-all" @click="setActiveMode('PLACEHOLDER')"
    :class="{
      'bg-white/30': activeMode == 'PLACEHOLDER',
    }">
      <Icon name="ph:placeholder" class="h-6 w-6"></Icon>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { Options, activeMode } from "~/core/store";

function setActiveMode(mode: Options) {
  activeMode.value = mode;
}
</script>
