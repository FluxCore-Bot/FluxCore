import { CronExpressionParser } from "cron-parser";

export function validateCronExpression(expr: string): string | null {
  if (!expr.trim()) return "Cron expression is empty";
  try {
    CronExpressionParser.parse(expr);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid cron expression";
  }
}

export function getNextCronRun(
  cronExpr: string,
  timezone: string = "UTC",
  after?: Date,
): Date {
  const interval = CronExpressionParser.parse(cronExpr, {
    tz: timezone,
    currentDate: after ?? new Date(),
  });
  return interval.next().toDate();
}

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
    const interval = CronExpressionParser.parse(cronExpr);
    const fields = interval.fields;
    const parts: string[] = [];

    const minutes = Array.from(fields.minute.values);
    const hours = Array.from(fields.hour.values);
    const daysOfMonth = Array.from(fields.dayOfMonth.values);
    const daysOfWeek = Array.from(fields.dayOfWeek.values);

    if (minutes.length === 1 && hours.length === 1) {
      parts.push(
        `at ${String(hours[0]).padStart(2, "0")}:${String(minutes[0]).padStart(2, "0")}`,
      );
    } else if (minutes.length === 1) {
      parts.push(`at minute ${minutes[0]}`);
    }

    if (daysOfWeek.length < 7) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      parts.push(`on ${daysOfWeek.map((d) => dayNames[Number(d)]).join(", ")}`);
    }

    if (daysOfMonth.length < 31) {
      parts.push(`on day ${daysOfMonth.join(", ")}`);
    }

    return parts.length > 0 ? parts.join(" ") : cronExpr;
  } catch {
    return cronExpr;
  }
}
