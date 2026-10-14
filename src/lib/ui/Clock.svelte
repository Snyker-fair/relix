<script>
  let now = $state(new Date())

  $effect(() => {
    const t = setInterval(() => (now = new Date()), 15_000)
    return () => clearInterval(t)
  })

  const time = $derived(now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))
  const date = $derived(now.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }))
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
