// Circular buffer: last 300 entries (5 min at 1 req/s average)
const MAX = 300;
const times = [];

function record(ms) {
  if (times.length >= MAX) times.shift();
  times.push(ms);
}

function avgLast5Min() {
  return times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;
}

module.exports = { record, avgLast5Min };
