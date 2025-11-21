<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { GridLayout } from 'grid-layout-plus'
import { useWidgetStore } from '@/stores/widgetStore'
import BaseWidget from '@/components/BaseWidget.vue'
import { WIDGET_TYPES, type Widget } from '@/types/widgets'

const widgetStore = useWidgetStore()

onMounted(() => {
  widgetStore.loadFromLocalStorage()
})

// GridLayout works directly with widgets array
const layout = computed({
  get: () => widgetStore.widgets,
  set: (newLayout: Widget[]) => {
    widgetStore.updateLayout(newLayout)
  }
})

function getWidgetComponent(type: string) {
  const components: Record<string, unknown> = {
    base: BaseWidget
  }
  return components[type] || BaseWidget
}

function handleAddWidget() {
  widgetStore.addWidget(WIDGET_TYPES.BASE, { x: 0, y: 0 } )
}
</script>

<template>
  <div class="dashboard-grid-container">
    <div class="dashboard-toolbar">
      <h2 class="text-lg font-semibold">Dashboard</h2>
      <div class="flex gap-2">
        <button @click="handleAddWidget" class="toolbar-btn">
          + Base
        </button>
      </div>
    </div>

    <div class="grid-wrapper">
      <GridLayout
        v-model:layout="layout"
        :col-num="12"
        :row-height="30"
        :is-draggable="true"
        :is-resizable="true"
        :is-bounded="true"
        :responsive="true"
        :margin="[10, 10]"
        :use-css-transforms="true"
        :vertical-compact="false"
        :prevent-collision="true"
      >
        <template #item="{ item }">
          <component
            :is="getWidgetComponent(widgetStore.getWidgetById(item.i)?.type || 'base')"
            :widget-id="item.i"
          />
        </template>
      </GridLayout>
    </div>
  </div>
</template>

<style scoped>
.dashboard-grid-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 20px;
}

.dashboard-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.toolbar-btn {
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
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

:deep(.vue-grid-placeholder) {
  background: rgba(59, 130, 246, 0.2) !important;
  border: 2px dashed var(--color-accent) !important;
  border-radius: 8px;
  transition: all 200ms ease;
  z-index: 1 !important;
  pointer-events: none !important;
}

:deep(.vue-grid-item:not(.vue-grid-placeholder)) {
  z-index: 2;
}
</style>
