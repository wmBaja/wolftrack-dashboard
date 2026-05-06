<script setup lang="ts">
import { ref } from 'vue'
import DataSourcePanel from './DataSourcePanel.vue'
import FileManagerPanel from './FileManagerPanel.vue'

const fileManagerRef = ref<InstanceType<typeof FileManagerPanel> | null>(null)
</script>

<template>
  <nav class="bg-[var(--color-panel)] border-b border-[var(--color-border)] h-[var(--navbar-height)]">
    <div class="mx-auto px-4">
      <div class="flex items-center justify-between h-14">

        <div class="flex items-center gap-4 h-full">
          <button @click="fileManagerRef?.togglePanel()" class="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors rounded-md hover:bg-[var(--color-hover)]" aria-label="Toggle File Manager">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="@/assets/images/bajaLogo-dark.png" alt="Pack Motorsports Baja SAE Logo" class="min-w h-full py-1" />
        </div>

        <DataSourcePanel />

      </div>
    </div>
    <FileManagerPanel ref="fileManagerRef" />
  </nav>
</template>
