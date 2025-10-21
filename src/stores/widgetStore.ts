import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createWidget, WIDGET_TYPES, type Widget, type WidgetLayout, type WidgetPosition, type WidgetConfig } from '@/types/widgets'

export const useWidgetStore = defineStore('widgets', () => {
  // State
  const widgets = ref<Widget[]>([])
  const layout = ref<WidgetLayout[]>([])

  // Getters
  const getWidgetById = computed(() => {
    return (id: string): Widget | undefined => {
      return widgets.value.find(w => w.i === id)
    }
  })

  const widgetCount = computed(() => widgets.value.length)

  // Actions
  function addWidget(type: WIDGET_TYPES, position: WidgetPosition): Widget {
    const newWidget = createWidget(type, position)
    widgets.value.push(newWidget)
    syncLayout()
    saveToLocalStorage()
    return newWidget
  }

  function removeWidget(id: string): void {
    const index = widgets.value.findIndex(w => w.i === id)
    if (index !== -1) {
      widgets.value.splice(index, 1)
      syncLayout()
      saveToLocalStorage()
    }
  }

  function updateWidget(id: string, updates: Partial<Widget>): void {
    const widget = widgets.value.find(w => w.i === id)
    if (widget) {
      Object.assign(widget, updates)
      syncLayout()
      saveToLocalStorage()
    }
  }

  function updateWidgetConfig(id: string, configUpdates: Partial<WidgetConfig>): void {
    const widget = widgets.value.find(w => w.i === id)
    if (widget) {
      widget.config = { ...widget.config, ...configUpdates }
      saveToLocalStorage()
    }
  }

  function updateLayout(newLayout: WidgetLayout[]): void {
    // Called by GridLayout when items are moved/resized
    newLayout.forEach(item => {
      const widget = widgets.value.find(w => w.i === item.i)
      if (widget) {
        widget.x = item.x
        widget.y = item.y
        widget.w = item.w
        widget.h = item.h
      }
    })
    syncLayout()
    saveToLocalStorage()
  }

  function syncLayout(): void {
    // Sync the layout array that GridLayout expects
    layout.value = widgets.value.map(w => ({
      i: w.i,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: w.minW,
      minH: w.minH,
      maxW: w.maxW,
      maxH: w.maxH,
      static: w.static,
    }))
  }

  function saveToLocalStorage(): void {
    try {
      localStorage.setItem('dashboard-widgets', JSON.stringify(widgets.value))
    } catch (error) {
      console.error('Failed to save widgets:', error)
    }
  }

  function loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('dashboard-widgets')
      if (saved) {
        const parsed = JSON.parse(saved) as Widget[]
        widgets.value = parsed
        syncLayout()
      } else {
        // Initialize with default widgets
        initializeDefaultWidgets()
      }
    } catch (error) {
      console.error('Failed to load widgets:', error)
      initializeDefaultWidgets()
    }
  }

  function initializeDefaultWidgets(): void {
    // Add some default widgets
    addWidget(WIDGET_TYPES.CHART, { x: 4, y: 0 })
  }

  function clearAll(): void {
    widgets.value = []
    layout.value = []
    saveToLocalStorage()
  }

  return {
    // State
    widgets,
    layout,

    // Getters
    getWidgetById,
    widgetCount,

    // Actions
    addWidget,
    removeWidget,
    updateWidget,
    updateWidgetConfig,
    updateLayout,
    loadFromLocalStorage,
    clearAll,
  }
})
