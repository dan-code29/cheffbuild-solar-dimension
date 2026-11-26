import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

// 1. On crée l'instance de l'application
const app = createApp(App)

// 2. On active Pinia pour toute l'application
app.use(createPinia())

// 3. On monte l'application (une seule fois, à la fin)
app.mount('#app')