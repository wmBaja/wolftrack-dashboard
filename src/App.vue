<script setup lang="ts">
import { RouterView } from 'vue-router'
import NavBar from './components/NavBar.vue'
import { useLiveDataStore } from './stores/liveDataStore'
import { useDataSourceStore } from './stores/dataSourceStore'
import { useDaqConnectionStore } from './stores/daqConnectionStore'
import { onMounted, onUnmounted } from 'vue'

const liveDataStore = useLiveDataStore()
const dataSourceStore = useDataSourceStore()
const daqConnectionStore = useDaqConnectionStore()

onMounted(async () => {
  void liveDataStore.connect()
  await dataSourceStore.fetchConfig()
  await daqConnectionStore.fetchVisualizerLiveSource()
  if (daqConnectionStore.isConnected || daqConnectionStore.isReady) {
    daqConnectionStore.startConnectionPolling()
  }
})

onUnmounted(() => {
  liveDataStore.disconnect()
  daqConnectionStore.stopConnectionPolling()
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar />

    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>
