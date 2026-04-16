<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDataSourceStore } from '@/stores/dataSourceStore'

const dataSource = useDataSourceStore()

const isOpen = ref(false)

// Local draft state — only applied on submit
const sourceMode = ref<'zmq' | 'logfile'>(dataSource.config.source)
const logFilePath = ref<string>(dataSource.config.log_file ?? '')
const dbcFilePath = ref<string>(dataSource.config.dbc_file ?? '')
const playbackSpeed = ref<number>(dataSource.config.playback_speed ?? 1.0)
const logFileBlob = ref<File | null>(null)
const dbcFileBlob = ref<File | null>(null)

function openPanel() {
  // Sync draft with current live config
  sourceMode.value = dataSource.config.source
  logFilePath.value = dataSource.config.log_file ?? ''
  dbcFilePath.value = dataSource.config.dbc_file ?? ''
  playbackSpeed.value = dataSource.config.playback_speed ?? 1.0
  logFileBlob.value = null
  dbcFileBlob.value = null
  isOpen.value = true
}

function handleLogFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    logFileBlob.value = file
    logFilePath.value = file.name
  }
}

function handleDbcFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    dbcFileBlob.value = file
    dbcFilePath.value = file.name
  }
}

async function applyAndStart() {
  await dataSource.applyConfig({
    source: sourceMode.value,
    log_file: sourceMode.value === 'logfile' ? logFilePath.value || null : null,
    dbc_file: dbcFilePath.value || null,
    playback_speed: playbackSpeed.value,
  }, {
    logFileBlob: logFileBlob.value,
    dbcFileBlob: dbcFileBlob.value
  })

  if (dataSource.status !== 'error') {
    isOpen.value = false
  }
}

async function stopDataSource() {
  await dataSource.stop()
  isOpen.value = false
}

const statusColor = computed(() => {
  switch (dataSource.status) {
    case 'running': return 'var(--color-success)'
    case 'loading': return 'var(--color-warning)'
    case 'error':   return 'var(--color-danger)'
    default:        return 'var(--color-muted)'
  }
})

const statusLabel = computed(() => {
  switch (dataSource.status) {
    case 'running': return 'Running'
    case 'loading': return 'Loading…'
    case 'error':   return 'Error'
    default:        return 'Stopped'
  }
})

const isLoading = computed(() => dataSource.status === 'loading')
</script>

<template>
  <!-- Trigger button -->
  <button id="datasource-config-btn" class="datasource-trigger" @click="openPanel">
    <span class="status-dot" :style="{ background: statusColor }" />
    <span class="trigger-label">Data Source</span>
    <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"/>
    </svg>
  </button>

  <!-- Backdrop -->
  <Transition name="fade">
    <div v-if="isOpen" class="backdrop" @click="isOpen = false" />
  </Transition>

  <!-- Panel -->
  <Transition name="slide-down">
    <div v-if="isOpen" class="config-panel" role="dialog" aria-label="Data Source Configuration">

      <!-- Header -->
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Data Source</h2>
          <span class="panel-status" :style="{ color: statusColor }">● {{ statusLabel }}</span>
        </div>
        <button class="close-btn" @click="isOpen = false" aria-label="Close">✕</button>
      </div>

      <!-- Error banner -->
      <Transition name="fade">
        <div v-if="dataSource.error" class="error-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>
          {{ dataSource.error }}
        </div>
      </Transition>

      <!-- Source toggle -->
      <div class="field-group">
        <label class="field-label">Source Mode</label>
        <div class="toggle-group">
          <button
            id="source-zmq-btn"
            class="toggle-btn"
            :class="{ active: sourceMode === 'zmq' }"
            @click="sourceMode = 'zmq'"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M3 4a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zM3 10a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H3z"/></svg>
            Live (ZMQ)
          </button>
          <button
            id="source-logfile-btn"
            class="toggle-btn"
            :class="{ active: sourceMode === 'logfile' }"
            @click="sourceMode = 'logfile'"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"/></svg>
            Log File
          </button>
        </div>
      </div>

      <!-- Log file picker (only for logfile mode) -->
      <Transition name="fade">
        <div v-if="sourceMode === 'logfile'" class="field-group">
          <label class="field-label" for="logfile-input">Log File <span class="required">*</span></label>
          <div class="file-picker-row">
            <input
              id="logfile-input"
              class="file-path-input"
              type="text"
              v-model="logFilePath"
              placeholder="Upload a log file"
            />
            <div class="browse-btn-wrapper">
              <button id="logfile-browse-btn" class="browse-btn" type="button">Browse…</button>
              <input type="file" accept=".blf,.log,.mf4,.asc" @change="handleLogFileChange" class="browse-input-overlay" />
            </div>
          </div>
        </div>
      </Transition>

      <!-- DBC file picker -->
      <div class="field-group">
        <label class="field-label" for="dbcfile-input">
          DBC File
          <span class="optional">(optional — uses default if omitted)</span>
        </label>
        <div class="file-picker-row">
          <input
            id="dbcfile-input"
            class="file-path-input"
            type="text"
            v-model="dbcFilePath"
            placeholder="Upload a DBC file (optional)"
          />
          <div class="browse-btn-group">
            <div class="browse-btn-wrapper">
              <button id="dbcfile-browse-btn" class="browse-btn" type="button">Browse…</button>
              <input type="file" accept=".dbc" @change="handleDbcFileChange" class="browse-input-overlay" />
            </div>
            <button v-if="dbcFilePath" id="dbcfile-clear-btn" class="clear-btn" @click="dbcFilePath = ''; dbcFileBlob = null" title="Clear">✕</button>
          </div>
        </div>
      </div>

      <!-- Playback speed (only for logfile) -->
      <Transition name="fade">
        <div v-if="sourceMode === 'logfile'" class="field-group">
          <label class="field-label" for="playback-speed-input">
            Playback Speed
            <span class="optional">
              {{ playbackSpeed <= 0 ? '(instant)' : `${playbackSpeed}×` }}
            </span>
          </label>
          <div class="speed-row">
            <input
              id="playback-speed-input"
              type="range"
              min="0"
              max="10"
              step="0.25"
              v-model.number="playbackSpeed"
              class="speed-slider"
            />
            <input
              type="number"
              min="0"
              step="0.25"
              v-model.number="playbackSpeed"
              class="speed-input"
              aria-label="Playback speed value"
            />
          </div>
          <p class="field-hint">Set to 0 or below for instant playback</p>
        </div>
      </Transition>

      <!-- Footer actions -->
      <div class="panel-footer">
        <button
          v-if="dataSource.status === 'running'"
          id="stop-datasource-btn"
          class="action-btn danger"
          @click="stopDataSource"
          :disabled="isLoading"
        >
          Stop
        </button>
        <div class="footer-right">
          <button id="cancel-config-btn" class="action-btn secondary" @click="isOpen = false">Cancel</button>
          <button
            id="apply-config-btn"
            class="action-btn primary"
            :disabled="isLoading || (sourceMode === 'logfile' && !logFilePath)"
            @click="applyAndStart"
          >
            <svg v-if="isLoading" class="spinner" viewBox="0 0 24 24" fill="none" width="14" height="14">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-linecap="round" />
            </svg>
            {{ isLoading ? 'Applying…' : 'Apply & Start' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Trigger */
.datasource-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.datasource-trigger:hover {
  background: rgba(255,255,255,0.09);
  border-color: rgba(255,255,255,0.12);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background 0.3s;
}
.trigger-label { flex: 1; }
.chevron { opacity: 0.5; }

/* Backdrop */
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 40;
}

/* Panel */
.config-panel {
  position: fixed;
  top: calc(var(--navbar-height) + 8px);
  right: 16px;
  width: 400px;
  background: var(--color-panel);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  box-shadow: 0 24px 56px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
  z-index: 50;
  overflow: hidden;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}
.panel-status {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-top: 3px;
  display: block;
}
.close-btn {
  background: none;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 15px;
  padding: 2px 6px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
.close-btn:hover { color: var(--color-text); background: var(--color-hover); }

/* Error Banner */
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-danger-text);
  line-height: 1.5;
}
.error-banner svg { flex-shrink: 0; margin-top: 1px; }

/* Fields */
.field-group { display: flex; flex-direction: column; gap: 7px; }
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.required { color: #ef4444; margin-left: 2px; }
.optional { font-weight: 400; text-transform: none; letter-spacing: 0; opacity: 0.7; }
.field-hint { font-size: 11px; color: var(--color-muted); margin: 0; }

/* Source toggle */
.toggle-group { display: flex; gap: 8px; }
.toggle-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.toggle-btn:hover { background: var(--color-hover); color: var(--color-text); }
.toggle-btn.active {
  background: var(--color-blue-bg-glow);
  border-color: var(--color-blue-border);
  color: var(--color-blue-text);
}

/* File pickers */
.file-picker-row { display: flex; gap: 8px; align-items: center; }
.file-path {
  flex: 1;
  padding: 8px 11px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.file-path.empty { color: var(--color-muted); font-family: inherit; }
.file-path-input {
  flex: 1;
  min-width: 0;
  padding: 8px 11px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  transition: border-color 0.15s;
}
.file-path-input::placeholder { color: var(--color-muted); font-family: inherit; }
.file-path-input:focus { outline: none; border-color: var(--color-accent); }
.browse-btn-wrapper { position: relative; overflow: hidden; display: flex; }
.browse-input-overlay { position: absolute; top:0; left:0; width: 100%; height:100%; opacity:0; cursor:pointer; }
.browse-btn-group { display: flex; gap: 4px; }
.browse-btn {
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
.browse-btn:hover { background: rgba(59,130,246,0.22); }
.clear-btn {
  padding: 7px 9px;
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 7px;
  color: var(--color-danger-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.clear-btn:hover { background: rgba(239,68,68,0.18); }

/* Speed controls */
.speed-row { display: flex; align-items: center; gap: 10px; }
.speed-slider {
  flex: 1;
  accent-color: var(--color-accent);
  height: 4px;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-runnable-track {
  background: var(--color-accent-white);
}

/* Styling for Firefox */
input[type="range"]::-moz-range-track {
  background: var(--color-accent-white);
  height: 4px;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  background: var(--color-accent);
  border: none;
}

.speed-input {
  width: 62px;
  padding: 6px 8px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-text);
  font-size: 13px;
  text-align: center;
}
.speed-input:focus { outline: none; border-color: var(--color-accent); }

/* Footer */
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.footer-right { display: flex; gap: 8px; margin-left: auto; }
.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}
.action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.action-btn.primary {
  background: var(--color-accent);
  color: #fff;
}
.action-btn.primary:hover:not(:disabled) { background: #2563eb; }
.action-btn.secondary {
  background: rgba(255,255,255,0.06);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.action-btn.secondary:hover:not(:disabled) { background: var(--color-hover); }
.action-btn.danger {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
  border: 1px solid var(--color-danger-border);
}
.action-btn.danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }

/* Spinner */
.spinner {
  animation: spin 0.7s linear infinite;
  stroke-dashoffset: 8;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-down-enter-active { animation: slideDown 0.2s ease; }
.slide-down-leave-active { animation: slideDown 0.15s ease reverse; }
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
</style>
