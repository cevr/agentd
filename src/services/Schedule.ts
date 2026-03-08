import { Effect, Option } from "effect";
import { AgentdError } from "../errors/index.js";

export type CronSchedule = {
  readonly _tag: "Cron";
  readonly minute: number | "*";
  readonly hour: number | "*";
  readonly dayOfMonth: number | "*";
  readonly month: number | "*";
  readonly dayOfWeek: number | "*" | string;
  readonly raw: string;
};

export type OneshotSchedule = {
  readonly _tag: "Oneshot";
  readonly at: string; // ISO date string
  readonly raw: string;
};

export type Schedule = CronSchedule | OneshotSchedule;

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const IN_PATTERN = /^in\s+(\d+)\s+(minutes?|hours?|days?)$/i;
const EVERY_DAY_AT_PATTERN = /^every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
const EVERY_WEEKDAY_AT_PATTERN = /^every\s+weekday\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
const EVERY_NAMED_DAY_PATTERN =
  /^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
const TOMORROW_AT_PATTERN = /^tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
const CRON_PATTERN = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

const parseTime = (
  hourStr: string,
  minuteStr: string | undefined,
  ampm: string | undefined,
): { hour: number; minute: number } => {
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;

  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "pm" && hour !== 12) hour += 12;
    if (lower === "am" && hour === 12) hour = 0;
  }

  return { hour, minute };
};

const parseNumericField = (field: string): number | "*" => {
  if (field === "*") return "*";
  return parseInt(field, 10);
};

const parseDowField = (field: string): number | "*" | string => {
  if (field === "*") return "*";
  if (/^\d+$/.test(field)) return parseInt(field, 10);
  return field;
};

export const parse = Effect.fn("Schedule.parse")(function* (input: string, now: Date = new Date()) {
  const trimmed = input.trim();

  const result = yield* Effect.sync((): Option.Option<Schedule> => {
    // "in N minutes/hours/days"
    const inMatch = trimmed.match(IN_PATTERN);
    if (inMatch) {
      const amount = parseInt(inMatch[1]!, 10);
      const unit = inMatch[2]!.toLowerCase();
      const at = new Date(now.getTime());
      if (unit.startsWith("minute")) at.setMinutes(at.getMinutes() + amount);
      else if (unit.startsWith("hour")) at.setHours(at.getHours() + amount);
      else at.setDate(at.getDate() + amount);
      return Option.some({ _tag: "Oneshot" as const, at: at.toISOString(), raw: trimmed });
    }

    // "every day at HH:mm[am|pm]"
    const everyDayMatch = trimmed.match(EVERY_DAY_AT_PATTERN);
    if (everyDayMatch) {
      const { hour, minute } = parseTime(everyDayMatch[1]!, everyDayMatch[2], everyDayMatch[3]);
      return Option.some({
        _tag: "Cron" as const,
        minute,
        hour,
        dayOfMonth: "*" as const,
        month: "*" as const,
        dayOfWeek: "*" as const,
        raw: trimmed,
      });
    }

    // "every weekday at HH:mm[am|pm]"
    const weekdayMatch = trimmed.match(EVERY_WEEKDAY_AT_PATTERN);
    if (weekdayMatch) {
      const { hour, minute } = parseTime(weekdayMatch[1]!, weekdayMatch[2], weekdayMatch[3]);
      return Option.some({
        _tag: "Cron" as const,
        minute,
        hour,
        dayOfMonth: "*" as const,
        month: "*" as const,
        dayOfWeek: "1-5",
        raw: trimmed,
      });
    }

    // "every monday at ..."
    const namedDayMatch = trimmed.match(EVERY_NAMED_DAY_PATTERN);
    if (namedDayMatch) {
      const dow = DAY_NAMES[namedDayMatch[1]!.toLowerCase()];
      const { hour, minute } = parseTime(namedDayMatch[2]!, namedDayMatch[3], namedDayMatch[4]);
      if (dow !== undefined) {
        return Option.some({
          _tag: "Cron" as const,
          minute,
          hour,
          dayOfMonth: "*" as const,
          month: "*" as const,
          dayOfWeek: dow,
          raw: trimmed,
        });
      }
    }

    // "tomorrow at HH:mm[am|pm]"
    const tomorrowMatch = trimmed.match(TOMORROW_AT_PATTERN);
    if (tomorrowMatch) {
      const { hour, minute } = parseTime(tomorrowMatch[1]!, tomorrowMatch[2], tomorrowMatch[3]);
      const at = new Date(now.getTime());
      at.setDate(at.getDate() + 1);
      at.setHours(hour, minute, 0, 0);
      return Option.some({ _tag: "Oneshot" as const, at: at.toISOString(), raw: trimmed });
    }

    // 5-field cron
    const cronMatch = trimmed.match(CRON_PATTERN);
    if (cronMatch) {
      return Option.some({
        _tag: "Cron" as const,
        minute: parseNumericField(cronMatch[1]!),
        hour: parseNumericField(cronMatch[2]!),
        dayOfMonth: parseNumericField(cronMatch[3]!),
        month: parseNumericField(cronMatch[4]!),
        dayOfWeek: parseDowField(cronMatch[5]!),
        raw: trimmed,
      });
    }

    return Option.none();
  });

  return yield* Effect.fromOption(result).pipe(
    Effect.mapError(
      () =>
        new AgentdError({ message: `Cannot parse schedule: "${input}"`, code: "INVALID_SCHEDULE" }),
    ),
  );
});

export const describe = (schedule: Schedule): string => {
  if (schedule._tag === "Oneshot") {
    return `once at ${new Date(schedule.at).toLocaleString()}`;
  }
  const { minute, hour, dayOfWeek } = schedule;
  const timeStr =
    hour === "*"
      ? "every hour"
      : `${String(hour).padStart(2, "0")}:${String(minute === "*" ? 0 : minute).padStart(2, "0")}`;
  if (dayOfWeek === "1-5") return `weekdays at ${timeStr}`;
  if (dayOfWeek === "*") return `daily at ${timeStr}`;
  if (typeof dayOfWeek === "number") {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `every ${names[dayOfWeek]} at ${timeStr}`;
  }
  return `cron: ${schedule.raw}`;
};

export const toCalendarIntervals = (schedule: Schedule): ReadonlyArray<Record<string, number>> => {
  if (schedule._tag === "Oneshot") {
    const d = new Date(schedule.at);
    return [
      {
        Month: d.getMonth() + 1,
        Day: d.getDate(),
        Hour: d.getHours(),
        Minute: d.getMinutes(),
      },
    ];
  }

  const { minute, hour, dayOfMonth, month, dayOfWeek } = schedule;

  // Handle day range like "1-5"
  if (typeof dayOfWeek === "string" && dayOfWeek.includes("-")) {
    const [start, end] = dayOfWeek.split("-").map(Number);
    const intervals: Array<Record<string, number>> = [];
    for (let d = start!; d <= end!; d++) {
      const entry: Record<string, number> = { Weekday: d };
      if (minute !== "*") entry["Minute"] = minute;
      if (hour !== "*") entry["Hour"] = hour as number;
      if (dayOfMonth !== "*") entry["Day"] = dayOfMonth;
      if (month !== "*") entry["Month"] = month;
      intervals.push(entry);
    }
    return intervals;
  }

  const entry: Record<string, number> = {};
  if (typeof dayOfWeek === "number") entry["Weekday"] = dayOfWeek;
  if (minute !== "*") entry["Minute"] = minute;
  if (hour !== "*") entry["Hour"] = hour as number;
  if (dayOfMonth !== "*") entry["Day"] = dayOfMonth;
  if (month !== "*") entry["Month"] = month;

  return [entry];
};
