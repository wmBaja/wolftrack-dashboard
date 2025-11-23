<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseWidget from '@/components/widgets/BaseWidget.vue'
import type { MenuOptions } from '@imengyu/vue3-context-menu'

defineProps<{
  widgetId: string
}>()

const baseWidgetRef = ref<InstanceType<typeof BaseWidget>>()
const chartType = ref<'line' | 'bar' | 'pie'>('line')

async function loadChartData() {
  console.log('Fetching chart data...')
  await new Promise(resolve => setTimeout(resolve, 1000))
}

function changeChartType(type: 'line' | 'bar' | 'pie') {
  chartType.value = type
  console.log('Changed chart type to:', type)
}

function exportChart() {
  console.log('Exporting chart...')
}

// Custom menu items with submenu
const customMenuItems = computed<MenuOptions['items']>(() => [
  { divided: true },
  {
    label: 'Chart Type',
    icon: '📊',
    children: [
      {
        label: 'Line Chart',
        icon: chartType.value === 'line' ? '✓' : '',
        onClick: () => changeChartType('line'),
      },
      {
        label: 'Bar Chart',
        icon: chartType.value === 'bar' ? '✓' : '',
        onClick: () => changeChartType('bar'),
      },
      {
        label: 'Pie Chart',
        icon: chartType.value === 'pie' ? '✓' : '',
        onClick: () => changeChartType('pie'),
      },
    ],
  },
  {
    label: 'Export Chart',
    icon: '💾',
    onClick: exportChart,
  },
])

const handleRefresh = async () => {
  baseWidgetRef.value?.setLoading(true)
  try {
    await loadChartData()
  } finally {
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
    :custom-menu-items="customMenuItems"
  >
    <div class="chart-content">
      <p>{{ chartType.toUpperCase() }} Chart Visualization</p>
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
