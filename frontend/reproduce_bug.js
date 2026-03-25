
const { getEventLifecycle } = require('./src/lib/eventLifecycle');

// Mock data for the problematic event
const eventData = {
    title: "test",
    id: "69c3301782aa912dabffd3a9",
    state: "live",
    start_date: "2026-03-24T23:00:00Z",
    end_date: "2026-03-25T22:59:59Z",
    event_timeline: JSON.stringify([
        {
            day_number: 1,
            slots: [
                { start_time: "01:50", end_time: "23:50" }
            ]
        }
    ]),
    event_timezone: "Africa/Casablanca"
};

// Current time from user: 2026-03-25T02:23:16+01:00
// which is 2026-03-25T01:23:16Z
const now = new Date("2026-03-25T01:23:16Z");

console.log("Current Time (UTC):", now.toISOString());
console.log("Event Data:", JSON.stringify(eventData, null, 2));

const lifecycle = getEventLifecycle(eventData, now);
console.log("\nLifecycle Result:", JSON.stringify(lifecycle, null, 2));

if (lifecycle.status !== 'live') {
    console.log("\nBUG DETECTED: Status should be 'live' but is '" + lifecycle.status + "'");
} else {
    console.log("\nStatus is correctly 'live'");
}
