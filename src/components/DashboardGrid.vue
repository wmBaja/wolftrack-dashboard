<script setup lang="ts">
import { onMounted, ref, h, type Component, watch } from 'vue'
import { GridLayout } from 'grid-layout-plus'
import { useWidgetStore } from '@/stores/widgetStore'
import ContextMenu from '@imengyu/vue3-context-menu'
import BaseWidget from '@/components/widgets/BaseWidget.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ChartWidget from '@/components/widgets/ChartWidget.vue'
import { WIDGET_TYPES, type Widget } from '@/types/widgets'

const widgetStore = useWidgetStore()

interface WidgetExpose {
  handleRefresh: () => Promise<void>
  startEditTitle: () => void
  setLoading: (value: boolean) => void
}

const componentMap: Record<string, Component> = {
  [WIDGET_TYPES.BASE]: BaseWidget,
  [WIDGET_TYPES.CHART]: ChartWidget,
}

const widgetRefs = ref<Record<string, WidgetExpose>>({})
const showClearAllConfirm = ref(false)
const gridWrapperRef = ref<HTMLElement>()

onMounted(() => {
  widgetStore.loadFromLocalStorage()
})

watch(() => widgetStore.widgets.length, () => {
  const currentIds = new Set(widgetStore.widgets.map(w => w.i))
  Object.keys(widgetRefs.value).forEach(id => {
    if (!currentIds.has(id)) {
      delete widgetRefs.value[id]
    }
  })
})

function handleLayoutUpdate(newLayout: Widget[]) {
  widgetStore.updateLayout(newLayout)
}

function setWidgetRef(widgetId: string, el: WidgetExpose | null) {
  if (el) {
    widgetRefs.value[widgetId] = el
  }
}

// Convert mouse position to grid coordinates
function mouseToGridPosition(event: MouseEvent): { x: number; y: number } {
  if (!gridWrapperRef.value) return { x: 0, y: 0 }

  const gridRect = gridWrapperRef.value.getBoundingClientRect()
  const rowHeight = 30 // matches :row-height prop
  const margin = 5 // matches :margin prop
  const colNum = 16 // matches :col-num prop

  // Calculate relative position within the grid
  const relativeX = event.clientX - gridRect.left + gridWrapperRef.value.scrollLeft
  const relativeY = event.clientY - gridRect.top + gridWrapperRef.value.scrollTop

  // Calculate column width (accounting for margins)
  const totalMarginWidth = margin * (colNum - 1)
  const availableWidth = gridRect.width - totalMarginWidth
  const colWidth = availableWidth / colNum

  // Convert pixel position to grid coordinates
  const col = Math.floor(relativeX / (colWidth + margin))
  const row = Math.floor(relativeY / (rowHeight + margin))

  return {
    x: Math.max(0, Math.min(col, colNum - 1)),
    y: Math.max(0, row)
  }
}

function handleGridContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.vue-grid-item')) {
    return
  }

  event.preventDefault()

  const gridPos = mouseToGridPosition(event)

  ContextMenu.showContextMenu({
    x: event.x,
    y: event.y,
    theme: 'mac dark',
    zIndex: 1000,
    items: [
      {
        label: 'Add Base Widget',
        icon: h('span', '➕'),
        onClick: () => widgetStore.addWidget(WIDGET_TYPES.BASE, gridPos),
      },
      {
        label: 'Add Chart Widget',
        icon: h('span', '➕'),
        onClick: () => widgetStore.addWidget(WIDGET_TYPES.CHART, gridPos),
      },
      { divided: true },
      {
        label: 'Clear All Widgets',
        icon: h('span', '🗑️'),
        customClass: 'context-menu-danger',
        onClick: () => {
          showClearAllConfirm.value = true
        },
      },
    ],
  })
}
</script>

<template>
  <div class="dashboard-grid-container" @contextmenu="handleGridContextMenu">
    <div ref="gridWrapperRef" class="grid-wrapper custom-scrollbar">
      <GridLayout
        v-model:layout="widgetStore.widgets"
        :col-num="16"
        :row-height="30"
        :is-draggable="true"
        :is-resizable="true"
        :is-bounded="false"
        :responsive="true"
        :margin="[5, 5]"
        :use-css-transforms="true"
        :prevent-collision="false"
        :vertical-compact="false"
        @layout-updated="handleLayoutUpdate"
      >
        <template #item="{ item }">
          <component
            :is="componentMap[(item as Widget).type] || BaseWidget"
            :ref="(el: WidgetExpose | null) => setWidgetRef(String(item.i), el)"
            :widget-id="item.i"
            :data-widget-id="item.i"
          />
        </template>
      </GridLayout>
    </div>

    <ConfirmDialog
      :show="showClearAllConfirm"
      title="Delete All Widgets"
      message="Are you sure you want to delete all widgets?"
      confirm-text="Delete"
      cancel-text="Cancel"
      danger
      @confirm="widgetStore.clearAll()"
      @close="showClearAllConfirm = false"
    />
  </div>
</template>

<style scoped>
.dashboard-grid-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));
  padding: 5px;
}

.grid-wrapper {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

:deep(.vue-grid-item) {
  transition: all 200ms ease;
  pointer-events: auto;
}

:deep(.vue-grid-item.resizing) {
  opacity: 0.9;
  z-index: 100;
}

:deep(.vue-grid-item.dragging) {
  z-index: 100;
  opacity: 0.8;
}
</style>
