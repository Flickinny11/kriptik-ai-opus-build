/**
 * Date Utilities for SQLite
 * 
 * SQLite stores dates as text strings. These utilities help convert
 * between JavaScript Date objects and SQLite-compatible strings.
 */

/**
 * Convert a Date to an ISO string for SQLite storage
 */
export function toSQLiteDate(date: Date): string {
    return date.toISOString();
}

/**
 * Convert current timestamp to SQLite string
 */
export function nowSQLite(): string {
    return new Date().toISOString();
}

/**
 * Convert a SQLite date string back to Date object
 */
export function fromSQLiteDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    return new Date(dateStr);
}

/**
 * Add minutes to a date and return SQLite string
 */
export function addMinutesSQLite(date: Date, minutes: number): string {
    const newDate = new Date(date.getTime() + minutes * 60 * 1000);
    return newDate.toISOString();
}

/**
 * Add hours to a date and return SQLite string
 */
export function addHoursSQLite(date: Date, hours: number): string {
    const newDate = new Date(date.getTime() + hours * 60 * 60 * 1000);
    return newDate.toISOString();
}

/**
 * Add days to a date and return SQLite string
 */
export function addDaysSQLite(date: Date, days: number): string {
    const newDate = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    return newDate.toISOString();
}

/**
 * Check if a SQLite date string is in the past
 */
export function isPastSQLite(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
}

/**
 * Check if a SQLite date string is in the future
 */
export function isFutureSQLite(dateStr: string): boolean {
    return new Date(dateStr) > new Date();
}

