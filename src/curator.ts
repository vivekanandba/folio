/**
 * The museum's voice, in one place.
 *
 * folio already had a curator — "Lighting the halls…", "The curator is
 * tallying…" — but only on two routes out of seven. Everywhere else said
 * "Loading…", which is the voice of a form, not of a building someone built.
 *
 * Everything here is a PURE function of its arguments, including the clock,
 * which is passed in rather than read. That is not ceremony: the arrival line
 * changes with the hour, and a screenshot gate that captures it needs the time
 * to be something a test can hold still.
 */

/** Routes the shell can be waiting on. Mirrors `Route['name']` in router.ts. */
export type Waiting =
  | 'hub'
  | 'today'
  | 'floor'
  | 'report'
  | 'pack'
  | 'concept'
  | 'session'
  | 'notfound'

/**
 * What the museum says while a route is on its way. One line each, in the
 * building's own terms — a hall is unlocked, a lamp is turned up, a stage is
 * set. The two that already existed keep their words.
 */
const WAITING: Record<Waiting, string> = {
  floor: 'Lighting the halls…',
  hub: 'Unlocking the doors…',
  pack: 'Unlocking the hall…',
  concept: 'Turning up the lamp…',
  session: 'Setting the stage…',
  today: 'Building your review…',
  report: 'The curator is tallying…',
  notfound: 'Checking the floor plan…',
}

export function loadingLine(route: Waiting): string {
  return WAITING[route]
}

/**
 * The greeting on the floor, by time of day. folio's own copy says the museum
 * is "open all night", so the small hours get the warmest line rather than a
 * scolding one — this is a private collection, not a productivity app.
 *
 * Buckets, not a continuous function: four possible strings is something a
 * reader can hold in their head and a test can enumerate.
 */
export function arrivalLine(now: Date): string {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning. The lamps have been on all night.'
  if (hour >= 12 && hour < 17) return 'Afternoon. The halls are quiet just now.'
  if (hour >= 17 && hour < 22) return 'Good evening. The museum is at its best after dark.'
  return 'Open all night, as promised. Mind the quiet.'
}
