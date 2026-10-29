// Event list ordering: by start day (Arizona, UTC-7 year-round), then by end, so an evening
// event on the first day of a multi-day program lists before the program. Zoneless strings = Arizona.
const toMs = (d) => {
  if (typeof d !== "string" || /Z|[+-]\d{2}:?\d{2}$/.test(d)) return +new Date(d);
  return +new Date(/T/.test(d) ? d + "-07:00" : d + "T00:00:00-07:00");
};
const azDay = (d) => Math.floor((toMs(d) - 7 * 3600000) / 86400000);

export function compareEvents(aStart, aEnd, bStart, bEnd) {
  return azDay(aStart) - azDay(bStart) || toMs(aEnd || aStart) - toMs(bEnd || bStart);
}

export const byEventData = (a, b) => compareEvents(a.data.startDate, a.data.endDate, b.data.startDate, b.data.endDate);
