<script setup lang="ts">
import { ref } from 'vue'
import DataSourcePanel from './DataSourcePanel.vue'

const showPanel = ref(false)
</script>

<template>
  <nav class="bg-[var(--color-panel)] border-b border-[var(--color-border)] h-[var(--navbar-height)]">
    <div class="mx-auto px-4">
      <div class="flex items-center justify-between h-14">

        <!-- Logo -->
        <img src="@/assets/images/bajaLogo-dark.png" alt="Pack Motorsports Baja SAE Logo" class="min-w h-full py-1" />

        <!-- Connection control (right side) -->
        <div class="flex items-center gap-3">
          <DataSourcePanel v-model:isOpen="showPanel" />
        </div>

      </div>
    </div>
  </nav>
</template>
