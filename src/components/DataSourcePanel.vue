<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDataSourceStore } from '@/stores/dataSourceStore'
import { useDaqConnectionStore, type DaqTarget } from '@/stores/daqConnectionStore'
import { useDbcStore } from '@/stores/dbcStore'
import { useLiveDataStore } from '@/stores/liveDataStore'

const dataSource = useDataSourceStore()
const daqConnection = useDaqConnectionStore()
const dbcStore = useDbcStore()
const liveData = useLiveDataStore()

const isOpen = ref(false)
const sourceMode = ref<'zmq' | 'logfile'>(dataSource.config.source)
const logFilePath = ref<string>(dataSource.config.log_file ?? '')
const playbackSpeed = ref<number>(dataSource.config.playback_speed ?? 1.0)
const daqHost = ref<string>(daqConnection.target.host)
const daqPort = ref<number>(daqConnection.target.port || 5000)
const logFileBlob = ref<File | null>(null)

function isCurrentDaqTarget(host: string, port: number) {
  return daqConnection.target.host === host.trim() && daqConnection.target.port === Number(port)
}

function syncDraftState() {
  sourceMode.value = dataSource.config.source
  logFilePath.value = dataSource.config.log_file ?? ''
  playbackSpeed.value = dataSource.config.playback_speed ?? 1.0
  daqHost.value = daqConnection.target.host
  daqPort.value = daqConnection.target.port || 5000
  logFileBlob.value = null
}

function openPanel() {
  syncDraftState()
  dbcStore.fetchDbcs()
  isOpen.value = true
}

function handleLogFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  logFileBlob.value = file
  logFilePath.value = file.name
}

function syncDaqTargetDraft() {
  daqConnection.target.host = daqHost.value.trim()
  daqConnection.target.port = Number(daqPort.value)
}

function prepareForNewStream() {
  if (Object.keys(liveData.buffers).length === 0) {
    return true
  }

  const proceed = window.confirm('Starting a new session will clear existing data on the dashboard. Continue?')
  if (!proceed) return false

  liveData.clearBuffers()
  return true
}

async function applyLogfileConfig() {
  if (!prepareForNewStream()) return

  await dataSource.applyConfig(
    {
      source: 'logfile',
      log_file: logFilePath.value || null,
      playback_speed: playbackSpeed.value,
    },
    {
      logFileBlob: logFileBlob.value,
    },
  )

  if (dataSource.status !== 'error') {
    await dbcStore.fetchSignals()
    isOpen.value = false
  }
}

async function connectToDaq() {
  const isResumingReadyStream = daqConnection.connectionState === 'ready'
    && isCurrentDaqTarget(daqHost.value, daqPort.value)
  if (!isResumingReadyStream && !prepareForNewStream()) return

  syncDaqTargetDraft()

  await dataSource.applyConfig(
    {
      source: 'zmq',
      log_file: null,
      playback_speed: 1.0,
    },
    {
      logFileBlob: null,
    },
  )

  if (dataSource.status === 'error') return

  const connected = await daqConnection.connect({ autostart: isResumingReadyStream })
  if (connected) {
    await dbcStore.fetchSignals()
    isOpen.value = false
  }
}

async function stopDaqStreaming() {
  await daqConnection.stopStreaming()
  isOpen.value = false
}

async function disconnectDaq() {
  await daqConnection.disconnect()
  isOpen.value = false
}

async function stopDataSource() {
  await dataSource.stop()
  isOpen.value = false
}

async function discoverDaqs() {
  await daqConnection.discoverServices()
}

function useTarget(target: DaqTarget) {
  daqConnection.selectTarget(target)
  daqHost.value = target.host
  daqPort.value = target.port
}

const canStartReadyStream = computed(() => {
  return daqConnection.connectionState === 'ready'
    && isCurrentDaqTarget(daqHost.value, daqPort.value)
})

const canDisconnectDaq = computed(() => {
  return daqConnection.connectionState === 'connected' || daqConnection.connectionState === 'ready'
})

const daqPrimaryActionLabel = computed(() => {
  if (isBusy.value) {
    return canStartReadyStream.value ? 'Starting...' : 'Connecting...'
  }

  return canStartReadyStream.value ? 'Start' : 'Connect'
})

const daqStatusColor = computed(() => {
  switch (daqConnection.connectionState) {
    case 'connected':
      return 'var(--color-success)'
    case 'ready':
      return 'var(--color-blue-text)'
    case 'checking':
    case 'connecting':
    case 'discovering':
      return 'var(--color-warning)'
    case 'error':
      return 'var(--color-danger)'
    default:
      return 'var(--color-muted)'
  }
})

const daqStatusLabel = computed(() => {
  switch (daqConnection.connectionState) {
    case 'connected':
      return 'Streaming'
    case 'ready':
      return 'Ready'
    case 'checking':
      return 'Checking'
    case 'connecting':
      return 'Connecting'
    case 'discovering':
      return 'Discovering'
    case 'error':
      return 'Error'
    default:
      return 'Disconnected'
  }
})

const panelError = computed(() => daqConnection.error || dataSource.error)
const isBusy = computed(() => {
  return dataSource.status === 'loading'
    || daqConnection.connectionState === 'checking'
    || daqConnection.connectionState === 'connecting'
    || daqConnection.connectionState === 'discovering'
})

const healthSummary = computed(() => {
  const health = daqConnection.health
  if (!health) return null

  return {
    session: health.session ? 'active' : 'idle',
    can: health.can_connected ? 'ready' : 'offline',
    dbc: health.dbc_loaded ? 'loaded' : 'missing',
  }
})

const activeDbcLabel = computed(() => dbcStore.activeDbc || 'No DBC selected')
</script>

<template>
  <button id="datasource-config-btn" class="datasource-trigger" @click="openPanel">
    <span class="status-dot" :style="{ background: daqStatusColor }" />
    <span class="trigger-label">Data Source</span>
    <span class="trigger-status">{{ daqStatusLabel }}</span>
    <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" />
    </svg>
  </button>

  <Transition name="fade">
    <div v-if="isOpen" class="backdrop" @click="isOpen = false" />
  </Transition>

  <Transition name="slide-down">
    <div v-if="isOpen" class="config-panel" role="dialog" aria-label="Data Source Configuration">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Data Source</h2>
          <span class="panel-status" :style="{ color: daqStatusColor }">● DAQ {{ daqStatusLabel }}</span>
        </div>
        <button class="close-btn" @click="isOpen = false" aria-label="Close">×</button>
      </div>

      <Transition name="fade">
        <div v-if="panelError" class="error-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
          </svg>
          {{ panelError }}
        </div>
      </Transition>

      <div class="field-group">
        <label class="field-label">Source Mode</label>
        <div class="toggle-group">
          <button
            id="source-zmq-btn"
            class="toggle-btn"
            :class="{ active: sourceMode === 'zmq' }"
            @click="sourceMode = 'zmq'"
          >
            Live (DAQ)
          </button>
          <button
            id="source-logfile-btn"
            class="toggle-btn"
            :class="{ active: sourceMode === 'logfile' }"
            @click="sourceMode = 'logfile'"
          >
            Log File
          </button>
        </div>
      </div>

      <template v-if="sourceMode === 'zmq'">
        <div class="field-group">
          <label class="field-label" for="daq-host-input">DAQ Flask Server</label>
          <div class="server-row">
            <input
              id="daq-host-input"
              v-model="daqHost"
              class="text-input"
              type="text"
              placeholder="Host or IP address"
            />
            <input
              id="daq-port-input"
              v-model.number="daqPort"
              class="port-input"
              type="number"
              min="1"
              max="65535"
              placeholder="5000"
            />
            <button class="secondary-inline-btn" :disabled="isBusy" @click="discoverDaqs">Discover</button>
          </div>
          <p class="field-hint">Connect to the DAQ Flask API, validate health, then resolve the live ZMQ endpoint.</p>
        </div>

        <div v-if="healthSummary" class="health-grid">
          <div class="health-card">
            <span class="health-label">Session</span>
            <strong>{{ healthSummary.session }}</strong>
          </div>
          <div class="health-card">
            <span class="health-label">CAN</span>
            <strong>{{ healthSummary.can }}</strong>
          </div>
          <div class="health-card">
            <span class="health-label">DBC</span>
            <strong>{{ healthSummary.dbc }}</strong>
          </div>
        </div>

        <div v-if="daqConnection.recentTargets.length" class="field-group">
          <label class="field-label">Recent Targets</label>
          <div class="chip-list">
            <button
              v-for="recentTarget in daqConnection.recentTargets"
              :key="`${recentTarget.host}:${recentTarget.port}`"
              class="chip-btn"
              @click="useTarget(recentTarget)"
            >
              {{ recentTarget.label || recentTarget.host }}:{{ recentTarget.port }}
            </button>
          </div>
        </div>

        <div v-if="daqConnection.discoveries.length" class="field-group">
          <label class="field-label">Discovered DAQs</label>
          <div class="chip-list">
            <button
              v-for="service in daqConnection.discoveries"
              :key="service.id"
              class="chip-btn highlight"
              @click="useTarget(service)"
            >
              {{ service.label || service.host }}:{{ service.port }}
            </button>
          </div>
        </div>
      </template>

      <Transition name="fade">
        <div v-if="sourceMode === 'logfile'" class="field-group">
          <label class="field-label" for="logfile-input">Log File <span class="required">*</span></label>
          <div class="file-picker-row">
            <input
              id="logfile-input"
              class="text-input mono"
              type="text"
              v-model="logFilePath"
              placeholder="Upload a log file"
            />
            <div class="browse-btn-wrapper">
              <button id="logfile-browse-btn" class="browse-btn" type="button">Browse...</button>
              <input type="file" accept=".blf,.log,.mf4,.asc" @change="handleLogFileChange" class="browse-input-overlay" />
            </div>
          </div>
        </div>
      </Transition>

      <div class="field-group">
        <label class="field-label">Active DBC</label>
        <div class="dbc-summary">
          <span class="dbc-name">{{ activeDbcLabel }}</span>
          <span class="field-hint">Manage DBC files from the file manager in the nav bar.</span>
        </div>
      </div>

      <Transition name="fade">
        <div v-if="sourceMode === 'logfile'" class="field-group">
          <label class="field-label" for="playback-speed-input">
            Playback Speed
            <span class="optional">{{ playbackSpeed <= 0 ? '(instant)' : `${playbackSpeed}x` }}</span>
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
          <p class="field-hint">Set to 0 for instant playback.</p>
        </div>
      </Transition>

      <div class="panel-footer">
        <button
          v-if="sourceMode === 'logfile' && dataSource.status === 'running'"
          id="stop-datasource-btn"
          class="action-btn danger"
          @click="stopDataSource"
          :disabled="isBusy"
        >
          Stop
        </button>
        <button
          v-if="sourceMode === 'zmq' && daqConnection.isConnected"
          id="stop-daq-btn"
          class="action-btn danger"
          @click="stopDaqStreaming"
          :disabled="isBusy"
        >
          Stop
        </button>
        <button
          v-if="sourceMode === 'zmq' && canDisconnectDaq"
          id="disconnect-daq-btn"
          class="action-btn danger"
          @click="disconnectDaq"
          :disabled="isBusy"
        >
          Disconnect
        </button>

        <div class="footer-right">
          <button id="cancel-config-btn" class="action-btn secondary" @click="isOpen = false">Close</button>
          <button
            v-if="sourceMode === 'logfile'"
            id="apply-config-btn"
            class="action-btn primary"
            :disabled="isBusy || !logFilePath"
            @click="applyLogfileConfig"
          >
            {{ isBusy ? 'Applying...' : 'Apply & Start' }}
          </button>
          <button
            v-else-if="daqConnection.connectionState !== 'connected'"
            id="connect-daq-btn"
            class="action-btn primary"
            :disabled="isBusy || !daqHost || !daqPort"
            @click="connectToDaq"
          >
            {{ daqPrimaryActionLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.datasource-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.datasource-trigger:hover {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.12);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background 0.3s;
}

.trigger-label {
  flex: 1;
}

.trigger-status {
  font-size: 11px;
  color: var(--color-muted);
}

.chevron {
  opacity: 0.5;
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
}

.config-panel {
  position: fixed;
  top: calc(var(--navbar-height) + 8px);
  right: 16px;
  width: min(420px, calc(100vw - 24px));
  max-height: calc(100vh - var(--navbar-height) - 24px);
  overflow-y: auto;
  background: var(--color-panel);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
  z-index: 50;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

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

.close-btn:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

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

.error-banner svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.required {
  color: #ef4444;
  margin-left: 2px;
}

.optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
}

.field-hint {
  font-size: 11px;
  color: var(--color-muted);
  margin: 0;
}

.toggle-group {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.toggle-btn.active {
  background: var(--color-blue-bg-glow);
  border-color: var(--color-blue-border);
  color: var(--color-blue-text);
}

.server-row,
.file-picker-row,
.speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-input,
.port-input,
.speed-input {
  min-width: 0;
  padding: 8px 11px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-text);
  transition: border-color 0.15s;
}

.text-input {
  flex: 1;
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.text-input::placeholder,
.port-input::placeholder {
  color: var(--color-muted);
}

.text-input:focus,
.port-input:focus,
.speed-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.port-input {
  width: 88px;
}

.browse-btn-wrapper {
  position: relative;
  overflow: hidden;
  display: flex;
}

.browse-input-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.browse-btn-group {
  display: flex;
  gap: 4px;
}

.browse-btn,
.secondary-inline-btn {
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

.browse-btn:hover,
.secondary-inline-btn:hover {
  background: rgba(59, 130, 246, 0.22);
}

.secondary-inline-btn:disabled,
.browse-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

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

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.18);
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-btn {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
}

.chip-btn.highlight {
  border-color: var(--color-blue-border);
  color: var(--color-blue-text);
  background: var(--color-blue-bg-glow);
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.health-card {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
}

.speed-slider {
  flex: 1;
  accent-color: var(--color-accent);
  height: 4px;
  cursor: pointer;
}

.speed-input {
  width: 62px;
  text-align: center;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

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

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--color-accent);
  color: #fff;
}

.action-btn.primary:hover:not(:disabled) {
  background: #2563eb;
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--color-hover);
}

.action-btn.danger {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
  border: 1px solid var(--color-danger-border);
}

.action-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active {
  animation: slideDown 0.2s ease;
}

.slide-down-leave-active {
  animation: slideDown 0.15s ease reverse;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .config-panel {
    right: 12px;
    left: 12px;
    width: auto;
  }

  .server-row,
  .file-picker-row,
  .speed-row {
    flex-wrap: wrap;
  }

  .port-input,
  .secondary-inline-btn {
    width: 100%;
  }
}
</style>
