/**
 * "Now", refreshed every 30 s while the section is on screen: for the "5 min ago"
 * of the rows. Call it while the component starts.
 */
export function ticking(ms = 30_000) {
  let now = $state(Date.now())
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), ms)
    return () => clearInterval(timer)
  })
  return {
    get now() {
      return now
    },
    /** Right after something changed (a scan, a check) */
    refresh() {
      now = Date.now()
    },
  }
}
