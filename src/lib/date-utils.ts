import { fromZonedTime } from 'date-fns-tz';

export function toIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatTimeIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Parses a "YYYY-MM-DDTHH:mm" local string format as explicit IST (UTC+05:30).
 */
export function parseAsIST(localDateString: string): Date {
  return fromZonedTime(localDateString, 'Asia/Kolkata');
}

/**
 * Validates if a date falls within weekly availability slots (assuming slots are UTC-normalized)
 */
export function isWithinAvailability(dateStr: string, availability: any[], durationMinutes: number): boolean {
  if (!availability || availability.length === 0) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const startMinuteUTC = date.getUTCHours() * 60 + date.getUTCMinutes();
  const dayOfWeekUTC = date.getUTCDay();
  const endMinuteUTC = startMinuteUTC + durationMinutes;

  if (endMinuteUTC <= 1440) {
    return availability.some(slot => 
      slot.dayOfWeek === dayOfWeekUTC && 
      startMinuteUTC >= slot.startMinute && 
      endMinuteUTC <= slot.endMinute
    );
  } else {
    // Session spans across UTC midnight boundary
    const nextDayOfWeekUTC = (dayOfWeekUTC + 1) % 7;
    const remainingMinutes = endMinuteUTC - 1440;

    const hasFirstPart = availability.some(slot => 
      slot.dayOfWeek === dayOfWeekUTC && 
      startMinuteUTC >= slot.startMinute && 
      1440 <= slot.endMinute
    );

    const hasSecondPart = availability.some(slot => 
      slot.dayOfWeek === nextDayOfWeekUTC && 
      0 >= slot.startMinute && 
      remainingMinutes <= slot.endMinute
    );

    return hasFirstPart && hasSecondPart;
  }
}

export const formatToIST = toIST;

/**
 * Parses a UTC Date into local specific string chunks for HTML date/time inputs
 */
export function getISTInputValues(date: Date): { dateStr: string, timeStr: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(pt => [pt.type, pt.value]));
  return {
    dateStr: `${p.year}-${p.month}-${p.day}`,
    timeStr: `${p.hour}:${p.minute}`
  };
}

/**
 * Generates the next N valid available starting times for an appointment.
 */
export function generateSuggestedTimes(availability: any[], durationMinutes: number, count = 3): Date[] {
  if (!availability || availability.length === 0 || !durationMinutes) return [];
  
  const suggestions: Date[] = [];
  const now = new Date();
  const bufferMs = 30 * 60 * 1000; // minimum 30 min advance notice
  const minimumTime = now.getTime() + bufferMs;
  
  // Sort availability by dayOfWeek and startMinute
  const sortedAvail = [...availability].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startMinute - b.startMinute;
  });
  
  for (let offsetDays = 0; offsetDays <= 14; offsetDays++) {
    if (suggestions.length >= count) break;
    
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + offsetDays);
    const targetDayUTC = targetDate.getUTCDay();
    
    const daySlots = sortedAvail.filter(s => s.dayOfWeek === targetDayUTC);
    
    for (const slot of daySlots) {
      if (suggestions.length >= count) break;
      
      let currentMinute = slot.startMinute;
      const step = Math.max(30, durationMinutes);
      
      while (currentMinute + durationMinutes <= slot.endMinute && suggestions.length < count) {
        const suggestionDate = new Date(Date.UTC(
          targetDate.getUTCFullYear(),
          targetDate.getUTCMonth(),
          targetDate.getUTCDate(),
          Math.floor(currentMinute / 60),
          currentMinute % 60
        ));
        
        if (suggestionDate.getTime() >= minimumTime && isWithinAvailability(suggestionDate.toISOString(), sortedAvail, durationMinutes)) {
          suggestions.push(suggestionDate);
        }
        
        currentMinute += step;
      }
    }
  }
  
  return suggestions;
}
