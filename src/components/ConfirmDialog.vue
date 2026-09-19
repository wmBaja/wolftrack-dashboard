<script lang="ts" setup>
import { watch} from 'vue'

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  danger: false,
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
    <div
      v-if="props.show"
      class="confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      @click.self="handleCancel"
    >
      <section class="confirm-dialog-content">
        <p class="confirm-dialog-eyebrow">{{ props.danger ? 'Destructive action' : 'Confirmation required' }}</p>
        <h2 id="confirm-dialog-title">{{ props.title }}</h2>
        <p id="confirm-dialog-message" class="confirm-dialog-message">{{ props.message }}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-cancel" @click="handleCancel">{{ props.cancelText }}</button>
          <button type="button" class="confirm-dialog-confirm" :class="{ 'is-danger': props.danger }" @click="handleConfirm">{{ props.confirmText }}</button>
        </div>
      </section>
    </div>
  </Transition>
</template>


<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(5 10 18 / 72%);
}

.confirm-dialog-content {
  width: min(420px, 100%);
  border: 1px solid var(--color-border);
  background: var(--color-panel);
  padding: 28px;
  border-radius: 14px;
  box-shadow: 0 20px 48px rgb(0 0 0 / 35%);
}

.confirm-dialog-eyebrow {
  margin: 0 0 8px;
  color: var(--color-danger);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.confirm-dialog-content h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 22px;
}

.confirm-dialog-message {
  margin: 12px 0 0;
  color: var(--color-text);
  line-height: 1.5;
}

.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.confirm-dialog-actions button {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  cursor: pointer;
  font-weight: 700;
  padding: 9px 14px;
}

.confirm-dialog-cancel {
  background: transparent;
  color: var(--color-text);
}

.confirm-dialog-confirm {
  background: var(--color-accent);
  color: var(--color-text);
}

.confirm-dialog-confirm.is-danger {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger-text);
}

.confirm-dialog-actions button:hover {
  filter: brightness(1.15);
}

.confirm-dialog-actions button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

</style>
