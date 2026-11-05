import 'package:deliveryapp/core/utils/history_calendar.dart';

void main() {
  void check(bool condition, String message) {
    if (!condition) throw StateError(message);
  }

  final thursday = DateTime.utc(2026, 11, 5, 6);
  final week = historyCalendarDates('week', thursday);
  check(week.length == 7, 'Week must contain seven days');
  check(week.first == DateTime.utc(2026, 11, 2), 'Week starts Monday');
  check(week.last == DateTime.utc(2026, 11, 8), 'Week ends Sunday');
  check(
    week.where((d) => d.isAfter(DateTime.utc(2026, 11, 5))).length == 3,
    'Friday through Sunday are upcoming on Thursday',
  );
  for (final year in [2024, 2026]) {
    for (var month = 1; month <= 12; month++) {
      final days = historyCalendarDates('month', DateTime.utc(year, month, 15));
      check(days.first.day == 1, 'Month starts on the first');
      check(
        days.length == DateTime.utc(year, month + 1, 0).day,
        'Month includes its exact number of days, including leap February',
      );
      check(days.every((day) => day.month == month), 'No outside dates');
    }
  }
  check(
    historyCalendarDates('day', DateTime.utc(2026, 11, 5, 18, 29)).single ==
        DateTime.utc(2026, 11, 5),
    'Before IST midnight',
  );
  check(
    historyCalendarDates('day', DateTime.utc(2026, 11, 5, 18, 30)).single ==
        DateTime.utc(2026, 11, 6),
    'Unlock next day at IST midnight',
  );
  final sunday = historyCalendarDates('week', DateTime.utc(2027, 1, 3, 6));
  check(
    sunday.first == DateTime.utc(2026, 12, 28),
    'Week crosses year boundary',
  );
  // ignore: avoid_print
  print(
    'PASS: calendar weeks, month lengths, leap year, IST midnight and year boundary',
  );
}
