<script setup lang="ts">
import { RouterView } from 'vue-router'
import NavBar from './components/NavBar.vue'
import { useLiveDataStore } from './stores/liveDataStore'
import { onMounted, onUnmounted } from 'vue'

const liveDataStore = useLiveDataStore()

onMounted(() => {
  liveDataStore.connect()
})

onUnmounted(() => {
  liveDataStore.disconnect()
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
