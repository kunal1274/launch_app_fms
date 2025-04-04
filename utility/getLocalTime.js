// utils/getLocalTime.js

/**
 * Returns the current local time as a formatted string.
 * Example: "2025-04-01 18:45:22"
 * @returns {string}
 */
export function getLocalTimeString() {
  const now = new Date();

  const pad = (num) => num.toString().padStart(2, "0");

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1); // Month is 0-indexed
  const date = pad(now.getDate());

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

// utils/getFormattedLocalDateTime.js

/**
 * Returns a detailed local date-time string in this format:
 * "2nd Apr 2025, Tuesday, 12:45 am (local time)"
 */
export function getFormattedLocalDateTime() {
  const now = new Date();

  const day = now.getDate();
  const daySuffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
      ? "nd"
      : day === 3 || day === 23
      ? "rd"
      : "th";

  const month = now.toLocaleString("default", { month: "short" }); // "Apr"
  const year = now.getFullYear();
  const weekday = now.toLocaleString("default", { weekday: "long" }); // "Tuesday"

  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12; // Convert to 12-hour format

  return `${day}${daySuffix} ${month} ${year}, ${weekday}, ${hours}:${minutes} ${ampm} (local time)`;
}
