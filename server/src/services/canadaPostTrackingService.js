/**
 * Reads the latest scan event for a PIN from the Canada Post Tracking API (v1 path, "Tracking 2.0.0").
 */
const { cpGet } = require('./canadaPostClient');

// Field names differ between the old XML API (kebab-case) and the new JSON API (camelCase),
// so read either. Confirm against a real response in the portal's "Try it" tab.
const pick = (obj, ...keys) => keys.map((k) => obj?.[k]).find((v) => v !== undefined && v !== null);

function parseSummary(data) {
  const root = pick(data, 'trackingSummary', 'tracking-summary', 'pinSummary', 'pin-summary') || data;
  const item = Array.isArray(root) ? root[0] : pick(root, 'pinSummary', 'pin-summary') || root;
  const summary = Array.isArray(item) ? item[0] : item;
  return {
    code: pick(summary, 'eventIdentifier', 'event-identifier'),
    type: pick(summary, 'eventType', 'event-type'),
    description: pick(summary, 'eventDescription', 'event-description'),
    date: pick(summary, 'eventDateTime', 'eventDate', 'event-date-time', 'event-date'),
    location: pick(summary, 'eventLocation', 'event-location'),
  };
}

async function getTrackingSummary(pin) {
  const data = await cpGet(`/tracking/v1/pins/${encodeURIComponent(pin)}/summaries`);
  return parseSummary(data);
}

module.exports = { getTrackingSummary, parseSummary };
