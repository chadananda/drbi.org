// AI meal-summary worker. Reads an event's dates + description and estimates how many
// breakfasts / lunches / dinners the kitchen should prepare. Used to seed the coordination
// thread on first import (author "DRBI Web AI"). Falls back to a date-based estimate if the
// AI binding is unavailable or errors. Deps: Cloudflare Workers AI (env.AI).
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DAY_MS = 24 * 60 * 60 * 1000;

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

function nightsBetween(startISO, endISO) {
  const a = new Date(startISO).getTime();
  const b = new Date(endISO || startISO).getTime();
  if (!a || !b || b < a) return 1;
  return Math.max(1, Math.round((b - a) / DAY_MS));
}

// Date-based baseline: residential event → serve dinner on arrival through breakfast on
// departure, roughly one of each meal per night.
function fallbackMeals(startISO, endISO) {
  const n = nightsBetween(startISO, endISO);
  return { breakfasts: n, lunches: Math.max(1, n - 1), dinners: n, notes: 'Rough estimate from the event dates — please confirm.' };
}

function fmtRange(startISO, endISO) {
  try {
    const opt = { month: 'short', day: 'numeric' };
    const s = new Date(startISO).toLocaleDateString('en-US', opt);
    const e = new Date(endISO || startISO).toLocaleDateString('en-US', { ...opt, year: 'numeric' });
    return `${s} – ${e}`;
  } catch { return ''; }
}

function formatMessage(meals, startISO, endISO) {
  const total = (meals.breakfasts || 0) + (meals.lunches || 0) + (meals.dinners || 0);
  return [
    `🍽️ Estimated meals for the kitchen — auto-generated on import. Please confirm final counts.`,
    ``,
    `• Breakfasts: ${meals.breakfasts}`,
    `• Lunches: ${meals.lunches}`,
    `• Dinners: ${meals.dinners}`,
    `  (${total} meals total, per attendee, over ${fmtRange(startISO, endISO)})`,
    ``,
    meals.notes ? meals.notes : '',
    `Reply below with dietary needs, exact headcounts, or volunteer sign-ups.`,
  ].filter((l) => l !== null && l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}

// Returns the seed-message body (string), or null if we can't produce anything useful.
export async function deriveMealSummary(event, ai) {
  const { title, startDate, endDate, description } = event || {};
  if (!startDate) return null;
  let meals = fallbackMeals(startDate, endDate);

  try {
    if (ai) {
      const prompt = `You plan meals for a multi-day residential event at a retreat center. Estimate how many breakfasts, lunches, and dinners the kitchen should prepare PER ATTENDEE across the whole event. Attendees arrive around the start and leave around the end; count each meal served during the event. Use the schedule in the description when it is clearer than the raw timestamps.

Event: ${title || ''}
Starts: ${startDate}
Ends: ${endDate || startDate}
Description: ${stripHtml(description).slice(0, 1500)}

Reply with ONLY compact JSON, no prose: {"breakfasts":N,"lunches":N,"dinners":N,"notes":"one short sentence for the cook"}`;
      const res = await ai.run(AI_MODEL, { messages: [{ role: 'user', content: prompt }], max_tokens: 250 });
      // Response shape varies by model: `response` may be a string OR an already-parsed object.
      let j = null;
      const resp = res?.response ?? res?.text ?? res;
      if (resp && typeof resp === 'object') {
        j = resp;
      } else {
        const match = String(resp ?? '').match(/\{[\s\S]*\}/);
        if (match) { try { j = JSON.parse(match[0]); } catch { /* not JSON */ } }
      }
      if (j) {
        const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);
        const b = num(j.breakfasts), l = num(j.lunches), d = num(j.dinners);
        if (b !== null && l !== null && d !== null) {
          meals = { breakfasts: b, lunches: l, dinners: d, notes: String(j.notes || '').slice(0, 200) };
        }
      }
    }
  } catch (e) { console.error('[meal-summary] AI error:', (e && e.message) ? e.message : String(e)); }

  return formatMessage(meals, startDate, endDate);
}
