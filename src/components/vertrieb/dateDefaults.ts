const pad = (value: number) => String(value).padStart(2, '0');

/** Nächster Montag (an einem Montag: der Montag der Folgewoche). */
const nextMonday = () => {
  const date = new Date();
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return date;
};

/** Format für <input type="date">: YYYY-MM-DD */
export const getNextMonday = () => {
  const date = nextMonday();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Format für <input type="datetime-local">: YYYY-MM-DDTHH:mm (Standard 09:00 Uhr) */
export const getNextMondayDateTime = (time = '09:00') => `${getNextMonday()}T${time}`;

/** ISO-Zeitstempel in das Format von <input type="datetime-local"> umwandeln (lokale Zeit). */
export const toDateTimeLocal = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
