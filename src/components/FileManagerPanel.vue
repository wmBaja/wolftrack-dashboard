<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDbcStore } from '@/stores/dbcStore'

const dbcStore = useDbcStore()

const isOpen = ref(false)
const activeTab = ref<'logs' | 'dbc'>('dbc')

function openPanel() {
  isOpen.value = true
  dbcStore.fetchDbcs()
}

// DBC Tab logic
function handleDbcUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    dbcStore.uploadDbc(file)
  }
}

function selectDbc(filename: string) {
  dbcStore.selectDbc(filename)
}

function deleteDbc(filename: string) {
  dbcStore.deleteDbc(filename)
}

defineExpose({ openPanel })

onMounted(() => {
  dbcStore.fetchDbcs()
  dbcStore.fetchSignals()
})
</script>

<template>
  <Transition name="slide-right">
    <div v-if="isOpen" class="file-manager-drawer">
      <!-- Header -->
      <div class="drawer-header">
        <h2 class="drawer-title">File Manager</h2>
        <button class="close-btn" @click="isOpen = false" aria-label="Close">✕</button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'logs' }"
          @click="activeTab = 'logs'"
        >
          Logs
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'dbc' }"
          @click="activeTab = 'dbc'"
        >
          DBC
        </button>
      </div>

      <!-- Content -->
      <div class="drawer-content">
        <!-- Logs Tab -->
        <div v-if="activeTab === 'logs'" class="tab-pane">
          <div class="empty-state">
            <p>Log downloading from wolftrack-logger will be implemented here.</p>
          </div>
        </div>

        <!-- DBC Tab -->
        <div v-if="activeTab === 'dbc'" class="tab-pane">
          <div class="upload-section">
            <label class="upload-btn">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z" clip-rule="evenodd" />
              </svg>
              Upload DBC
              <input type="file" accept=".dbc" @change="handleDbcUpload" hidden />
            </label>
          </div>

          <div v-if="dbcStore.error" class="error-msg">{{ dbcStore.error }}</div>

          <div class="file-list">
            <div v-if="dbcStore.availableDbcs.length === 0" class="empty-state">
              <p>No DBC files uploaded yet.</p>
            </div>
            <div
              v-for="filename in dbcStore.availableDbcs"
              :key="filename"
              class="file-item"
              :class="{ 'is-active': dbcStore.activeDbc === filename }"
            >
              <div class="file-info" @click="selectDbc(filename)">
                <span class="status-indicator"></span>
                <span class="filename">{{ filename }}</span>
              </div>
              <button class="delete-btn" @click.stop="deleteDbc(filename)" title="Delete">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition name="fade">
    <div v-if="isOpen" class="backdrop" @click="isOpen = false"></div>
  </Transition>
</template>

<style scoped>
.file-manager-drawer {
  position: fixed;
  top: var(--navbar-height);
  left: 0;
  bottom: 0;
  width: 320px;
  background: var(--color-panel);
  border-right: 1px solid var(--color-border);
  z-index: 60;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.drawer-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}
.close-btn:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

.tabs {
  display: flex;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  background: rgba(0, 0, 0, 0.1);
}

.tab-btn {
  flex: 1;
  padding: 12px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover {
  color: var(--color-text);
}
.tab-btn.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.upload-section {
  margin-bottom: 20px;
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  background: var(--color-accent);
  color: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.upload-btn:hover {
  background: #2563eb;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.file-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.file-item.is-active {
  background: var(--color-blue-bg-glow);
  border-color: var(--color-blue-border);
}
.file-item.is-active .status-indicator {
  background: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}
.file-item.is-active .filename {
  color: var(--color-blue-text);
  font-weight: 500;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  overflow: hidden;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-muted);
  flex-shrink: 0;
  transition: all 0.3s;
}

.filename {
  font-size: 13px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-muted);
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
}
.file-item:hover .delete-btn {
  opacity: 1;
}
.delete-btn:hover {
  color: var(--color-danger-text);
  background: rgba(239, 68, 68, 0.1);
}

.empty-state {
  text-align: center;
  color: var(--color-muted);
  font-size: 13px;
  padding: 20px 0;
}

.error-msg {
  color: var(--color-danger-text);
  font-size: 12px;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--color-danger-bg);
  border-radius: 6px;
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 50;
  top: var(--navbar-height);
}

/* Transitions */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
