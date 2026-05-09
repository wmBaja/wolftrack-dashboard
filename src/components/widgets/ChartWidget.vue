<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseWidget from '@/components/widgets/BaseWidget.vue'
import UplotChart from '@/components/UplotChart.vue'
import { useWidgetStore } from '@/stores/widgetStore'
import { useLiveDataStore } from '@/stores/liveDataStore'
import type { AlignedData } from 'uplot'

const props = defineProps<{
  widgetId: string
}>()

const widgetStore = useWidgetStore()
const liveDataStore = useLiveDataStore()

const baseWidgetRef = ref<InstanceType<typeof BaseWidget>>()
const widget = computed(() => widgetStore.getWidgetById(props.widgetId))

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
  >
    <template #default>
      <div class="chart-content">
        <div v-if="!widget?.signals?.length" class="empty-state">
          <p>No signals configured.</p>
          <button @click="baseWidgetRef?.toggleConfig()" class="save-btn">Configure</button>
        </div>
        <UplotChart
          v-else
          :signals="widget?.signals || []"
          :get-data="getAlignedData"
          :update-version="liveDataStore.dataVersion"
          :time-origin="liveDataStore.sessionStartTimestamp"
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
