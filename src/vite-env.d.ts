/// <reference types="vite/client" />
import type { ApiBolso } from '../electron/preload'

declare global {
  interface Window {
    bolso: ApiBolso
  }
}
