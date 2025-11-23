<script setup lang="ts">
import { onMounted, computed, ref, h, type Component } from 'vue'
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

onMounted(() => {
  widgetStore.loadFromLocalStorage()
})

const layout = computed({
  get: () => widgetStore.widgets,
  set: (newLayout: Widget[]) => widgetStore.updateLayout(newLayout)
})

function handleGridContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.vue-grid-item')) {
    return
  }

  event.preventDefault()

  ContextMenu.showContextMenu({
    x: event.x,
    y: event.y,
    theme: 'mac dark',
    zIndex: 1000,
    items: [
      {
        label: 'Add Base Widget',
        icon: h('span', '➕'),
        onClick: () => widgetStore.addWidget(WIDGET_TYPES.BASE, { x: 0, y: 0 }),
      },
      {
        label: 'Add Chart Widget',
        icon: h('span', '➕'),
        onClick: () => widgetStore.addWidget(WIDGET_TYPES.CHART, { x: 0, y: 0 }),
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
    <div class="grid-wrapper custom-scrollbar">
      <GridLayout
        v-model:layout="layout"
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
      >
        <template #item="{ item }">
          <component
            :is="componentMap[(item as Widget).type] || BaseWidget"
            :ref="(el: any) => widgetRefs[item.i] = el"
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
