<script setup lang="ts">
import { ref } from 'vue'
import { GridLayout } from 'grid-layout-plus'

// Define grid layout - array of widget positions
const layout = ref([
  { x: 0, y: 0, w: 3, h: 4, i: '0' },  // Widget 1: top-left, 3 cols wide, 4 rows tall
  { x: 3, y: 0, w: 3, h: 4, i: '1' },  // Widget 2: top-middle
  { x: 6, y: 0, w: 6, h: 4, i: '2' },  // Widget 3: top-right, wider
  { x: 0, y: 4, w: 12, h: 6, i: '3' }, // Widget 4: full width below
])
</script>

<template>
  <div class="p-4">
    <GridLayout
      v-model:layout="layout"
      :col-num="12"
      :row-height="30"
      :is-draggable="true"
      :is-resizable="true"
      :is-bounded="true"
      :responsive="true"
      :margin="[5, 5]"
      :use-css-transforms="true"
    >
      <!-- Widget 0 -->
      <template #item="{ item }">
        <div class="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg p-4">
          <h3 class="text-sm font-semibold mb-2">Widget {{ item.i }}</h3>
          <p class="text-xs text-[var(--color-muted)]">{{ item.w }}x{{ item.h }}</p>
        </div>
      </template>
    </GridLayout>
  </div>
</template>

<style scoped>
/* Override grid-layout-plus default styles if needed */
:deep(.vue-grid-item) {
  transition: all 200ms ease;
}

:deep(.vue-grid-item.resizing) {
  opacity: 0.9;
}

:deep(.vue-grid-item.static) {
  background: transparent;
}
</style>
