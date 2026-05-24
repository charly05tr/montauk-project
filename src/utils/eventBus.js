class EventBus extends EventTarget {
  emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }))
  }
  on(eventName, listener) {
    this.addEventListener(eventName, listener)
  }
  off(eventName, listener) {
    this.removeEventListener(eventName, listener)
  }
}

export const eventBus = new EventBus()
