export function formatToIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
