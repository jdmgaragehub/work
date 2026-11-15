'use strict';
/** Event bus (`sim.bus`). Catalogue of events: docs/ARCHITECTURE.md §3. A throwing listener never breaks others. */
class EventBus {
  constructor() { this.listeners = new Map(); this.log = []; this.count = 0; }
  on(event, fn) { if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(fn); return () => this.off(event, fn); }
  once(event, fn) { const off = this.on(event, (p, e) => { off(); fn(p, e); }); return off; }
  off(event, fn) { const s = this.listeners.get(event); if (s) s.delete(fn); }
  emit(event, payload = {}) {
    this.count++; this.log.push({ event, t: Date.now() }); if (this.log.length > 500) this.log.shift();
    for (const key of [event, '*']) {
      const set = this.listeners.get(key); if (!set) continue;
      for (const fn of [...set]) { try { fn(payload, event); } catch (err) { setTimeout(() => { throw err; }, 0); } }
    }
  }
}
module.exports = { EventBus };
