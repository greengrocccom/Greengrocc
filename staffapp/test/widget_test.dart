import 'package:flutter_test/flutter_test.dart';
import 'package:staffapp/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    expect(const GreenGroccStaffApp(), isNotNull);
  });
}
