import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

enum LivenessChallenge {
  centerFace,
  blink,
  lookLeft,
  lookRight,
  lookUp,
}

extension LivenessChallengeX on LivenessChallenge {
  String instruction(AppLocalizations l10n) => switch (this) {
        LivenessChallenge.centerFace => l10n.livenessCenterFace,
        LivenessChallenge.blink => l10n.livenessBlink,
        LivenessChallenge.lookLeft => l10n.livenessLookLeft,
        LivenessChallenge.lookRight => l10n.livenessLookRight,
        LivenessChallenge.lookUp => l10n.livenessLookUp,
      };

  IconData get hintIcon => switch (this) {
        LivenessChallenge.centerFace => Icons.face_retouching_natural_rounded,
        LivenessChallenge.blink => Icons.visibility_rounded,
        LivenessChallenge.lookLeft => Icons.arrow_back_rounded,
        LivenessChallenge.lookRight => Icons.arrow_forward_rounded,
        LivenessChallenge.lookUp => Icons.arrow_upward_rounded,
      };
}
