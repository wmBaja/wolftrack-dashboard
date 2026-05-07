<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDaqConnectionStore } from '@/stores/daqConnectionStore'
import DataSourcePanel from './DataSourcePanel.vue'
import FileManagerPanel from './FileManagerPanel.vue'

const fileManagerRef = ref<InstanceType<typeof FileManagerPanel> | null>(null)
const daqConnection = useDaqConnectionStore()

const loggingButtonLabel = computed(() => {
  return daqConnection.loggingActive ? 'Stop Logging' : 'Start Logging'
})

async function handleLoggingToggle() {
  await daqConnection.toggleLogging()
}
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

        <div class="flex items-center gap-3">
          <button
            id="daq-logging-toggle-btn"
            class="daq-logging-btn"
            :class="{ active: daqConnection.loggingActive }"
            :disabled="!daqConnection.canToggleLogging"
            @click="handleLoggingToggle"
          >
            {{ loggingButtonLabel }}
          </button>
          <DataSourcePanel />
        </div>

      </div>
    </div>
    <FileManagerPanel ref="fileManagerRef" />
  </nav>
</template>

<style scoped>
.daq-logging-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-blue-border);
  background: var(--color-blue-bg-glow);
  color: var(--color-blue-text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition: all 0.15s;
}

.daq-logging-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.22);
}

.daq-logging-btn.active {
  border-color: var(--color-danger-border);
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.daq-logging-btn.active:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.18);
}

.daq-logging-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
