<script setup lang="ts">
import { ref, computed, h } from 'vue'
import BaseWidget from '@/components/widgets/BaseWidget.vue'
import UplotChart from '@/components/UplotChart.vue'
import { useWidgetStore } from '@/stores/widgetStore'
import { useDbcStore } from '@/stores/dbcStore'
import { useLiveDataStore } from '@/stores/liveDataStore'
import type { MenuOptions } from '@imengyu/vue3-context-menu'
import type { AlignedData } from 'uplot'

const props = defineProps<{
  widgetId: string
}>()

const widgetStore = useWidgetStore()
const dbcStore = useDbcStore()
const liveDataStore = useLiveDataStore()

const baseWidgetRef = ref<InstanceType<typeof BaseWidget>>()
const widget = computed(() => widgetStore.getWidgetById(props.widgetId))

const isConfiguring = ref(false)
const localSignals = ref<string[]>([...(widget.value?.signals || [])])

function toggleConfig() {
  isConfiguring.value = !isConfiguring.value
  if (!isConfiguring.value) {
    widgetStore.updateWidget(props.widgetId, { signals: [...localSignals.value] })
  } else {
    localSignals.value = [...(widget.value?.signals || [])]
  }
}

function removeSignal(sig: string) {
  localSignals.value = localSignals.value.filter(s => s !== sig)
}

function addSignal(event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value && !localSignals.value.includes(select.value)) {
    localSignals.value.push(select.value)
  }
  select.value = ''
}

const customMenuItems = computed<MenuOptions['items']>(() => [
  { divided: true },
  {
    label: isConfiguring.value ? 'Close Config' : 'Configure Signals',
    icon: h('span', '⚙️'),
    onClick: toggleConfig,
  }
])

function getAlignedData(): AlignedData {
  const signalsToPlot = widget.value?.signals || []
  if (signalsToPlot.length === 0) return [[]]

  // If there's only 1 signal, no need to align, just return it directly
  if (signalsToPlot.length === 1) {
    const firstSig = signalsToPlot[0]
    if (!firstSig) return [[]]
    const sigData = liveDataStore.buffers[firstSig]
    if (!sigData || sigData.timestamps.length === 0) return [[], []]
    return [sigData.timestamps, sigData.values]
  }

  // Multi-signal alignment: Collect all unique timestamps sorted
  const allTimestamps = new Set<number>()
  signalsToPlot.forEach(sig => {
    const sigData = liveDataStore.buffers[sig]
    if (sigData) {
      sigData.timestamps.forEach(t => allTimestamps.add(t))
    }
  })

  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b)

  const aligned: (number | null)[][] = [sortedTimestamps]

  signalsToPlot.forEach(sig => {
    const sigData = liveDataStore.buffers[sig]
    const values = new Array(sortedTimestamps.length).fill(null)

    if (sigData && sigData.timestamps.length > 0) {
      let ptr = 0
      for (let i = 0; i < sortedTimestamps.length; i++) {
        const targetTime = sortedTimestamps[i]
        if (targetTime === undefined) continue

        while (ptr < sigData.timestamps.length - 1) {
          const nextTime = sigData.timestamps[ptr + 1]
          if (nextTime !== undefined && nextTime <= targetTime) {
            ptr++
          } else {
            break
          }
        }

        const currTime = sigData.timestamps[ptr]
        if (currTime === targetTime) {
            values[i] = sigData.values[ptr]
        }
      }
    }
    aligned.push(values)
  })

  return aligned as AlignedData
}

const handleRefresh = async () => {
  liveDataStore.clearBuffers()
}

const startEditTitle = () => {
  baseWidgetRef.value?.startEditTitle()
}

defineExpose({ handleRefresh, startEditTitle })
</script>

<template>
  <BaseWidget
    ref="baseWidgetRef"
    :widget-id="widgetId"
    icon="📈"
    :custom-menu-items="customMenuItems"
  >
    <template #default>
      <div v-if="isConfiguring" class="config-panel">
        <h4>Signals Config</h4>
        <div class="signal-list">
          <div v-for="sig in localSignals" :key="sig" class="signal-tag">
            {{ sig }}
            <button @click="removeSignal(sig)">×</button>
          </div>
        </div>
        <select @change="addSignal" class="signal-select">
          <option value="">-- Add Signal --</option>
          <option v-for="sig in dbcStore.signals" :key="sig.id" :value="sig.id">
            {{ sig.message }} :: {{ sig.name }}
          </option>
        </select>
        <button class="save-btn" @click="toggleConfig">Done</button>
      </div>
      <div v-else class="chart-content">
        <div v-if="!widget?.signals?.length" class="empty-state">
          <p>No signals configured.</p>
          <button @click="toggleConfig" class="save-btn">Configure</button>
        </div>
        <UplotChart
          v-else
          :signals="widget?.signals || []"
          :get-data="getAlignedData"
        />
      </div>
    </template>
  </BaseWidget>
</template>

<style scoped>
.chart-content {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  gap: 10px;
}

.config-panel {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
}

.signal-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.signal-tag {
  background: var(--color-accent);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.signal-tag button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.signal-select {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-panel);
  color: var(--color-text);
  width: 100%;
}

.save-btn {
  margin-top: 10px;
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.save-btn:hover {
  opacity: 0.9;
}
</style>
