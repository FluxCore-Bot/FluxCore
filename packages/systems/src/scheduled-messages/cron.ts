/**
 * Lightweight cron expression utilities.
 *
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 * Uses pure date math instead of pulling in cron-parser at runtime.
 */

interface CronFields {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

function parseField(field: string, min: number, max: number): number[] {
  const values: Set<number> = new Set();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const range = stepMatch ? stepMatch[1] : part;

    if (range === "*") {
      for (let i = min; i <= max; i += step) values.add(i);
    } else if (range.includes("-")) {
      const [startStr, endStr] = range.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`Invalid cron range: ${range}`);
      for (let i = start; i <= end; i += step) values.add(i);
    } else {
      const val = parseInt(range, 10);
      if (Number.isNaN(val)) throw new Error(`Invalid cron value: ${range}`);
      values.add(val);
    }
  }

  return [...values].sort((a, b) => a - b);
}

export function parseCronExpression(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    daysOfMonth: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    daysOfWeek: parseField(parts[4], 0, 6),
  };
}

/**
 * Validate a cron expression string.
 * Returns null if valid, or an error message string.
 */
export function validateCronExpression(expr: string): string | null {
  try {
    parseCronExpression(expr);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid cron expression";
  }
}

/**
 * Calculate the next run time for a cron expression after the given date.
 * Timezone is handled by adjusting the reference date.
 */
export function getNextCronRun(cronExpr: string, timezone: string = "UTC", after?: Date): Date {
  const fields = parseCronExpression(cronExpr);
  const now = after ?? new Date();

  // Work in the specified timezone by using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getValue = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  let year = getValue("year");
  let month = getValue("month");
  let day = getValue("day");
  let hour = getValue("hour");
  let minute = getValue("minute") + 1; // Start from next minute

  // Search up to 366 days ahead
  const maxIterations = 366 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    // Handle minute overflow
    if (minute >= 60) {
      minute = 0;
      hour++;
    }
    if (hour >= 24) {
      hour = 0;
      day++;
    }

    // Handle month/day overflow
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month++;
    }
    if (month > 12) {
      month = 1;
      year++;
    }

    // Check if this time matches the cron expression
    if (!fields.months.includes(month)) {
      // Skip to the next valid month
      day = 1;
      hour = 0;
      minute = 0;
      month++;
      continue;
    }

    if (!fields.daysOfMonth.includes(day)) {
      hour = 0;
      minute = 0;
      day++;
      continue;
    }

    // Check day of week
    const candidateDate = new Date(year, month - 1, day);
    const dow = candidateDate.getDay();
    if (!fields.daysOfWeek.includes(dow)) {
      hour = 0;
      minute = 0;
      day++;
      continue;
    }

    if (!fields.hours.includes(hour)) {
      minute = 0;
      hour++;
      continue;
    }

    if (!fields.minutes.includes(minute)) {
      minute++;
      continue;
    }

    // We found a match — convert back from timezone to UTC
    const tzDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

    // Use a trick: create a date in the target timezone and find the UTC equivalent
    const utcDate = zonedToUtc(tzDateStr, timezone);

    // Ensure result is after 'now'
    if (utcDate.getTime() > now.getTime()) {
      return utcDate;
    }

    minute++;
  }

  // Fallback: 24 hours from now (should not happen with valid cron)
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Convert a date string in a specific timezone to a UTC Date.
 */
function zonedToUtc(dateStr: string, timezone: string): Date {
  if (timezone === "UTC") {
    return new Date(dateStr + "Z");
  }

  // Create a date assuming UTC first
  const utcGuess = new Date(dateStr + "Z");

  // Find the offset of the target timezone at this point in time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const getValue = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  const tzYear = getValue("year");
  const tzMonth = getValue("month");
  const tzDay = getValue("day");
  const tzHour = getValue("hour");
  const tzMinute = getValue("minute");

  // The difference between what we wanted and what the timezone shows
  // tells us the offset
  const wanted = new Date(dateStr + "Z");
  const actual = new Date(
    Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0),
  );

  const offsetMs = actual.getTime() - wanted.getTime();
  return new Date(wanted.getTime() + offsetMs);
}

/**
 * Get a human-readable description of a cron expression.
 */
export function describeCron(cronExpr: string): string {
  const presets: Record<string, string> = {
    "0 * * * *": "Every hour",
    "0 */6 * * *": "Every 6 hours",
    "0 9 * * *": "Daily at 9:00 AM",
    "0 0 * * *": "Daily at midnight",
    "0 9 * * 1": "Weekly on Monday at 9:00 AM",
    "0 9 1 * *": "Monthly on the 1st at 9:00 AM",
  };

  if (presets[cronExpr]) return presets[cronExpr];

  try {
    const fields = parseCronExpression(cronExpr);
    const parts: string[] = [];

    if (fields.minutes.length === 1 && fields.hours.length === 1) {
      parts.push(
        `at ${String(fields.hours[0]).padStart(2, "0")}:${String(fields.minutes[0]).padStart(2, "0")}`,
      );
    } else if (fields.minutes.length === 1) {
      parts.push(`at minute ${fields.minutes[0]}`);
    }

    if (fields.daysOfWeek.length < 7) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      parts.push(`on ${fields.daysOfWeek.map((d) => dayNames[d]).join(", ")}`);
    }

    if (fields.daysOfMonth.length < 31) {
      parts.push(`on day ${fields.daysOfMonth.join(", ")}`);
    }

    return parts.length > 0 ? parts.join(" ") : cronExpr;
  } catch {
    return cronExpr;
  }
}
