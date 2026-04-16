<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, watch } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

const props = defineProps<{
  signals: string[]
  getData: () => uPlot.AlignedData
}>()

const chartContainer = ref<HTMLElement>()
const chart = shallowRef<uPlot>()

let resizeObserver: ResizeObserver | null = null
let animationFrameId: number | null = null
let lastDataLength = 0

const initChart = () => {
    if (!chartContainer.value) return
    const currentData = props.getData()

    const series: uPlot.Series[] = [
        {
            label: 'Time',
            value: (u, v) => {
                if (v == null) return "-"
                const t0 = u.data[0]?.[0] || 0
                return (v as number - t0).toFixed(3) + "s"
            }
        } // X axis
    ]
    props.signals.forEach((s, i) => {
        const colors = ['#e11d48', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7']
        const color = colors[i % colors.length]
        series.push({
            label: s,
            stroke: color,
            width: 1.5,
            spanGaps: true
        })
    })

    const options: uPlot.Options = {
        width: chartContainer.value.clientWidth,
        height: chartContainer.value.clientHeight,
        series,
        scales: { x: { time: false } },
        cursor: { drag: { x: true, y: true } },
        axes: [
            {
                stroke: '#cbd5e1',
                grid: { stroke: '#2d3342', width: 1 },
                values: (u, splits) => {
                    const t0 = u.data[0]?.[0] || 0
                    return splits.map(v => (v - t0).toFixed(1) + "s")
                }
            },
            {
                stroke: '#cbd5e1',
                grid: { stroke: '#2d3342', width: 1 }
            }
        ]
    }

    chart.value = new uPlot(options, currentData, chartContainer.value)

    const fixSize = () => {
        if (!chart.value || !chartContainer.value) return
        const legendEl = chartContainer.value.querySelector('.u-legend')
        const legendHeight = legendEl ? legendEl.getBoundingClientRect().height : 0
        chart.value.setSize({
            width: Math.max(10, chartContainer.value.clientWidth),
            height: Math.max(10, chartContainer.value.clientHeight - legendHeight)
        })
    }

    // Fix immediately after first render creates the legend
    fixSize()

    resizeObserver = new ResizeObserver(() => {
        fixSize()
    })
    resizeObserver.observe(chartContainer.value)

    // Polling loop to redraw graph with new data
    const loop = () => {
        if (chart.value) {
            const data = props.getData()
            // We can check if length of the first series has changed to avoid unnecessary redraws
            const currentLen = data[0]?.length || 0
            if (currentLen !== lastDataLength) {
                chart.value.setData(data)
                lastDataLength = currentLen
            }
        }
        animationFrameId = requestAnimationFrame(loop)
    }
    animationFrameId = requestAnimationFrame(loop)
}

onMounted(() => {
    initChart()
})

watch(() => props.signals, () => {
    if (chart.value) {
        chart.value.destroy()
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    lastDataLength = 0
    initChart()
}, { deep: true })

onBeforeUnmount(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    resizeObserver?.disconnect()
    chart.value?.destroy()
})
</script>

<template>
  <div ref="chartContainer" class="uplot-container"></div>
</template>

<style scoped>
.uplot-container {
  width: 100%;
  height: 100%;
  min-height: 150px;
}

:deep(.u-axis text) {
  fill: #a1a1aa !important;
}
:deep(.u-legend) {
  color: #e4e4e7;
}
:deep(.u-legend .u-series th),
:deep(.u-legend .u-series td) {
  padding: 2px 4px;
}
:deep(.u-legend .u-value) {
  color: #e4e4e7;
}
:deep(.u-legend .u-marker) {
  width: 12px !important;
  height: 12px !important;
  border-width: 6px !important;
  box-sizing: border-box !important;
}
</style>
