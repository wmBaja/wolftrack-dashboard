<!-- src/components/widgets/BaseWidget.vue -->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useWidget } from '@/composables/useWidget'
import type { Widget } from '@/types/widgets'

interface Props {
  widgetId: string
  icon?: string
  showRefresh?: boolean
  showSettings?: boolean
  showRemove?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: '📦',
  showRefresh: true,
  showSettings: true,
  showRemove: true,
  title: 'Widget'
})

interface Emits {
  (e: 'refresh'): void
  (e: 'remove'): void
  (e: 'settings'): void
  (e: 'title-change', title: string): void
}

const emit = defineEmits<Emits>()

// Use the widget composable for common functionality
const {
  widget,
  isEditing,
  isLoading,
  updateTitle,
  removeWidget,
  toggleEdit,
  refresh
} = useWidget(props.widgetId)

// Local title state
const localTitle = ref('')
const titleInputRef = ref<HTMLInputElement>()

// Initialize title
watch(() => widget.value, (newWidget: Widget | undefined) => {
  if (newWidget?.title) {
    localTitle.value = newWidget.title
  } else {
    localTitle.value = props.title
  }
}, { immediate: true })

// Widget type display name
const widgetType = computed(() => {
  return widget.value?.type || 'unknown'
})

// Handle title editing
function startEditTitle() {
  toggleEdit()
  // Focus input after Vue updates DOM
  setTimeout(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  }, 50)
}

function saveTitle() {
  const trimmedTitle = localTitle.value.trim()
  if (trimmedTitle && trimmedTitle !== widget.value?.title) {
    updateTitle(trimmedTitle)
    emit('title-change', trimmedTitle)
  } else if (!trimmedTitle && widget.value?.title) {
    // Revert to original if empty
    localTitle.value = widget.value.title
  }
  isEditing.value = false
}

function cancelEdit() {
  if (widget.value?.title) {
    localTitle.value = widget.value.title
  }
  isEditing.value = false
}

// Handle actions
async function handleRefresh() {
  emit('refresh')
  await refresh()
}

function handleSettings() {
  emit('settings')
  toggleEdit()
}

function handleRemove() {
  const confirmMessage = `Remove "${localTitle.value}"?`
  if (confirm(confirmMessage)) {
    emit('remove')
    removeWidget()
  }
}
</script>

<template>
  <div
    class="base-widget"
    :class="{
      'base-widget--editing': isEditing,
      'base-widget--loading': isLoading
    }"
  >
 <!-- Widget Header -->
    <header class="base-widget__header">
      <div class="base-widget__title-section">
        <span class="base-widget__icon" role="img" :aria-label="widgetType">
          {{ icon }}
        </span>

        <input
          v-if="isEditing"
          ref="titleInputRef"
          v-model="localTitle"
          @blur="saveTitle"
          @keyup.enter="saveTitle"
          @keyup.escape="cancelEdit"
          class="base-widget__title-input"
          placeholder="Widget title..."
          maxlength="50"
        />

        <h3
          v-else
          class="base-widget__title"
          @dblclick="startEditTitle"
          :title="localTitle"
        >
          {{ localTitle }}
        </h3>
      </div>

      <div class="base-widget__actions">
        <button
          v-if="showRefresh"
          @click="handleRefresh"
          class="base-widget__action-btn"
          :disabled="isLoading"
          :aria-label="isLoading ? 'Refreshing...' : 'Refresh widget'"
          title="Refresh"
        >
          <svg
            class="base-widget__icon-svg"
            :class="{ 'spinning': isLoading }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <button
          v-if="showSettings"
          @click="handleSettings"
          class="base-widget__action-btn"
          :class="{ 'base-widget__action-btn--active': isEditing }"
          aria-label="Widget settings"
          title="Settings"
        >
          <svg class="base-widget__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3" stroke-width="2"/>
            <path d="M12 1v6m0 6v10M1 12h6m6 0h10" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <button
          v-if="showRemove"
          @click="handleRemove"
          class="base-widget__action-btn base-widget__action-btn--danger"
          aria-label="Remove widget"
          title="Remove"
        >
          <svg class="base-widget__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Widget Content -->
    <main class="base-widget__content">
      <slot
        :is-editing="isEditing"
        :is-loading="isLoading"
        :config="widget?.config"
        :widget="widget"
      />
    </main>

    <!-- Loading Overlay -->
    <Transition name="fade">
      <div v-if="isLoading" class="base-widget__loading-overlay">
        <div class="base-widget__spinner" role="status" aria-label="Loading...">
          <span class="sr-only">Loading...</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.base-widget {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.base-widget:hover {
  border-color: var(--color-accent);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.base-widget--editing {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.base-widget--loading {
  pointer-events: none;
}

/* Header */
.base-widget__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  flex-shrink: 0;
  min-height: 52px;
}

.base-widget__title-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.base-widget__icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
  filter: grayscale(0.3);
}

.base-widget__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: color 0.2s;
}

.base-widget__title:hover {
  color: var(--color-accent);
}

.base-widget__title-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  background: var(--color-panel);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.base-widget__title-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* Actions */
.base-widget__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.base-widget__action-btn {
  background: transparent;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  transition: all 0.2s;
  padding: 0;
}

.base-widget__action-btn:hover {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-accent);
}

.base-widget__action-btn--active {
  background: rgba(59, 130, 246, 0.15);
  color: var(--color-accent);
}

.base-widget__action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.base-widget__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-widget__action-btn:disabled:hover {
  background: transparent;
  color: var(--color-muted);
}

.base-widget__icon-svg {
  width: 18px;
  height: 18px;
}

/* Content */
.base-widget__content {
  flex: 1;
  padding: 16px;
  overflow: auto;
  min-height: 0;
}

/* Loading */
.base-widget__loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 14, 26, 0.7);
  backdrop-filter: blur(2px);
  z-index: 10;
}

.base-widget__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Accessibility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Scrollbar styling */
.base-widget__content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.base-widget__content::-webkit-scrollbar-track {
  background: transparent;
}

.base-widget__content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

.base-widget__content::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted);
}
</style>
