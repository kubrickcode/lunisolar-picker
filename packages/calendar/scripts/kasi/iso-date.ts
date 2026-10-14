import { type CivilDate, civilFromEpochDay, type EpochDay, epochDayFromCivil } from '../../src/epoch-day';
import { padNumber } from '../../src/format-number';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const toIsoDate = (date: CivilDate): string =>
  `${padNumber(date.year, 4)}-${padNumber(date.month, 2)}-${padNumber(date.day, 2)}`;

export const isoDateToEpochDay = (isoDate: string): EpochDay => {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) throw new Error(`expected YYYY-MM-DD, received "${isoDate}"`);
  const epochDay = epochDayFromCivil(Number(match[1]), Number(match[2]), Number(match[3]));
  if (toIsoDate(civilFromEpochDay(epochDay)) !== isoDate) throw new Error(`"${isoDate}" is not a real calendar date`);
  return epochDay;
};
