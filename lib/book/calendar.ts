/**
 * "Add to calendar" for a requested visit: a Google Calendar link and an .ics
 * file (Apple Calendar, Outlook, anything else). Built in the browser from what
 * the booking form left in sessionStorage, so nothing personal goes in a URL
 * we serve; the Google link is opened by the customer, for their own calendar.
 */
export const VISIT_KEY = "rennbros:last-visit";

export type LastVisit = { ref: string; startAt: string; minutes: number; title: string; address: string };

export type CalendarEvent = { title: string; start: Date; end: Date; details: string; location: string };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleLink(e: CalendarEvent): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    details: e.details,
    location: e.location,
    ctz: "America/Toronto",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** RFC 5545 text: escape \ ; , and newlines; fold long lines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export function icsFile(e: CalendarEvent, uid: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Renn Bros//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@rennbros.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    fold(`SUMMARY:${esc(e.title)}`),
    fold(`DESCRIPTION:${esc(e.details)}`),
    fold(`LOCATION:${esc(e.location)}`),
    "BEGIN:VALARM",
    "TRIGGER:-PT12H",
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:${esc(e.title)}`),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
