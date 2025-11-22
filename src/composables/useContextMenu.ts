// src/composables/useContextMenu.ts
import { ref } from 'vue'

export function useContextMenu() {
  const show = ref(false)
  const x = ref(0)
  const y = ref(0)
  const data = ref<unknown>(null)

  function open(event: MouseEvent, contextData?: unknown) {
    event.preventDefault()
    x.value = event.clientX
    y.value = event.clientY
    data.value = contextData
    show.value = true
  }

  function close() {
    show.value = false
    data.value = null
  }

  return {
    show,
    x,
    y,
    data,
    open,
    close,
  }
}
