import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createWidget, WIDGET_TYPES, type Widget } from '@/types/widgets'

export const useWidgetStore = defineStore('widgets', () => {
  // State - Only ONE source of truth
  const widgets = ref<Widget[]>([])

  // Getters
  function getWidgetById(id: string): Widget | undefined {
    return widgets.value.find(w => w.i === id)
  }

  const widgetCount = computed(() => widgets.value.length)

  // Actions
  function addWidget(type: WIDGET_TYPES, position: {x: number, y: number, w?: number, h?: number}): Widget {
    const newWidget = createWidget(type, position)
    widgets.value.push(newWidget)
    saveToLocalStorage()
    return newWidget
  }

  function removeWidget(id: string): void {
    const index = widgets.value.findIndex(w => w.i === id)
    if (index !== -1) {
      widgets.value.splice(index, 1)
      saveToLocalStorage()
    }
  }

  function updateWidget(id: string, updates: Partial<Widget>): void {
    const widget = widgets.value.find(w => w.i === id)
    if (widget) {
      Object.assign(widget, updates)
      saveToLocalStorage()
    }
  }

  function updateLayout(newLayout: Widget[]): void {
    // GridLayout passes back updated layout with new positions
    newLayout.forEach(item => {
      const widget = widgets.value.find(w => w.i === item.i)
      if (widget) {
        widget.x = item.x
        widget.y = item.y
        widget.w = item.w
        widget.h = item.h
      }
    })
    saveToLocalStorage()
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
        widgets.value = JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load widgets:', error)
    }
  }

  function clearAll(): void {
    widgets.value = []
    saveToLocalStorage()
  }

  return {
    widgets,

    getWidgetById,
    widgetCount,

    addWidget,
    removeWidget,
    updateWidget,
    updateLayout,
    loadFromLocalStorage,
    clearAll
  }
})
