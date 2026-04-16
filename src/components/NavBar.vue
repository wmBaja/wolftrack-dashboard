<script setup lang="ts">
import DataSourcePanel from './DataSourcePanel.vue'
</script>

<template>
  <nav class="bg-[var(--color-panel)] border-b border-[var(--color-border)] h-[var(--navbar-height)]">
    <div class="mx-auto px-4">
      <div class="flex items-center justify-between h-14">

        <img src="@/assets/images/bajaLogo-dark.png" alt="Pack Motorsports Baja SAE Logo" class="min-w h-full py-1" />

        <DataSourcePanel />

      </div>
    </div>
  </nav>
</template>
