import './main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Auto-hide scrollbars when not scrolling
document.addEventListener('DOMContentLoaded', () => {
  const scrollTimers = new WeakMap<Element, number>()

  const observer = new MutationObserver(() => {
    document.querySelectorAll('.custom-scrollbar').forEach((el) => {
      if (!el.hasAttribute('data-scroll-listener')) {
        el.setAttribute('data-scroll-listener', 'true')

        el.addEventListener('scroll', () => {
          el.classList.add('scrolling')

          const existingTimer = scrollTimers.get(el)
          if (existingTimer) {
            clearTimeout(existingTimer)
          }

          const timer = window.setTimeout(() => {
            el.classList.remove('scrolling')
          }, 1000)

          scrollTimers.set(el, timer)
        })
      }
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // Initial setup
  document.querySelectorAll('.custom-scrollbar').forEach((el) => {
    el.setAttribute('data-scroll-listener', 'true')

    el.addEventListener('scroll', () => {
      el.classList.add('scrolling')

      const existingTimer = scrollTimers.get(el)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      const timer = window.setTimeout(() => {
        el.classList.remove('scrolling')
      }, 1000)

      scrollTimers.set(el, timer)
    })
  })
})
