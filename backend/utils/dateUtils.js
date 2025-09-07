const moment = require('moment-timezone');

/**
 * Date utility functions
 */
class DateUtils {
  /**
   * Get current timestamp
   */
  static now() {
    return new Date();
  }

  /**
   * Get current Unix timestamp
   */
  static timestamp() {
    return Date.now();
  }

  /**
   * Format date
   */
  static format(date, format = 'YYYY-MM-DD HH:mm:ss', timezone = null) {
    const m = moment(date);
    if (timezone) {
      m.tz(timezone);
    }
    return m.format(format);
  }

  /**
   * Parse date
   */
  static parse(dateString, format = null) {
    if (format) {
      return moment(dateString, format).toDate();
    }
    return moment(dateString).toDate();
  }

  /**
   * Add time to date
   */
  static add(date, amount, unit = 'days') {
    return moment(date).add(amount, unit).toDate();
  }

  /**
   * Subtract time from date
   */
  static subtract(date, amount, unit = 'days') {
    return moment(date).subtract(amount, unit).toDate();
  }

  /**
   * Get difference between dates
   */
  static diff(date1, date2, unit = 'days') {
    return moment(date1).diff(moment(date2), unit);
  }

  /**
   * Check if date is before another date
   */
  static isBefore(date1, date2) {
    return moment(date1).isBefore(date2);
  }

  /**
   * Check if date is after another date
   */
  static isAfter(date1, date2) {
    return moment(date1).isAfter(date2);
  }

  /**
   * Check if date is between two dates
   */
  static isBetween(date, startDate, endDate, inclusive = true) {
    const m = moment(date);
    return inclusive 
      ? m.isSameOrAfter(startDate) && m.isSameOrBefore(endDate)
      : m.isAfter(startDate) && m.isBefore(endDate);
  }

  /**
   * Check if date is today
   */
  static isToday(date) {
    return moment(date).isSame(moment(), 'day');
  }

  /**
   * Check if date is past
   */
  static isPast(date) {
    return moment(date).isBefore(moment());
  }

  /**
   * Check if date is future
   */
  static isFuture(date) {
    return moment(date).isAfter(moment());
  }

  /**
   * Get start of period
   */
  static startOf(date, unit = 'day') {
    return moment(date).startOf(unit).toDate();
  }

  /**
   * Get end of period
   */
  static endOf(date, unit = 'day') {
    return moment(date).endOf(unit).toDate();
  }

  /**
   * Get date range
   */
  static getDateRange(period = '30d', endDate = null) {
    const end = endDate ? moment(endDate) : moment();
    let start;

    // Parse period
    const match = period.match(/^(\d+)([dwmyMY])$/);
    if (match) {
      const [, amount, unit] = match;
      const unitMap = {
        'd': 'days',
        'w': 'weeks',
        'm': 'months',
        'M': 'months',
        'y': 'years',
        'Y': 'years'
      };
      start = moment(end).subtract(parseInt(amount), unitMap[unit]);
    } else {
      // Handle special cases
      switch (period) {
        case 'today':
          start = moment(end).startOf('day');
          break;
        case 'yesterday':
          start = moment(end).subtract(1, 'day').startOf('day');
          end.subtract(1, 'day').endOf('day');
          break;
        case 'thisWeek':
          start = moment(end).startOf('week');
          break;
        case 'lastWeek':
          start = moment(end).subtract(1, 'week').startOf('week');
          end.subtract(1, 'week').endOf('week');
          break;
        case 'thisMonth':
          start = moment(end).startOf('month');
          break;
        case 'lastMonth':
          start = moment(end).subtract(1, 'month').startOf('month');
          end.subtract(1, 'month').endOf('month');
          break;
        case 'thisYear':
          start = moment(end).startOf('year');
          break;
        case 'lastYear':
          start = moment(end).subtract(1, 'year').startOf('year');
          end.subtract(1, 'year').endOf('year');
          break;
        default:
          start = moment(end).subtract(30, 'days');
      }
    }

    return {
      start: start.toDate(),
      end: end.toDate()
    };
  }

  /**
   * Get business days between dates
   */
  static getBusinessDays(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    let businessDays = 0;

    while (start.isSameOrBefore(end)) {
      if (start.day() !== 0 && start.day() !== 6) {
        businessDays++;
      }
      start.add(1, 'day');
    }

    return businessDays;
  }

  /**
   * Add business days
   */
  static addBusinessDays(date, days) {
    const result = moment(date);
    let daysAdded = 0;

    while (daysAdded < days) {
      result.add(1, 'day');
      if (result.day() !== 0 && result.day() !== 6) {
        daysAdded++;
      }
    }

    return result.toDate();
  }

  /**
   * Format duration
   */
  static formatDuration(milliseconds, format = 'humanize') {
    const duration = moment.duration(milliseconds);

    switch (format) {
      case 'humanize':
        return duration.humanize();
      case 'detailed':
        const parts = [];
        const years = duration.years();
        const months = duration.months();
        const days = duration.days();
        const hours = duration.hours();
        const minutes = duration.minutes();

        if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
        if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

        return parts.join(', ');
      case 'short':
        if (duration.years() > 0) return `${duration.years()}y ${duration.months()}m`;
        if (duration.months() > 0) return `${duration.months()}m ${duration.days()}d`;
        if (duration.days() > 0) return `${duration.days()}d ${duration.hours()}h`;
        if (duration.hours() > 0) return `${duration.hours()}h ${duration.minutes()}m`;
        return `${duration.minutes()}m`;
      default:
        return duration.format(format);
    }
  }

  /**
   * Get relative time
   */
  static fromNow(date) {
    return moment(date).fromNow();
  }

  /**
   * Get calendar time
   */
  static calendar(date, referenceDate = null) {
    const m = moment(date);
    return referenceDate ? m.calendar(referenceDate) : m.calendar();
  }

  /**
   * Convert to timezone
   */
  static toTimezone(date, timezone) {
    return moment(date).tz(timezone).toDate();
  }

  /**
   * Get timezone offset
   */
  static getTimezoneOffset(timezone) {
    return moment.tz(timezone).utcOffset();
  }

  /**
   * Parse cron expression to next run time
   */
  static getNextCronRun(cronExpression, timezone = 'UTC') {
    // This would use a cron parser library
    // For now, return a placeholder
    return this.add(new Date(), 1, 'hour');
  }

  /**
   * Check if year is leap year
   */
  static isLeapYear(year) {
    return moment([year]).isLeapYear();
  }

  /**
   * Get days in month
   */
  static getDaysInMonth(date) {
    return moment(date).daysInMonth();
  }

  /**
   * Get week number
   */
  static getWeekNumber(date) {
    return moment(date).week();
  }

  /**
   * Get quarter
   */
  static getQuarter(date) {
    return moment(date).quarter();
  }

  /**
   * Format for API
   */
  static toISO(date) {
    return moment(date).toISOString();
  }

  /**
   * Create date from parts
   */
  static createDate(year, month, day, hour = 0, minute = 0, second = 0) {
    return moment({ year, month: month - 1, day, hour, minute, second }).toDate();
  }

  /**
   * Get age from birthdate
   */
  static getAge(birthDate) {
    return moment().diff(moment(birthDate), 'years');
  }

  /**
   * Check if date is weekend
   */
  static isWeekend(date) {
    const day = moment(date).day();
    return day === 0 || day === 6;
  }

  /**
   * Get dates between range
   */
  static getDatesBetween(startDate, endDate, unit = 'days') {
    const dates = [];
    const current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end)) {
      dates.push(current.toDate());
      current.add(1, unit);
    }

    return dates;
  }

  /**
   * Group dates by period
   */
  static groupByPeriod(dates, period = 'day') {
    const grouped = {};
    
    dates.forEach(date => {
      const key = moment(date).startOf(period).format('YYYY-MM-DD');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(date);
    });

    return grouped;
  }
}

module.exports = DateUtils;