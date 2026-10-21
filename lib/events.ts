export type GreCyberSecEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location?: string;
  registrationUrl: string;
  category: string;
  image?: string;
  endAt?: string;
  timeLabel?: string;
  linkLabel?: string;
  external?: boolean;
};

export const events: readonly GreCyberSecEvent[] = [
  {
    id: "metropolis-hackathon-builder-day-london",
    title: "Metropolis Hackathon Builder Day: London",
    category: "Builder event · Hackathon · Technology",
    description: "Meet other builders, turn ideas into projects and take part in a hands-on London hackathon builder day.",
    startDate: "2026-10-02",
    endDate: "2026-10-02",
    location: "London",
    registrationUrl: "https://luma.com/metropolis-lon-oct-2026?tk=YMB9AI",
    external: true,
  },
  {
    id: "encode-london-hackathon-and-conference",
    title: "Encode London Hackathon and Conference",
    category: "Technology event · Hackathon · Community",
    description: "Connect with the wider tech community through Encode London, with three days of learning, collaboration and new ideas.",
    startDate: "2026-10-23",
    endDate: "2026-10-25",
    location: "London",
    registrationUrl: "https://luma.com/encode-london-2026?tk=gZBVvx",
    external: true,
  },
  {
    id: "beyond-the-firewall",
    title: "Beyond the Firewall",
    category: "Guest talk · Cybersecurity · Careers",
    description: "Inside the Cybersecurity Industry: a guest talk and live Q&A with Ali Mohamed.",
    startDate: "2026-10-29",
    endDate: "2026-10-29",
    endAt: "2026-10-29T16:00:00.000Z",
    timeLabel: "2:00 PM–4:00 PM",
    location: "Board Room, Dreadnought Building, University of Greenwich, London, SE10 9LS.",
    registrationUrl: "/events/beyond-the-firewall",
    linkLabel: "Event details",
    external: false,
  },
];

const londonDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

type DateParts = {
  year: string;
  month: number;
  day: string;
};

function parseDate(date: string): DateParts {
  const [year, month, day] = date.split("-");
  const monthNumber = Number(month);

  if (!year || !day || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid event date: ${date}`);
  }

  return { year, month: monthNumber, day };
}

function londonCalendarDate(now: Date): string {
  const parts = londonDateFormatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(({ type: partType }) => partType === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");

  if (!year || !month || !day) {
    throw new Error("Unable to determine the current date in Europe/London.");
  }

  return `${year}-${month}-${day}`;
}

export function isEventExpired(event: Pick<GreCyberSecEvent, "endAt" | "endDate">, now = new Date()): boolean {
  if (event.endAt) return now.getTime() >= new Date(event.endAt).getTime();
  return event.endDate < londonCalendarDate(now);
}

export function upcomingEvents(eventList: readonly GreCyberSecEvent[], now = new Date()): GreCyberSecEvent[] {
  return eventList
    .filter((event) => !isEventExpired(event, now))
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title));
}

export function pastEvents(eventList: readonly GreCyberSecEvent[], now = new Date()): GreCyberSecEvent[] {
  return eventList
    .filter((event) => isEventExpired(event, now))
    .sort((left, right) => right.endDate.localeCompare(left.endDate) || left.title.localeCompare(right.title));
}

export function formatEventDate({ startDate, endDate }: Pick<GreCyberSecEvent, "startDate" | "endDate">): string {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const startLabel = `${start.day} ${monthNames[start.month - 1]} ${start.year}`;
  const endLabel = `${end.day} ${monthNames[end.month - 1]} ${end.year}`;

  if (startDate === endDate) return startLabel;
  if (start.year === end.year && start.month === end.month) return `${start.day}–${end.day} ${monthNames[start.month - 1]} ${start.year}`;
  if (start.year === end.year) return `${start.day} ${monthNames[start.month - 1]}–${endLabel}`;
  return `${startLabel}–${endLabel}`;
}
