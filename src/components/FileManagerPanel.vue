<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDbcStore } from '@/stores/dbcStore'
import { useLogStore } from '@/stores/logStore'
import { useDaqConnectionStore } from '@/stores/daqConnectionStore'

const dbcStore = useDbcStore()
const logStore = useLogStore()
const daqConnection = useDaqConnectionStore()

const isOpen = ref(false)
const activeTab = ref<'logs' | 'dbc'>('dbc')

function togglePanel() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    dbcStore.fetchDbcs()
    if (activeTab.value === 'logs') {
      logStore.fetchLogs()
    }
  }
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

function showLogsTab() {
  activeTab.value = 'logs'
  if (isOpen.value) {
    logStore.fetchLogs()
  }
}

function downloadLog(name: string, url: string) {
  logStore.downloadLog({ name, url })
}

defineExpose({ togglePanel })

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(timestamp: number) {
  const date = timestamp > 1_000_000_000_000 ? new Date(timestamp) : new Date(timestamp * 1000)

  return date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function parseLogDateFromFilename(filename: string) {
  const match = filename.match(/(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/)
  if (!match) {
    return null
  }

  const [, year, month, day, hours, minutes, seconds] = match
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  )

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatLogDate(log: { name: string; mtime?: number }) {
  if (typeof log.mtime === 'number') {
    return formatDate(log.mtime)
  }

  const parsed = parseLogDateFromFilename(log.name)
  if (!parsed) {
    return null
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function getLogTimestamp(log: { name: string; mtime?: number }) {
  if (typeof log.mtime === 'number') {
    return log.mtime > 1_000_000_000_000 ? log.mtime : log.mtime * 1000
  }

  const parsed = parseLogDateFromFilename(log.name)
  return parsed ? parsed.getTime() : Number.NEGATIVE_INFINITY
}

function getActiveLogName() {
  const explicitlyActive = logStore.availableLogs.find((log) => log.active)
  if (explicitlyActive) {
    return explicitlyActive.name
  }

  if (daqConnection.loggingStatus !== 'active' && daqConnection.loggingStatus !== 'starting') {
    return null
  }

  if (logStore.availableLogs.length === 0) {
    return null
  }

  return logStore.availableLogs.reduce((latest, log) => {
    return getLogTimestamp(log) > getLogTimestamp(latest) ? log : latest
  }).name
}

function isActiveLog(log: { name: string; active?: boolean }) {
  return getActiveLogName() === log.name
}

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
          id="file-manager-logs-tab"
          class="tab-btn"
          :class="{ active: activeTab === 'logs' }"
          @click="showLogsTab"
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
          <div class="logs-header">
            <div class="logs-source">
              <span class="logs-label">DAQ Log API</span>
              <span class="logs-target">
                {{ daqConnection.target.host || 'No DAQ selected' }}<template v-if="daqConnection.target.port">:{{ daqConnection.target.port }}</template>/api/logs
              </span>
            </div>
            <button class="refresh-btn" @click="logStore.fetchLogs" :disabled="logStore.isLoading">Refresh</button>
          </div>
          <div v-if="logStore.error" class="error-msg">{{ logStore.error }}</div>
          <div class="file-list">
            <div v-if="logStore.isLoading" class="empty-state">
              <p>Loading logs...</p>
            </div>
            <div v-else-if="logStore.availableLogs.length === 0" class="empty-state">
              <p>No DAQ log files were returned by the logger API.</p>
            </div>
            <div
              v-for="log in logStore.availableLogs"
              :key="log.name"
              class="file-item"
              :class="{ 'is-logging': isActiveLog(log) }"
            >
              <div class="file-info">
                <span class="status-indicator"></span>
                <div class="file-details">
                  <span class="filename">{{ log.name }}</span>
                  <span class="file-stats">
                    <template v-if="typeof log.size === 'number'">{{ formatSize(log.size) }}</template>
                    <template v-if="typeof log.size === 'number' && formatLogDate(log)"> &bull; </template>
                    <template v-if="formatLogDate(log)">{{ formatLogDate(log) }}</template>
                    <template v-if="typeof log.size !== 'number' && !formatLogDate(log)">{{ log.url }}</template>
                  </span>
                </div>
              </div>
              <button
                :id="`download-log-${log.name.replace(/\./g, '-')}-btn`"
                class="download-btn"
                :disabled="logStore.downloadingName === log.name"
                @click.stop="downloadLog(log.name, log.url)"
                title="Download"
              >
                {{ logStore.downloadingName === log.name ? 'Saving...' : 'Download' }}
              </button>
            </div>
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
              :key="filename.name"
              class="file-item"
              :class="{ 'is-active': dbcStore.activeDbc === filename.name }"
            >
              <div class="file-info" @click="selectDbc(filename.name)">
                <span class="status-indicator"></span>
                <div class="file-details">
                  <span class="filename">{{ filename.name }}</span>
                  <span class="file-stats">{{ formatSize(filename.size) }} &bull; {{ formatDate(filename.mtime) }}</span>
                </div>
              </div>
              <button class="delete-btn" @click.stop="deleteDbc(filename.name)" title="Delete">
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
  width: 350px;
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
  padding: 6px 20px;
  border-bottom: 2px solid var(--color-border);
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
  padding: 8px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-muted);
  font-size: 14px;
  font-weight: 600;
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

.logs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.logs-source {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.logs-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
}

.logs-target {
  font-size: 12px;
  color: var(--color-text);
  word-break: break-all;
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
.file-item.is-logging .status-indicator {
  background: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  overflow: hidden;
}

.filename {
  font-size: 13px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-stats {
  font-size: 10px;
  color: var(--color-muted);
  margin-top: 1px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-muted);
  flex-shrink: 0;
  transition: all 0.3s;
}

.delete-btn,
.download-btn {
  background: none;
  border: none;
  color: var(--color-muted);
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
}
.file-item:hover .delete-btn,
.file-item:hover .download-btn {
  opacity: 1;
}
.delete-btn:hover,
.download-btn:hover {
  color: var(--color-danger-text);
  background: rgba(239, 68, 68, 0.1);
}

.refresh-btn {
  padding: 7px 12px;
  background: var(--color-blue-bg-glow);
  border: 1px solid var(--color-blue-border);
  border-radius: 7px;
  color: var(--color-blue-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.22);
}

.refresh-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
