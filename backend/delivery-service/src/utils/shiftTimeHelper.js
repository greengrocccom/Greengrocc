/** Converts "09:30 AM" or "17:30" to minutes from start of day */
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const s = String(timeStr).trim().toUpperCase();
  const isPM = s.includes("PM");
  const isAM = s.includes("AM");
  const clean = s.replace(/AM|PM/g, "").trim();
  const [hStr, mStr] = clean.split(":");
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  return h * 60 + m;
};

export const getCurrentMinutesIST = (now = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  return timeToMinutes(formatter.format(now));
};

/**
 * True when a slot has ended.
 * Overnight slots (end <= start) are NOT treated as ended during daytime
 * on the start calendar day — use dateString vs today for past days.
 */
export const isSlotEnded = (
  startTime,
  endTime,
  currentMinutes,
  dateString = "",
  todayStr = ""
) => {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (dateString && todayStr) {
    if (dateString < todayStr) {
      // Past calendar day — overnight may still run into early morning today
      if (endMin <= startMin) {
        const nextDay = addIstDays(dateString, 1);
        if (todayStr === nextDay && currentMinutes < endMin) return false;
      }
      return true;
    }
    if (dateString > todayStr) return false;
  }

  // Same calendar day
  if (endMin > startMin) {
    return currentMinutes >= endMin;
  }

  // Overnight starting today: still active from start → midnight; not "ended" until next day
  return false;
};

/** True when current time is inside the slot window (supports overnight slots). */
export const isWithinSlot = (startTime, endTime, currentMinutes, earlyMinutes = 0) => {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const allowedStart = Math.max(0, startMin - earlyMinutes);

  if (endMin > startMin) {
    return currentMinutes >= allowedStart && currentMinutes < endMin;
  }

  return currentMinutes >= allowedStart || currentMinutes < endMin;
};

/** upcoming | current | past — for DM dashboard tabs */
export const getSlotLifecycle = (
  dateString,
  startTime,
  endTime,
  todayStr,
  currentMinutes = getCurrentMinutesIST()
) => {
  if (!dateString) return "upcoming";
  if (dateString > todayStr) return "upcoming";

  if (dateString < todayStr) {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      const nextDay = addIstDays(dateString, 1);
      if (todayStr === nextDay && currentMinutes < endMin) return "current";
    }
    return "past";
  }

  // Same day
  if (isWithinSlot(startTime, endTime, currentMinutes)) return "current";
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (endMin > startMin) {
    if (currentMinutes < startMin) return "upcoming";
    return "past";
  }
  // Overnight tonight
  if (currentMinutes < startMin) return "upcoming";
  return "current";
};

function addIstDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00+05:30`);
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
