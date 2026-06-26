import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import { useThemeStore } from './stores/theme'
import { useHotkeysStore } from './stores/hotkeys'
import { initGlassFilter } from './utils'

initGlassFilter()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

const theme = useThemeStore()
theme.init()

const hotkeys = useHotkeysStore()
hotkeys.init()

app.mount('#app')
