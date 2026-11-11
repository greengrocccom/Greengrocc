import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:staffapp/screens/cleaning_report_screen.dart';

void main() {
  for (final (width, height) in [(720, 480), (480, 720), (1920, 1080)]) {
    test('stamps a ${width}x$height camera JPEG with the capture time', () async {
      final source = img.Image(width: width, height: height)
        ..clear(img.ColorRgb8(30, 120, 60));
      final jpeg = Uint8List.fromList(img.encodeJpg(source));
      final label = formatCleaningTimestamp(DateTime.utc(2026, 11, 10, 16, 46, 42));
      expect(label, '10 Nov 2026, 10:16:42 PM IST');

      final stamped = await compute(stampCleaningPhoto, (jpeg, label));
      final result = img.decodeJpg(stamped)!;
      expect(result.width, width);
      expect(result.height, height);

      final bottomLeft = result.getPixel(2, height - 2);
      expect(bottomLeft.g, lessThan(80), reason: 'dark stamp strip is drawn at the bottom');
      final top = result.getPixel(width ~/ 2, 5);
      expect(top.g, greaterThan(100), reason: 'rest of the photo is untouched');
    });
  }
}
