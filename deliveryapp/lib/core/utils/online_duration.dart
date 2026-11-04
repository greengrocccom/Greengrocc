String formatOnlineDuration(int minutes) {
  return minutes <= 60 ? '$minutes min' : '${minutes ~/ 60} hr ${minutes % 60} min';
}
