/// Calendar dates in ascending order, using the delivery service's IST day.
List<DateTime> historyCalendarDates(String range, DateTime now) {
  final ist = now.toUtc().add(const Duration(hours: 5, minutes: 30));
  final today = DateTime.utc(ist.year, ist.month, ist.day);
  final start = range == 'month'
      ? DateTime.utc(today.year, today.month)
      : range == 'week'
      ? today.subtract(Duration(days: today.weekday - DateTime.monday))
      : today;
  final count = range == 'month'
      ? DateTime.utc(today.year, today.month + 1, 0).day
      : range == 'week'
      ? 7
      : 1;
  return List.generate(count, (index) => start.add(Duration(days: index)));
}
