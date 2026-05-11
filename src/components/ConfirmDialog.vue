<script lang="ts" setup>
import { watch} from 'vue'

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel'
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}>()

function handleConfirm() {
  emit('confirm')
  emit('close')
}

function handleCancel() {
  emit('cancel')
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleCancel()
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
})

</script>

<template>
  <Transition name="fade">
    <div v-if="props.show" class="confirm-dialog" @click.self="handleCancel">
      <div class="confirm-dialog-content">
        <h3>{{ props.title }}</h3>
        <p>{{ props.message }}</p>
        <button @click="handleConfirm" class="confirm-button-danger">{{ props.confirmText }}</button>
        <button @click="handleCancel">{{ props.cancelText }}</button>
      </div>
    </div>
  </Transition>
</template>


<style scoped>
.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--color-border);
}

.confirm-dialog-content {
  background: var(--color-panel);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 10px 20px var(--color-hover);
}
.confirm-dialog-content h3 {
  color: var(--color-text);
}

.confirm-dialog-content p {
  margin: 10px 0;
  color: var(--color-text);
}

.confirm-dialog-content button {
  margin: 5px;
  padding: 6px 16px;
  border: var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  background-color: var(--color-muted);
  font-weight: 700;
}

.confirm-dialog-content button:hover {
  background-color: var(--color-accent);
}

.confirm-button-danger {
  color: var(--color-danger);
}

</style>
