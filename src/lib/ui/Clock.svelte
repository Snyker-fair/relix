<script>
  import { i18n } from '../i18n/i18n.svelte.js'

  let now = $state(new Date())

  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 15_000)
    return () => clearInterval(timer)
  })

  // "06:07 a. m." and "sáb, 17 oct" in Spanish; "6:07 AM" and "Sat, Oct 17" in English
  const time = $derived(
    now.toLocaleTimeString(i18n.dateLocale, { hour: i18n.current === 'es' ? '2-digit' : 'numeric', minute: '2-digit' }),
  )
  const date = $derived(now.toLocaleDateString(i18n.dateLocale, { weekday: 'short', day: 'numeric', month: 'short' }))
</script>

<div class="clock">
  <span class="time">{time}</span>
  <span class="date">{date}</span>
</div>

<style>
  .clock {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1;
  }
  .time {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 48px;
  }
  .date {
    font-weight: 600;
    font-size: 22px;
    color: var(--ink-soft);
    margin-top: 2px;
  }
</style>
