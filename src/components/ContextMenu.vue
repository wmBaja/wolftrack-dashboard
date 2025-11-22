<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'

export interface ContextMenuItem {
  label: string
  icon?: string
  action: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

interface Props {
  show: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement>()

watch(() => props.show, (show) => {
  if (show) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleKeyDown)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

function handleItemClick(item: ContextMenuItem) {
  if (item.disabled) return
  item.action()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="menuRef"
      class="context-menu"
      :style="{ top: `${y}px`, left: `${x}px` }"
      @click.stop
    >
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item.divider" class="context-menu-divider"></div>
        <button
          v-else
          class="context-menu-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          :disabled="item.disabled"
          @click="handleItemClick(item)"
        >
          <span v-if="item.icon" class="icon">{{ item.icon }}</span>
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px;
  min-width: 180px;
  animation: fadeIn 0.1s ease-out;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover:not(.disabled) {
  background: var(--color-hover);
}

.context-menu-item.danger {
  color: var(--color-danger);
}

.context-menu-item.danger:hover:not(.disabled) {
  background: rgba(239, 68, 68, 0.1);
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-item .icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.context-menu-divider {
  height: 1px;
  background: var(--color-border)
}
</style>
