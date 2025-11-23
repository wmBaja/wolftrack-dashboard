import { ref } from 'vue'
import type { ContextMenuItem } from '@/components/ContextMenu.vue'

const show = ref(false)
const x = ref(0)
const y = ref(0)
const items = ref<ContextMenuItem[]>([])

export function useContextMenu() {
  function open(event: MouseEvent, menuItems: ContextMenuItem[]) {
    event.preventDefault()
    event.stopPropagation()
    x.value = event.clientX
    y.value = event.clientY
    items.value = menuItems
    show.value = true
  }

  function close() {
    show.value = false
    items.value = []
  }

  return {
    show,
    x,
    y,
    items,
    open,
    close,
  }
}
