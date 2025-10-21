import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { useWidgetStore } from '@/stores/widgetStore'
import type { Widget, WidgetConfig } from '@/types/widgets'

/**
 * Composable for shared widget functionality
 * This provides reusable logic that any widget can use
 */
export function useWidget(widgetId: string) {
  const store = useWidgetStore()
  const isEditing = ref(false)
  const isLoading = ref(false)

  // Get the current widget from store
  const widget: ComputedRef<Widget | undefined> = computed(() => store.getWidgetById(widgetId))

  // Common widget actions
  const updateConfig = (newConfig: Partial<WidgetConfig>): void => {
    store.updateWidgetConfig(widgetId, newConfig)
  }

  const updateTitle = (newTitle: string): void => {
    store.updateWidget(widgetId, { title: newTitle } as Partial<Widget>)
  }

  const removeWidget = (): void => {
    store.removeWidget(widgetId)
  }

  const toggleEdit = (): void => {
    isEditing.value = !isEditing.value
  }

  const refresh = async (): Promise<void> => {
    isLoading.value = true
    try {
      // Widgets can override this with their own refresh logic
      await new Promise(resolve => setTimeout(resolve, 500))
    } finally {
      isLoading.value = false
    }
  }

  return {
    widget,
    isEditing,
    isLoading,
    updateConfig,
    updateTitle,
    removeWidget,
    toggleEdit,
    refresh,
  }
}

// Return type for useWidget
export interface UseWidgetReturn {
  widget: ComputedRef<Widget | undefined>
  isEditing: Ref<boolean>
  isLoading: Ref<boolean>
  updateConfig: (newConfig: Partial<WidgetConfig>) => void
  updateTitle: (newTitle: string) => void
  removeWidget: () => void
  toggleEdit: () => void
  refresh: () => Promise<void>
}
