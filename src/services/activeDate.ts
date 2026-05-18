let _date: string | null = null;

export function getActiveDate(): string {
  return _date ?? new Date().toISOString().split("T")[0];
}

export function setActiveDate(date: string): void {
  _date = date;
}
