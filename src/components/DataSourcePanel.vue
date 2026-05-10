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
const liveBufferWindowSeconds = ref<number>(dataSource.config.live_buffer_window_seconds ?? 15)
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
  liveBufferWindowSeconds.value = dataSource.config.live_buffer_window_seconds ?? 15
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
      live_buffer_window_seconds: liveBufferWindowSeconds.value,
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

  const sessionState = daqConnection.loggingStatus === 'starting'
    ? 'active'
    : daqConnection.loggingStatus === 'stopping'
      ? 'idle'
      : daqConnection.loggingActive
        ? 'active'
        : typeof health.session === 'boolean'
          ? health.session ? 'active' : 'idle'
          : 'idle'

  return {
    session: sessionState,
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

        <div class="field-group">
          <label class="field-label" for="live-buffer-window-input">
            Live Buffer Window
            <span class="optional">({{ liveBufferWindowSeconds }}s)</span>
          </label>
          <div class="speed-row">
            <input
              id="live-buffer-window-input"
              type="range"
              min="1"
              max="120"
              step="0.5"
              v-model.number="liveBufferWindowSeconds"
              class="speed-slider"
            />
            <input
              id="live-buffer-window-number-input"
              type="number"
              min="1"
              step="0.5"
              v-model.number="liveBufferWindowSeconds"
              class="speed-input"
              aria-label="Live buffer window seconds"
            />
          </div>
          <p class="field-hint">Only keep the most recent seconds of live DAQ data in chart memory.</p>
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
:global(:root) {
  --data-source-trigger-gap: 8px;
  --data-source-trigger-padding-block: 6px;
  --data-source-trigger-padding-inline: 12px;
  --data-source-trigger-radius: 8px;
  --data-source-trigger-font-size: 13px;
  --data-source-trigger-hover-bg: rgba(255, 255, 255, 0.09);
  --data-source-trigger-hover-border: rgba(255, 255, 255, 0.12);
  --data-source-status-dot-size: 8px;
  --data-source-trigger-status-font-size: 11px;
  --data-source-trigger-chevron-opacity: 0.5;
  --data-source-backdrop-bg: rgba(0, 0, 0, 0.4);
  --data-source-backdrop-z-index: 40;
  --data-source-panel-offset-top: 8px;
  --data-source-panel-offset-right: 16px;
  --data-source-panel-width: 420px;
  --data-source-panel-mobile-margin: 24px;
  --data-source-panel-max-height-offset: 24px;
  --data-source-panel-border: rgba(255, 255, 255, 0.08);
  --data-source-panel-border-radius: 14px;
  --data-source-panel-shadow: 0 24px 56px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
  --data-source-panel-z-index: 50;
  --data-source-panel-padding: 20px;
  --data-source-panel-gap: 18px;
  --data-source-panel-title-font-size: 15px;
  --data-source-panel-status-font-size: 11px;
  --data-source-panel-status-letter-spacing: 0.02em;
  --data-source-panel-status-margin-top: 3px;
  --data-source-close-button-font-size: 15px;
  --data-source-close-button-padding-block: 2px;
  --data-source-close-button-padding-inline: 6px;
  --data-source-close-button-radius: 6px;
  --data-source-transition-fast: 0.15s;
  --data-source-transition-medium: 0.18s;
  --data-source-transition-slow: 0.3s;
  --data-source-error-banner-gap: 8px;
  --data-source-error-banner-padding-block: 10px;
  --data-source-error-banner-padding-inline: 12px;
  --data-source-error-banner-radius: 8px;
  --data-source-error-banner-font-size: 12px;
  --data-source-error-banner-icon-offset: 1px;
  --data-source-field-group-gap: 7px;
  --data-source-field-label-font-size: 12px;
  --data-source-field-label-letter-spacing: 0.05em;
  --data-source-required-margin-left: 2px;
  --data-source-optional-opacity: 0.7;
  --data-source-field-hint-font-size: 11px;
  --data-source-toggle-gap: 8px;
  --data-source-toggle-button-gap: 6px;
  --data-source-toggle-button-padding-block: 9px;
  --data-source-toggle-button-padding-inline: 12px;
  --data-source-toggle-button-radius: 8px;
  --data-source-toggle-button-font-size: 13px;
  --data-source-toggle-button-bg: rgba(255, 255, 255, 0.04);
  --data-source-row-gap: 8px;
  --data-source-input-padding-block: 8px;
  --data-source-input-padding-inline: 11px;
  --data-source-input-bg: rgba(0, 0, 0, 0.25);
  --data-source-input-radius: 8px;
  --data-source-input-font-size: 12px;
  --data-source-port-width: 88px;
  --data-source-browse-group-gap: 4px;
  --data-source-inline-button-padding-block: 7px;
  --data-source-inline-button-padding-inline: 12px;
  --data-source-inline-button-radius: 7px;
  --data-source-inline-button-font-size: 12px;
  --data-source-inline-button-hover-bg: rgba(59, 130, 246, 0.22);
  --data-source-clear-button-padding-block: 7px;
  --data-source-clear-button-padding-inline: 9px;
  --data-source-clear-button-radius: 7px;
  --data-source-clear-button-font-size: 12px;
  --data-source-clear-button-hover-bg: rgba(239, 68, 68, 0.18);
  --data-source-chip-padding-block: 7px;
  --data-source-chip-padding-inline: 10px;
  --data-source-chip-radius: 999px;
  --data-source-chip-font-size: 12px;
  --data-source-chip-bg: rgba(255, 255, 255, 0.04);
  --data-source-health-card-padding: 10px;
  --data-source-health-card-radius: 10px;
  --data-source-health-card-gap: 4px;
  --data-source-health-card-bg: rgba(255, 255, 255, 0.03);
  --data-source-slider-height: 4px;
  --data-source-speed-input-width: 62px;
  --data-source-panel-footer-padding-top: 6px;
  --data-source-panel-footer-border: rgba(255, 255, 255, 0.06);
  --data-source-action-button-padding-block: 8px;
  --data-source-action-button-padding-inline: 16px;
  --data-source-action-button-radius: 8px;
  --data-source-action-button-font-size: 13px;
  --data-source-action-button-gap: 6px;
  --data-source-disabled-opacity: 0.45;
  --data-source-action-button-primary-text: #fff;
  --data-source-action-button-primary-hover-bg: #2563eb;
  --data-source-action-button-secondary-bg: rgba(255, 255, 255, 0.06);
  --data-source-action-button-danger-hover-bg: rgba(239, 68, 68, 0.2);
  --data-source-slide-enter-duration: 0.2s;
  --data-source-slide-leave-duration: 0.15s;
  --data-source-slide-from-translate-y: -6px;
  --data-source-slide-from-scale: 0.98;
  --data-source-mobile-inset: 12px;
}

.datasource-trigger {
  display: flex;
  align-items: center;
  gap: var(--data-source-trigger-gap);
  padding: var(--data-source-trigger-padding-block) var(--data-source-trigger-padding-inline);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--data-source-trigger-radius);
  color: var(--color-text);
  font-size: var(--data-source-trigger-font-size);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--data-source-transition-fast), border-color var(--data-source-transition-fast);
}

.datasource-trigger:hover {
  background: var(--data-source-trigger-hover-bg);
  border-color: var(--data-source-trigger-hover-border);
}

.status-dot {
  width: var(--data-source-status-dot-size);
  height: var(--data-source-status-dot-size);
  border-radius: 50%;
  transition: background var(--data-source-transition-slow);
}

.trigger-label {
  flex: 1;
}

.trigger-status {
  font-size: var(--data-source-trigger-status-font-size);
  color: var(--color-muted);
}

.chevron {
  opacity: var(--data-source-trigger-chevron-opacity);
}

.backdrop {
  position: fixed;
  inset: 0;
  background: var(--data-source-backdrop-bg);
  z-index: var(--data-source-backdrop-z-index);
}

.config-panel {
  position: fixed;
  top: calc(var(--navbar-height) + var(--data-source-panel-offset-top));
  right: var(--data-source-panel-offset-right);
  width: min(var(--data-source-panel-width), calc(100vw - var(--data-source-panel-mobile-margin)));
  max-height: calc(100vh - var(--navbar-height) - var(--data-source-panel-max-height-offset));
  overflow-y: auto;
  background: var(--color-panel);
  border: 1px solid var(--data-source-panel-border);
  border-radius: var(--data-source-panel-border-radius);
  box-shadow: var(--data-source-panel-shadow);
  z-index: var(--data-source-panel-z-index);
  padding: var(--data-source-panel-padding);
  display: flex;
  flex-direction: column;
  gap: var(--data-source-panel-gap);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.panel-title {
  font-size: var(--data-source-panel-title-font-size);
  font-weight: 700;
  color: var(--color-text);
}

.panel-status {
  font-size: var(--data-source-panel-status-font-size);
  font-weight: 600;
  letter-spacing: var(--data-source-panel-status-letter-spacing);
  margin-top: var(--data-source-panel-status-margin-top);
  display: block;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  font-size: var(--data-source-close-button-font-size);
  padding: var(--data-source-close-button-padding-block) var(--data-source-close-button-padding-inline);
  border-radius: var(--data-source-close-button-radius);
  transition: color var(--data-source-transition-fast), background var(--data-source-transition-fast);
}

.close-btn:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

.error-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--data-source-error-banner-gap);
  padding: var(--data-source-error-banner-padding-block) var(--data-source-error-banner-padding-inline);
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--data-source-error-banner-radius);
  font-size: var(--data-source-error-banner-font-size);
  color: var(--color-danger-text);
  line-height: 1.5;
}

.error-banner svg {
  flex-shrink: 0;
  margin-top: var(--data-source-error-banner-icon-offset);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--data-source-field-group-gap);
}

.field-label {
  font-size: var(--data-source-field-label-font-size);
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: var(--data-source-field-label-letter-spacing);
}

.required {
  color: var(--color-danger);
  margin-left: var(--data-source-required-margin-left);
}

.optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: var(--data-source-optional-opacity);
}

.field-hint {
  font-size: var(--data-source-field-hint-font-size);
  color: var(--color-muted);
  margin: 0;
}

.toggle-group {
  display: flex;
  gap: var(--data-source-toggle-gap);
}

.toggle-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--data-source-toggle-button-gap);
  padding: var(--data-source-toggle-button-padding-block) var(--data-source-toggle-button-padding-inline);
  background: var(--data-source-toggle-button-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--data-source-toggle-button-radius);
  color: var(--color-muted);
  font-size: var(--data-source-toggle-button-font-size);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--data-source-transition-fast);
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
  gap: var(--data-source-row-gap);
}

.text-input,
.port-input,
.speed-input {
  min-width: 0;
  padding: var(--data-source-input-padding-block) var(--data-source-input-padding-inline);
  background: var(--data-source-input-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--data-source-input-radius);
  font-size: var(--data-source-input-font-size);
  color: var(--color-text);
  transition: border-color var(--data-source-transition-fast);
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
  width: var(--data-source-port-width);
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
  gap: var(--data-source-browse-group-gap);
}

.browse-btn,
.secondary-inline-btn {
  padding: var(--data-source-inline-button-padding-block) var(--data-source-inline-button-padding-inline);
  background: var(--color-blue-bg-glow);
  border: 1px solid var(--color-blue-border);
  border-radius: var(--data-source-inline-button-radius);
  color: var(--color-blue-text);
  font-size: var(--data-source-inline-button-font-size);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--data-source-transition-fast);
}

.browse-btn:hover,
.secondary-inline-btn:hover {
  background: var(--data-source-inline-button-hover-bg);
}

.secondary-inline-btn:disabled,
.browse-btn:disabled {
  opacity: var(--data-source-disabled-opacity);
  cursor: not-allowed;
}

.clear-btn {
  padding: var(--data-source-clear-button-padding-block) var(--data-source-clear-button-padding-inline);
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--data-source-clear-button-radius);
  color: var(--color-danger-text);
  font-size: var(--data-source-clear-button-font-size);
  cursor: pointer;
  transition: all var(--data-source-transition-fast);
}

.clear-btn:hover {
  background: var(--data-source-clear-button-hover-bg);
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--data-source-row-gap);
}

.chip-btn {
  padding: var(--data-source-chip-padding-block) var(--data-source-chip-padding-inline);
  border-radius: var(--data-source-chip-radius);
  border: 1px solid var(--color-border);
  background: var(--data-source-chip-bg);
  color: var(--color-text);
  font-size: var(--data-source-chip-font-size);
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
  gap: var(--data-source-row-gap);
}

.health-card {
  padding: var(--data-source-health-card-padding);
  border-radius: var(--data-source-health-card-radius);
  border: 1px solid var(--color-border);
  background: var(--data-source-health-card-bg);
  display: flex;
  flex-direction: column;
  gap: var(--data-source-health-card-gap);
}

.health-label {
  font-size: var(--data-source-field-hint-font-size);
  text-transform: uppercase;
  letter-spacing: var(--data-source-field-label-letter-spacing);
  color: var(--color-muted);
}

.speed-slider {
  flex: 1;
  accent-color: var(--color-accent);
  height: var(--data-source-slider-height);
  cursor: pointer;
}

.speed-input {
  width: var(--data-source-speed-input-width);
  text-align: center;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--data-source-row-gap);
  padding-top: var(--data-source-panel-footer-padding-top);
  border-top: 1px solid var(--data-source-panel-footer-border);
}

.footer-right {
  display: flex;
  gap: var(--data-source-row-gap);
  margin-left: auto;
}

.action-btn {
  padding: var(--data-source-action-button-padding-block) var(--data-source-action-button-padding-inline);
  border-radius: var(--data-source-action-button-radius);
  font-size: var(--data-source-action-button-font-size);
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: var(--data-source-action-button-gap);
  transition: all var(--data-source-transition-fast);
}

.action-btn:disabled {
  opacity: var(--data-source-disabled-opacity);
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--color-accent);
  color: var(--data-source-action-button-primary-text);
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--data-source-action-button-primary-hover-bg);
}

.action-btn.secondary {
  background: var(--data-source-action-button-secondary-bg);
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
  background: var(--data-source-action-button-danger-hover-bg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--data-source-transition-medium) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active {
  animation: slideDown var(--data-source-slide-enter-duration) ease;
}

.slide-down-leave-active {
  animation: slideDown var(--data-source-slide-leave-duration) ease reverse;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(var(--data-source-slide-from-translate-y)) scale(var(--data-source-slide-from-scale));
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .config-panel {
    right: var(--data-source-mobile-inset);
    left: var(--data-source-mobile-inset);
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
