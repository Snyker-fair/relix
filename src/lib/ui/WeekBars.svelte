<script>
  /**
   * Time played per week: one column per week, this week (the last one) in the
   * accent and the earlier ones in a quiet ink. Only the tallest week and this one
   * carry their time (or none, with values off, when the text around it already
   * says this week's); the rest show it when the mouse is over.
   */
  import { formatDate, formatPlaytime } from './format.js'
  import { t } from '../i18n/i18n.svelte.js'

  /**
   * @type {{ weeks: Array<{ start: number, seconds: number }>, height?: number, values?: boolean, nowLabel?: string, label: string }}
   *   nowLabel: under this week's column ("this week", or with its time)
   *   label: what the chart shows, for screen readers ("Time played per week")
   */
  let { weeks, height = 110, values = true, nowLabel, label } = $props()
  /** Room on top for the value over the tallest column */
  const room = $derived(values ? 34 : 0)

  const max = $derived(Math.max(0, ...weeks.map((w) => w.seconds)))
  const tallest = $derived(max > 0 ? weeks.findIndex((w) => w.seconds === max) : -1)
  const last = $derived(weeks.length - 1)

  /** "13 oct" @param {number} start */
  const day = (start) => formatDate(new Date(start), { day: 'numeric', month: 'short' })
</script>

<figure class="weeks" aria-label={label}>
  <div class="plot" style:height="{height}px">
    {#each weeks as week, i (week.start)}
      <!-- the tallest one's time only if it's not right next to this week's (they'd overlap) -->
      {@const shown = values && (i === last || (i === tallest && last - tallest >= 2))}
      <div
        class="slot"
        title={t('Semana del {day}: {time}', { day: day(week.start), time: week.seconds > 0 ? formatPlaytime(week.seconds) : '—' })}
      >
        {#if shown && week.seconds > 0}
          <span class="value">{formatPlaytime(week.seconds)}</span>
        {/if}
        <span
          class="bar"
          class:now={i === last}
          style:height="{max > 0 ? Math.max(week.seconds > 0 ? 4 : 0, (week.seconds / max) * (height - room)) : 0}px"
        ></span>
      </div>
    {/each}
  </div>
  <div class="axis" aria-hidden="true">
    <span>{weeks.length > 0 ? day(weeks[0].start) : ''}</span>
    <span>{nowLabel ?? t('esta semana')}</span>
  </div>
</figure>

<style>
  .weeks {
    margin: 0;
  }
  .plot {
    display: flex;
    align-items: flex-end;
    /* the baseline: a hairline one step off the surface */
    border-bottom: 1px solid var(--sky-deep);
  }
  .slot {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    height: 100%;
  }
  .bar {
    width: 24px;
    /* rounded at the top, square on the baseline */
    border-radius: 4px 4px 0 0;
    background: var(--ink-soft);
  }
  .bar.now {
    background: var(--pop);
  }
  .value {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 18px;
    color: var(--ink-soft);
  }
</style>
