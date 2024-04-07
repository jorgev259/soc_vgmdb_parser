const monthLabels = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sept",
  "oct",
  "nov",
  "dec",
];

const artistStrings = [
  "artist",
  "composer",
  "lyric",
  "arranger",
  "vocal",
  "performer",
];

export const artistRegex = new RegExp(`^(${artistStrings.join("|")})+`, "i");

function formatDigits(value: string | number, digits: number = 2): string {
  return value.toLocaleString("en-US", {
    minimumIntegerDigits: digits,
    useGrouping: false,
  });
}

export function formatReleaseDate(value: string | null) {
  try {
    if (!value) return null;
    const [monthString, day, year] = value
      .split(/[, ]/g)
      .filter((c) => c.length > 1);

    if (!monthString || !day || !year) return null;

    const monthIndex = monthLabels.findIndex((m) =>
      monthString.toLowerCase().includes(m)
    );
    if (monthIndex === -1) return null;

    const month = formatDigits(monthIndex + 1, 2);
    return `${formatDigits(year, 4)}-${month}-${formatDigits(day, 2)}`;
  } catch (err) {
    return null;
  }
}

export const getClassList = (classString: string | null) =>
  classString?.split(/[,/]/).map((c) => c.trim()) ?? [];
