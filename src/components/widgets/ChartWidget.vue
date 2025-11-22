<script setup lang="ts">
import { ref } from 'vue'
import BaseWidget from '@/components/widgets/BaseWidget.vue'

defineProps<{
  widgetId: string
}>()

const baseWidgetRef = ref<InstanceType<typeof BaseWidget>>()

// Specific logic for this widget type
async function loadChartData() {
  console.log('Fetching chart data...')
  await new Promise(resolve => setTimeout(resolve, 1000))
}

// Expose the methods that DashboardGrid expects
// We forward these to the internal BaseWidget or handle them ourselves
const handleRefresh = async () => {
  // 1. Trigger loading state on shell
  baseWidgetRef.value?.setLoading(true)
  try {
    // 2. Do specific work
    await loadChartData()
  } finally {
    // 3. Stop loading state
    baseWidgetRef.value?.setLoading(false)
  }
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
    <!-- This content goes into the BaseWidget slot -->
    <div class="chart-content">
      <p>Chart Visualization Goes Here</p>
      <p>ID: {{ widgetId }}</p>
    </div>
  </BaseWidget>
</template>

<style scoped>
.chart-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f0f8ff;
  color: #333;
}
</style>
