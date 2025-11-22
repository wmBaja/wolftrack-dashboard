<script setup lang="ts">
import { onMounted, computed, ref, type Component } from 'vue'
import { GridLayout } from 'grid-layout-plus'
import { useWidgetStore } from '@/stores/widgetStore'
import { useContextMenu } from '@/composables/useContextMenu'
import BaseWidget from '@/components/widgets/BaseWidget.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ContextMenu.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ChartWidget from '@/components/widgets/ChartWidget.vue'
import { WIDGET_TYPES, type Widget } from '@/types/widgets'

const widgetStore = useWidgetStore()
const contextMenu = useContextMenu()

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

function handleWidgetContextMenu(event: MouseEvent, widgetId?: string) {
  event.stopPropagation()
  contextMenu.open(event, widgetId)
}

const menuItems = computed<ContextMenuItem[]>(() => {
  const widgetId = contextMenu.data.value

  if (widgetId) {
    const widget = widgetStore.getWidgetById(String(widgetId))

    return [
      {
        label: 'Edit Widget',
        icon: '✏️',
        action: () => {
          widgetRefs.value[String(widgetId)]?.startEditTitle()
        },
      },
      {
        label: 'Duplicate',
        icon: '📋',
        action: () => {
          if (widget) {
            widgetStore.addWidget(widget.type as WIDGET_TYPES, {
              x: widget.x + 1,
              y: widget.y + 1,
            })
          }
        },
      },
      {
        label: 'Refresh',
        icon: '🔄',
        action: () => {
          widgetRefs.value[String(widgetId)]?.handleRefresh()
        },
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        action: () => widgetStore.removeWidget(String(widgetId)),
      },
    ]
  }

  return [
    {
      label: 'Add Base Widget',
      icon: '➕',
      action: () => widgetStore.addWidget(WIDGET_TYPES.BASE, { x: 0, y: 0 }),
    },
    {
      label: 'Add Chart Widget',
      icon: '➕',
      action: () => widgetStore.addWidget(WIDGET_TYPES.CHART, { x: 0, y: 0 }),
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Clear All Widgets',
      icon: '🗑️',
      danger: true,
      action: () => {
        showClearAllConfirm.value = true
      },
    },
  ]
})
</script>

<template>
  <div class="dashboard-grid-container" @contextmenu="handleWidgetContextMenu($event)">
    <div class="grid-wrapper">
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
            @contextmenu="handleWidgetContextMenu($event, String(item.i))"
          />
        </template>
      </GridLayout>
    </div>

    <ContextMenu
      :show="contextMenu.show.value"
      :x="contextMenu.x.value"
      :y="contextMenu.y.value"
      :items="menuItems"
      @close="contextMenu.close"
    />

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
