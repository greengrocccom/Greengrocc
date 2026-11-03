import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_mr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('mr'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'GG delivery partner'**
  String get appTitle;

  /// No description provided for @brandName.
  ///
  /// In en, this message translates to:
  /// **'GreenGroc'**
  String get brandName;

  /// No description provided for @deliveryPartner.
  ///
  /// In en, this message translates to:
  /// **'Delivery Partner'**
  String get deliveryPartner;

  /// No description provided for @splashFooterTagline.
  ///
  /// In en, this message translates to:
  /// **'GreenGroc · Delivery Partner App'**
  String get splashFooterTagline;

  /// No description provided for @featureFastDelivery.
  ///
  /// In en, this message translates to:
  /// **'Fast\nDelivery'**
  String get featureFastDelivery;

  /// No description provided for @featureSafeSecure.
  ///
  /// In en, this message translates to:
  /// **'Safe &\nSecure'**
  String get featureSafeSecure;

  /// No description provided for @featureEarnMore.
  ///
  /// In en, this message translates to:
  /// **'Earn\nMore'**
  String get featureEarnMore;

  /// No description provided for @deliverSafeEarnMore.
  ///
  /// In en, this message translates to:
  /// **'Deliver Safe, Earn More'**
  String get deliverSafeEarnMore;

  /// No description provided for @followSafetyGuidelines.
  ///
  /// In en, this message translates to:
  /// **'Follow all safety guidelines and keep your ratings high!'**
  String get followSafetyGuidelines;

  /// No description provided for @trustedByPartnersIndia.
  ///
  /// In en, this message translates to:
  /// **'Trusted by delivery partners across India'**
  String get trustedByPartnersIndia;

  /// No description provided for @chooseLanguage.
  ///
  /// In en, this message translates to:
  /// **'Choose Language'**
  String get chooseLanguage;

  /// No description provided for @selectLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select your preferred language to continue'**
  String get selectLanguageSubtitle;

  /// No description provided for @continueButton.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueButton;

  /// No description provided for @saveLanguage.
  ///
  /// In en, this message translates to:
  /// **'Save Language'**
  String get saveLanguage;

  /// No description provided for @languageChanged.
  ///
  /// In en, this message translates to:
  /// **'Language updated successfully'**
  String get languageChanged;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageHindi.
  ///
  /// In en, this message translates to:
  /// **'Hindi'**
  String get languageHindi;

  /// No description provided for @languageMarathi.
  ///
  /// In en, this message translates to:
  /// **'Marathi'**
  String get languageMarathi;

  /// No description provided for @languageTamil.
  ///
  /// In en, this message translates to:
  /// **'Tamil'**
  String get languageTamil;

  /// No description provided for @languageTelugu.
  ///
  /// In en, this message translates to:
  /// **'Telugu'**
  String get languageTelugu;

  /// No description provided for @languageKannada.
  ///
  /// In en, this message translates to:
  /// **'Kannada'**
  String get languageKannada;

  /// No description provided for @loginWithPhone.
  ///
  /// In en, this message translates to:
  /// **'Login with Phone'**
  String get loginWithPhone;

  /// No description provided for @enterOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter OTP'**
  String get enterOtp;

  /// No description provided for @otpSentMessage.
  ///
  /// In en, this message translates to:
  /// **'We sent a 6-digit code to your number'**
  String get otpSentMessage;

  /// No description provided for @enterMobileToContinue.
  ///
  /// In en, this message translates to:
  /// **'Enter your mobile number to continue'**
  String get enterMobileToContinue;

  /// No description provided for @mobileNumber.
  ///
  /// In en, this message translates to:
  /// **'Mobile Number'**
  String get mobileNumber;

  /// No description provided for @mobileNumberHint.
  ///
  /// In en, this message translates to:
  /// **'10-digit mobile number'**
  String get mobileNumberHint;

  /// No description provided for @countryCodePrefix.
  ///
  /// In en, this message translates to:
  /// **'+91  '**
  String get countryCodePrefix;

  /// No description provided for @otp.
  ///
  /// In en, this message translates to:
  /// **'OTP'**
  String get otp;

  /// No description provided for @otpHint.
  ///
  /// In en, this message translates to:
  /// **'Enter 6-digit OTP'**
  String get otpHint;

  /// No description provided for @resendOtp.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP'**
  String get resendOtp;

  /// No description provided for @sendOtp.
  ///
  /// In en, this message translates to:
  /// **'Send OTP'**
  String get sendOtp;

  /// No description provided for @verifyAndContinue.
  ///
  /// In en, this message translates to:
  /// **'Verify & Continue'**
  String get verifyAndContinue;

  /// No description provided for @changeNumber.
  ///
  /// In en, this message translates to:
  /// **'Change number'**
  String get changeNumber;

  /// No description provided for @needHelp.
  ///
  /// In en, this message translates to:
  /// **'Need help?'**
  String get needHelp;

  /// No description provided for @selectVehicle.
  ///
  /// In en, this message translates to:
  /// **'Select vehicle'**
  String get selectVehicle;

  /// No description provided for @vehicleMotorcycle.
  ///
  /// In en, this message translates to:
  /// **'Motorcycle'**
  String get vehicleMotorcycle;

  /// No description provided for @vehicleBicycle.
  ///
  /// In en, this message translates to:
  /// **'Bicycle'**
  String get vehicleBicycle;

  /// No description provided for @vehicleElectricScooter.
  ///
  /// In en, this message translates to:
  /// **'Electric scooter'**
  String get vehicleElectricScooter;

  /// No description provided for @vehicleVan.
  ///
  /// In en, this message translates to:
  /// **'Van'**
  String get vehicleVan;

  /// No description provided for @noVehicle.
  ///
  /// In en, this message translates to:
  /// **'I don\'t have a vehicle'**
  String get noVehicle;

  /// No description provided for @noVehicleSubtitle.
  ///
  /// In en, this message translates to:
  /// **'No vehicle? We\'ll help!'**
  String get noVehicleSubtitle;

  /// No description provided for @next.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get next;

  /// No description provided for @selectCity.
  ///
  /// In en, this message translates to:
  /// **'Select City'**
  String get selectCity;

  /// No description provided for @whereWillYouDeliver.
  ///
  /// In en, this message translates to:
  /// **'Where will you deliver?'**
  String get whereWillYouDeliver;

  /// No description provided for @searchCity.
  ///
  /// In en, this message translates to:
  /// **'Search city'**
  String get searchCity;

  /// No description provided for @cityMumbai.
  ///
  /// In en, this message translates to:
  /// **'Mumbai'**
  String get cityMumbai;

  /// No description provided for @cityPune.
  ///
  /// In en, this message translates to:
  /// **'Pune'**
  String get cityPune;

  /// No description provided for @cityNagpur.
  ///
  /// In en, this message translates to:
  /// **'Nagpur'**
  String get cityNagpur;

  /// No description provided for @cityNashik.
  ///
  /// In en, this message translates to:
  /// **'Nashik'**
  String get cityNashik;

  /// No description provided for @cityThane.
  ///
  /// In en, this message translates to:
  /// **'Thane'**
  String get cityThane;

  /// No description provided for @cityAurangabad.
  ///
  /// In en, this message translates to:
  /// **'Aurangabad'**
  String get cityAurangabad;

  /// No description provided for @cityDelhi.
  ///
  /// In en, this message translates to:
  /// **'Delhi'**
  String get cityDelhi;

  /// No description provided for @cityBengaluru.
  ///
  /// In en, this message translates to:
  /// **'Bengaluru'**
  String get cityBengaluru;

  /// No description provided for @cityHyderabad.
  ///
  /// In en, this message translates to:
  /// **'Hyderabad'**
  String get cityHyderabad;

  /// No description provided for @cityChennai.
  ///
  /// In en, this message translates to:
  /// **'Chennai'**
  String get cityChennai;

  /// No description provided for @cityKolkata.
  ///
  /// In en, this message translates to:
  /// **'Kolkata'**
  String get cityKolkata;

  /// No description provided for @cityAhmedabad.
  ///
  /// In en, this message translates to:
  /// **'Ahmedabad'**
  String get cityAhmedabad;

  /// No description provided for @citySurat.
  ///
  /// In en, this message translates to:
  /// **'Surat'**
  String get citySurat;

  /// No description provided for @cityJaipur.
  ///
  /// In en, this message translates to:
  /// **'Jaipur'**
  String get cityJaipur;

  /// No description provided for @cityLucknow.
  ///
  /// In en, this message translates to:
  /// **'Lucknow'**
  String get cityLucknow;

  /// No description provided for @cityIndore.
  ///
  /// In en, this message translates to:
  /// **'Indore'**
  String get cityIndore;

  /// No description provided for @uploadDocuments.
  ///
  /// In en, this message translates to:
  /// **'Upload Documents'**
  String get uploadDocuments;

  /// No description provided for @uploadDocumentsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Complete all documents and payment details to continue'**
  String get uploadDocumentsSubtitle;

  /// No description provided for @identityDocuments.
  ///
  /// In en, this message translates to:
  /// **'Identity Documents'**
  String get identityDocuments;

  /// No description provided for @aadhaarCard.
  ///
  /// In en, this message translates to:
  /// **'Aadhaar Card'**
  String get aadhaarCard;

  /// No description provided for @aadhaarCardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Front side clearly visible'**
  String get aadhaarCardSubtitle;

  /// No description provided for @panCard.
  ///
  /// In en, this message translates to:
  /// **'PAN Card'**
  String get panCard;

  /// No description provided for @panCardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Clear photo of PAN'**
  String get panCardSubtitle;

  /// No description provided for @passportSizePhoto.
  ///
  /// In en, this message translates to:
  /// **'Passport Size Photo'**
  String get passportSizePhoto;

  /// No description provided for @passportSizePhotoSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Recent passport-size photo'**
  String get passportSizePhotoSubtitle;

  /// No description provided for @drivingLicense.
  ///
  /// In en, this message translates to:
  /// **'Driving License'**
  String get drivingLicense;

  /// No description provided for @drivingLicenseSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Valid driving license'**
  String get drivingLicenseSubtitle;

  /// No description provided for @vehicleDocuments.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Documents'**
  String get vehicleDocuments;

  /// No description provided for @vehicleRc.
  ///
  /// In en, this message translates to:
  /// **'Vehicle RC'**
  String get vehicleRc;

  /// No description provided for @vehicleRcSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Registration certificate'**
  String get vehicleRcSubtitle;

  /// No description provided for @insurance.
  ///
  /// In en, this message translates to:
  /// **'Insurance'**
  String get insurance;

  /// No description provided for @insuranceSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Valid vehicle insurance'**
  String get insuranceSubtitle;

  /// No description provided for @policeVerification.
  ///
  /// In en, this message translates to:
  /// **'Police Verification'**
  String get policeVerification;

  /// No description provided for @policeVerificationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Police clearance certificate / verification copy'**
  String get policeVerificationSubtitle;

  /// No description provided for @bankDetails.
  ///
  /// In en, this message translates to:
  /// **'Bank Details'**
  String get bankDetails;

  /// No description provided for @accountHolderName.
  ///
  /// In en, this message translates to:
  /// **'Account Holder Name'**
  String get accountHolderName;

  /// No description provided for @accountHolderNameHint.
  ///
  /// In en, this message translates to:
  /// **'Name as per bank account'**
  String get accountHolderNameHint;

  /// No description provided for @bankName.
  ///
  /// In en, this message translates to:
  /// **'Bank Name'**
  String get bankName;

  /// No description provided for @bankNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. HDFC Bank'**
  String get bankNameHint;

  /// No description provided for @accountNumber.
  ///
  /// In en, this message translates to:
  /// **'Account Number'**
  String get accountNumber;

  /// No description provided for @accountNumberHint.
  ///
  /// In en, this message translates to:
  /// **'Enter account number'**
  String get accountNumberHint;

  /// No description provided for @ifscCode.
  ///
  /// In en, this message translates to:
  /// **'IFSC Code'**
  String get ifscCode;

  /// No description provided for @ifscCodeHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. HDFC0001234'**
  String get ifscCodeHint;

  /// No description provided for @upiId.
  ///
  /// In en, this message translates to:
  /// **'UPI ID'**
  String get upiId;

  /// No description provided for @upiIdHint.
  ///
  /// In en, this message translates to:
  /// **'yourname@upi'**
  String get upiIdHint;

  /// No description provided for @uploadDocumentSheetTitle.
  ///
  /// In en, this message translates to:
  /// **'Upload document'**
  String get uploadDocumentSheetTitle;

  /// No description provided for @takePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get takePhoto;

  /// No description provided for @chooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get chooseFromGallery;

  /// No description provided for @uploadedTapToChange.
  ///
  /// In en, this message translates to:
  /// **'Uploaded · Tap to change'**
  String get uploadedTapToChange;

  /// No description provided for @takeRecentPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a Recent Photo'**
  String get takeRecentPhoto;

  /// No description provided for @selfieCaptureSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Capture a clear live selfie, then complete face verification'**
  String get selfieCaptureSubtitle;

  /// No description provided for @cameraPreview.
  ///
  /// In en, this message translates to:
  /// **'Camera preview'**
  String get cameraPreview;

  /// No description provided for @faceClearlyVisible.
  ///
  /// In en, this message translates to:
  /// **'Make sure your face is clearly visible'**
  String get faceClearlyVisible;

  /// No description provided for @selfieNextStepHint.
  ///
  /// In en, this message translates to:
  /// **'Great! Next you\'ll blink and move your head on camera'**
  String get selfieNextStepHint;

  /// No description provided for @openCamera.
  ///
  /// In en, this message translates to:
  /// **'Open Camera'**
  String get openCamera;

  /// No description provided for @continueToVerification.
  ///
  /// In en, this message translates to:
  /// **'Continue to Verification'**
  String get continueToVerification;

  /// No description provided for @retakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Retake Photo'**
  String get retakePhoto;

  /// No description provided for @faceVerification.
  ///
  /// In en, this message translates to:
  /// **'Face Verification'**
  String get faceVerification;

  /// No description provided for @verificationComplete.
  ///
  /// In en, this message translates to:
  /// **'Verification Complete'**
  String get verificationComplete;

  /// No description provided for @livenessFollowPrompts.
  ///
  /// In en, this message translates to:
  /// **'Follow the on-screen prompts to verify it\'s really you'**
  String get livenessFollowPrompts;

  /// No description provided for @livenessSuccessMessage.
  ///
  /// In en, this message translates to:
  /// **'Your live identity check was successful'**
  String get livenessSuccessMessage;

  /// No description provided for @allChecksPassed.
  ///
  /// In en, this message translates to:
  /// **'All checks passed'**
  String get allChecksPassed;

  /// No description provided for @keepFaceInCircle.
  ///
  /// In en, this message translates to:
  /// **'Keep your face inside the circle'**
  String get keepFaceInCircle;

  /// No description provided for @continueToApp.
  ///
  /// In en, this message translates to:
  /// **'Continue to App'**
  String get continueToApp;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get tryAgain;

  /// No description provided for @cameraAccessError.
  ///
  /// In en, this message translates to:
  /// **'Could not open camera. Please allow camera access and try again.'**
  String get cameraAccessError;

  /// No description provided for @livenessCenterFace.
  ///
  /// In en, this message translates to:
  /// **'Center your face in the circle'**
  String get livenessCenterFace;

  /// No description provided for @livenessBlink.
  ///
  /// In en, this message translates to:
  /// **'Blink your eyes'**
  String get livenessBlink;

  /// No description provided for @livenessLookLeft.
  ///
  /// In en, this message translates to:
  /// **'Turn your head left'**
  String get livenessLookLeft;

  /// No description provided for @livenessLookRight.
  ///
  /// In en, this message translates to:
  /// **'Turn your head right'**
  String get livenessLookRight;

  /// No description provided for @livenessLookUp.
  ///
  /// In en, this message translates to:
  /// **'Look up'**
  String get livenessLookUp;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @orders.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get orders;

  /// No description provided for @navigation.
  ///
  /// In en, this message translates to:
  /// **'Navigation'**
  String get navigation;

  /// No description provided for @map.
  ///
  /// In en, this message translates to:
  /// **'Map'**
  String get map;

  /// No description provided for @wallet.
  ///
  /// In en, this message translates to:
  /// **'Wallet'**
  String get wallet;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @activeOrders.
  ///
  /// In en, this message translates to:
  /// **'Active Orders'**
  String get activeOrders;

  /// No description provided for @history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get history;

  /// No description provided for @attendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get attendance;

  /// No description provided for @performance.
  ///
  /// In en, this message translates to:
  /// **'Performance'**
  String get performance;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @documents.
  ///
  /// In en, this message translates to:
  /// **'Documents'**
  String get documents;

  /// No description provided for @vehicle.
  ///
  /// In en, this message translates to:
  /// **'Vehicle'**
  String get vehicle;

  /// No description provided for @support.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get support;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @goodMorning.
  ///
  /// In en, this message translates to:
  /// **'Good Morning 👋'**
  String get goodMorning;

  /// No description provided for @beSafeDeliverHappiness.
  ///
  /// In en, this message translates to:
  /// **'Be safe and deliver happiness'**
  String get beSafeDeliverHappiness;

  /// No description provided for @online.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get online;

  /// No description provided for @offline.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get offline;

  /// No description provided for @todaysEarnings.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Earnings'**
  String get todaysEarnings;

  /// No description provided for @tapToViewDetails.
  ///
  /// In en, this message translates to:
  /// **'Tap to view details'**
  String get tapToViewDetails;

  /// No description provided for @todaysDeliveries.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Deliveries'**
  String get todaysDeliveries;

  /// No description provided for @completedToday.
  ///
  /// In en, this message translates to:
  /// **'Completed today'**
  String get completedToday;

  /// No description provided for @performanceScore.
  ///
  /// In en, this message translates to:
  /// **'Performance Score'**
  String get performanceScore;

  /// No description provided for @thisWeek.
  ///
  /// In en, this message translates to:
  /// **'This week'**
  String get thisWeek;

  /// No description provided for @customerRating.
  ///
  /// In en, this message translates to:
  /// **'Customer Rating'**
  String get customerRating;

  /// No description provided for @averageRating.
  ///
  /// In en, this message translates to:
  /// **'Average rating'**
  String get averageRating;

  /// No description provided for @activeDelivery.
  ///
  /// In en, this message translates to:
  /// **'Active Delivery'**
  String get activeDelivery;

  /// No description provided for @inProgress.
  ///
  /// In en, this message translates to:
  /// **'In Progress'**
  String get inProgress;

  /// No description provided for @viewDetails.
  ///
  /// In en, this message translates to:
  /// **'View details'**
  String get viewDetails;

  /// No description provided for @pickUp.
  ///
  /// In en, this message translates to:
  /// **'Pick Up'**
  String get pickUp;

  /// No description provided for @storeLocation.
  ///
  /// In en, this message translates to:
  /// **'Store location'**
  String get storeLocation;

  /// No description provided for @dropOff.
  ///
  /// In en, this message translates to:
  /// **'Drop Off'**
  String get dropOff;

  /// No description provided for @customerLocation.
  ///
  /// In en, this message translates to:
  /// **'Customer location'**
  String get customerLocation;

  /// No description provided for @quickActions.
  ///
  /// In en, this message translates to:
  /// **'Quick Actions'**
  String get quickActions;

  /// No description provided for @seeAll.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get seeAll;

  /// No description provided for @newOrders.
  ///
  /// In en, this message translates to:
  /// **'New Orders'**
  String get newOrders;

  /// No description provided for @navigate.
  ///
  /// In en, this message translates to:
  /// **'Navigate'**
  String get navigate;

  /// No description provided for @recentOrders.
  ///
  /// In en, this message translates to:
  /// **'Recent Orders'**
  String get recentOrders;

  /// No description provided for @acceptanceRate.
  ///
  /// In en, this message translates to:
  /// **'Acceptance Rate'**
  String get acceptanceRate;

  /// No description provided for @last7Days.
  ///
  /// In en, this message translates to:
  /// **'Last 7 days'**
  String get last7Days;

  /// No description provided for @placeholderStoreName.
  ///
  /// In en, this message translates to:
  /// **'Store Name'**
  String get placeholderStoreName;

  /// No description provided for @placeholderCustomerName.
  ///
  /// In en, this message translates to:
  /// **'Customer Name'**
  String get placeholderCustomerName;

  /// No description provided for @placeholderPickupAddress.
  ///
  /// In en, this message translates to:
  /// **'Pickup address'**
  String get placeholderPickupAddress;

  /// No description provided for @placeholderDropAddress.
  ///
  /// In en, this message translates to:
  /// **'Drop address'**
  String get placeholderDropAddress;

  /// No description provided for @placeholderDistanceKm.
  ///
  /// In en, this message translates to:
  /// **'— km'**
  String get placeholderDistanceKm;

  /// No description provided for @placeholderEarnings.
  ///
  /// In en, this message translates to:
  /// **'₹ —'**
  String get placeholderEarnings;

  /// No description provided for @placeholderTimeMin.
  ///
  /// In en, this message translates to:
  /// **'— min'**
  String get placeholderTimeMin;

  /// No description provided for @placeholderPercent.
  ///
  /// In en, this message translates to:
  /// **'—%'**
  String get placeholderPercent;

  /// No description provided for @placeholderDash.
  ///
  /// In en, this message translates to:
  /// **'—'**
  String get placeholderDash;

  /// No description provided for @newOrdersSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Accept orders to start earning'**
  String get newOrdersSubtitle;

  /// No description provided for @placeholderPickupAddressLine.
  ///
  /// In en, this message translates to:
  /// **'Pickup address line'**
  String get placeholderPickupAddressLine;

  /// No description provided for @placeholderDropAddressLine.
  ///
  /// In en, this message translates to:
  /// **'Drop address line'**
  String get placeholderDropAddressLine;

  /// No description provided for @statusNew.
  ///
  /// In en, this message translates to:
  /// **'New'**
  String get statusNew;

  /// No description provided for @pickup.
  ///
  /// In en, this message translates to:
  /// **'Pickup'**
  String get pickup;

  /// No description provided for @drop.
  ///
  /// In en, this message translates to:
  /// **'Drop'**
  String get drop;

  /// No description provided for @reject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get reject;

  /// No description provided for @accept.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get accept;

  /// No description provided for @orderInProgress.
  ///
  /// In en, this message translates to:
  /// **'Order in progress'**
  String get orderInProgress;

  /// No description provided for @headingToPickup.
  ///
  /// In en, this message translates to:
  /// **'Heading to Pickup'**
  String get headingToPickup;

  /// No description provided for @storeAddress.
  ///
  /// In en, this message translates to:
  /// **'Store address'**
  String get storeAddress;

  /// No description provided for @customer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get customer;

  /// No description provided for @deliveryAddress.
  ///
  /// In en, this message translates to:
  /// **'Delivery address'**
  String get deliveryAddress;

  /// No description provided for @deliveryOtp.
  ///
  /// In en, this message translates to:
  /// **'Delivery OTP'**
  String get deliveryOtp;

  /// No description provided for @otpPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'— — — —'**
  String get otpPlaceholder;

  /// No description provided for @askCustomerForOtp.
  ///
  /// In en, this message translates to:
  /// **'Ask customer for OTP'**
  String get askCustomerForOtp;

  /// No description provided for @timelineAssigned.
  ///
  /// In en, this message translates to:
  /// **'Assigned'**
  String get timelineAssigned;

  /// No description provided for @timelineAssignedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Order assigned to you'**
  String get timelineAssignedSubtitle;

  /// No description provided for @timelinePickUp.
  ///
  /// In en, this message translates to:
  /// **'Pick Up'**
  String get timelinePickUp;

  /// No description provided for @timelinePickUpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Collect from store'**
  String get timelinePickUpSubtitle;

  /// No description provided for @timelineDelivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get timelineDelivered;

  /// No description provided for @timelineDeliveredSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Hand over to customer'**
  String get timelineDeliveredSubtitle;

  /// No description provided for @callCustomer.
  ///
  /// In en, this message translates to:
  /// **'Call Customer'**
  String get callCustomer;

  /// No description provided for @pickedUp.
  ///
  /// In en, this message translates to:
  /// **'Picked up'**
  String get pickedUp;

  /// No description provided for @delivered.
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get delivered;

  /// No description provided for @liveMap.
  ///
  /// In en, this message translates to:
  /// **'Live Map'**
  String get liveMap;

  /// No description provided for @mapIntegrationComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Map integration coming soon'**
  String get mapIntegrationComingSoon;

  /// No description provided for @enRoute.
  ///
  /// In en, this message translates to:
  /// **'En Route'**
  String get enRoute;

  /// No description provided for @etaMin.
  ///
  /// In en, this message translates to:
  /// **'ETA — min'**
  String get etaMin;

  /// No description provided for @store.
  ///
  /// In en, this message translates to:
  /// **'Store'**
  String get store;

  /// No description provided for @distance.
  ///
  /// In en, this message translates to:
  /// **'Distance'**
  String get distance;

  /// No description provided for @distanceRemaining.
  ///
  /// In en, this message translates to:
  /// **'— km remaining'**
  String get distanceRemaining;

  /// No description provided for @deliveryHistory.
  ///
  /// In en, this message translates to:
  /// **'Delivery History'**
  String get deliveryHistory;

  /// No description provided for @today.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get today;

  /// No description provided for @week.
  ///
  /// In en, this message translates to:
  /// **'Week'**
  String get week;

  /// No description provided for @month.
  ///
  /// In en, this message translates to:
  /// **'Month'**
  String get month;

  /// No description provided for @orderId.
  ///
  /// In en, this message translates to:
  /// **'Order ID —'**
  String get orderId;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @labelWithColon.
  ///
  /// In en, this message translates to:
  /// **'{label}:'**
  String labelWithColon(String label);

  /// No description provided for @earnings.
  ///
  /// In en, this message translates to:
  /// **'Earnings'**
  String get earnings;

  /// No description provided for @trackYourIncome.
  ///
  /// In en, this message translates to:
  /// **'Track your income'**
  String get trackYourIncome;

  /// No description provided for @updatedLive.
  ///
  /// In en, this message translates to:
  /// **'Updated live'**
  String get updatedLive;

  /// No description provided for @weekly.
  ///
  /// In en, this message translates to:
  /// **'Weekly'**
  String get weekly;

  /// No description provided for @monthly.
  ///
  /// In en, this message translates to:
  /// **'Monthly'**
  String get monthly;

  /// No description provided for @bonus.
  ///
  /// In en, this message translates to:
  /// **'Bonus'**
  String get bonus;

  /// No description provided for @incentives.
  ///
  /// In en, this message translates to:
  /// **'Incentives'**
  String get incentives;

  /// No description provided for @earningsChart.
  ///
  /// In en, this message translates to:
  /// **'Earnings Chart'**
  String get earningsChart;

  /// No description provided for @transactions.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get transactions;

  /// No description provided for @deliveryPayment.
  ///
  /// In en, this message translates to:
  /// **'Delivery Payment'**
  String get deliveryPayment;

  /// No description provided for @dayMon.
  ///
  /// In en, this message translates to:
  /// **'M'**
  String get dayMon;

  /// No description provided for @dayTue.
  ///
  /// In en, this message translates to:
  /// **'T'**
  String get dayTue;

  /// No description provided for @dayWed.
  ///
  /// In en, this message translates to:
  /// **'W'**
  String get dayWed;

  /// No description provided for @dayThu.
  ///
  /// In en, this message translates to:
  /// **'T'**
  String get dayThu;

  /// No description provided for @dayFri.
  ///
  /// In en, this message translates to:
  /// **'F'**
  String get dayFri;

  /// No description provided for @daySat.
  ///
  /// In en, this message translates to:
  /// **'S'**
  String get daySat;

  /// No description provided for @daySun.
  ///
  /// In en, this message translates to:
  /// **'S'**
  String get daySun;

  /// No description provided for @walletBalance.
  ///
  /// In en, this message translates to:
  /// **'Wallet Balance'**
  String get walletBalance;

  /// No description provided for @withdraw.
  ///
  /// In en, this message translates to:
  /// **'Withdraw'**
  String get withdraw;

  /// No description provided for @manageYourEarnings.
  ///
  /// In en, this message translates to:
  /// **'Manage your earnings'**
  String get manageYourEarnings;

  /// No description provided for @recentTransactions.
  ///
  /// In en, this message translates to:
  /// **'Recent Transactions'**
  String get recentTransactions;

  /// No description provided for @accountHolder.
  ///
  /// In en, this message translates to:
  /// **'Account Holder'**
  String get accountHolder;

  /// No description provided for @accountNumberMasked.
  ///
  /// In en, this message translates to:
  /// **'— — — —'**
  String get accountNumberMasked;

  /// No description provided for @transaction.
  ///
  /// In en, this message translates to:
  /// **'Transaction'**
  String get transaction;

  /// No description provided for @trackWorkingHours.
  ///
  /// In en, this message translates to:
  /// **'Track your working hours'**
  String get trackWorkingHours;

  /// No description provided for @monthYear.
  ///
  /// In en, this message translates to:
  /// **'Month Year'**
  String get monthYear;

  /// No description provided for @loginTime.
  ///
  /// In en, this message translates to:
  /// **'Login Time'**
  String get loginTime;

  /// No description provided for @logoutTime.
  ///
  /// In en, this message translates to:
  /// **'Logout Time'**
  String get logoutTime;

  /// No description provided for @workingHours.
  ///
  /// In en, this message translates to:
  /// **'Working Hours'**
  String get workingHours;

  /// No description provided for @breakTime.
  ///
  /// In en, this message translates to:
  /// **'Break Time'**
  String get breakTime;

  /// No description provided for @timePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'— : —'**
  String get timePlaceholder;

  /// No description provided for @workingHoursPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'— h — m'**
  String get workingHoursPlaceholder;

  /// No description provided for @breakTimePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'— m'**
  String get breakTimePlaceholder;

  /// No description provided for @attendanceHistory.
  ///
  /// In en, this message translates to:
  /// **'Attendance History'**
  String get attendanceHistory;

  /// No description provided for @datePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Date —'**
  String get datePlaceholder;

  /// No description provided for @hoursWorked.
  ///
  /// In en, this message translates to:
  /// **'— h — m worked'**
  String get hoursWorked;

  /// No description provided for @deliveryMetrics.
  ///
  /// In en, this message translates to:
  /// **'Your delivery metrics'**
  String get deliveryMetrics;

  /// No description provided for @score.
  ///
  /// In en, this message translates to:
  /// **'Score'**
  String get score;

  /// No description provided for @onTimeDelivery.
  ///
  /// In en, this message translates to:
  /// **'On Time Delivery'**
  String get onTimeDelivery;

  /// No description provided for @cancellationRate.
  ///
  /// In en, this message translates to:
  /// **'Cancellation Rate'**
  String get cancellationRate;

  /// No description provided for @leaderboardPosition.
  ///
  /// In en, this message translates to:
  /// **'Leaderboard Position'**
  String get leaderboardPosition;

  /// No description provided for @leaderboardRank.
  ///
  /// In en, this message translates to:
  /// **'# —'**
  String get leaderboardRank;

  /// No description provided for @inYourZone.
  ///
  /// In en, this message translates to:
  /// **'In your zone'**
  String get inYourZone;

  /// No description provided for @stayUpdated.
  ///
  /// In en, this message translates to:
  /// **'Stay updated'**
  String get stayUpdated;

  /// No description provided for @notificationNewOrder.
  ///
  /// In en, this message translates to:
  /// **'New Order'**
  String get notificationNewOrder;

  /// No description provided for @notificationNewOrderMessage.
  ///
  /// In en, this message translates to:
  /// **'A new delivery order is available near you'**
  String get notificationNewOrderMessage;

  /// No description provided for @notificationPaymentReceived.
  ///
  /// In en, this message translates to:
  /// **'Payment Received'**
  String get notificationPaymentReceived;

  /// No description provided for @notificationPaymentMessage.
  ///
  /// In en, this message translates to:
  /// **'Your delivery payment has been credited'**
  String get notificationPaymentMessage;

  /// No description provided for @notificationIncentiveUnlocked.
  ///
  /// In en, this message translates to:
  /// **'Incentive Unlocked'**
  String get notificationIncentiveUnlocked;

  /// No description provided for @notificationIncentiveMessage.
  ///
  /// In en, this message translates to:
  /// **'You unlocked a weekly bonus incentive'**
  String get notificationIncentiveMessage;

  /// No description provided for @notificationAnnouncement.
  ///
  /// In en, this message translates to:
  /// **'Announcement'**
  String get notificationAnnouncement;

  /// No description provided for @notificationAnnouncementMessage.
  ///
  /// In en, this message translates to:
  /// **'New safety guidelines for delivery partners'**
  String get notificationAnnouncementMessage;

  /// No description provided for @notificationSupportUpdate.
  ///
  /// In en, this message translates to:
  /// **'Support Update'**
  String get notificationSupportUpdate;

  /// No description provided for @notificationSupportMessage.
  ///
  /// In en, this message translates to:
  /// **'Your support ticket has been updated'**
  String get notificationSupportMessage;

  /// No description provided for @timeMinAgo.
  ///
  /// In en, this message translates to:
  /// **'— min ago'**
  String get timeMinAgo;

  /// No description provided for @timeHourAgo.
  ///
  /// In en, this message translates to:
  /// **'— hour ago'**
  String get timeHourAgo;

  /// No description provided for @timeDayAgo.
  ///
  /// In en, this message translates to:
  /// **'— day ago'**
  String get timeDayAgo;

  /// No description provided for @partnerName.
  ///
  /// In en, this message translates to:
  /// **'Partner Name'**
  String get partnerName;

  /// No description provided for @partnerId.
  ///
  /// In en, this message translates to:
  /// **'ID: — — —'**
  String get partnerId;

  /// No description provided for @editProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get editProfile;

  /// No description provided for @driverInformation.
  ///
  /// In en, this message translates to:
  /// **'Driver Information'**
  String get driverInformation;

  /// No description provided for @personalDetails.
  ///
  /// In en, this message translates to:
  /// **'Personal details'**
  String get personalDetails;

  /// No description provided for @vehicleInformation.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Information'**
  String get vehicleInformation;

  /// No description provided for @bikeDetails.
  ///
  /// In en, this message translates to:
  /// **'Bike details'**
  String get bikeDetails;

  /// No description provided for @license.
  ///
  /// In en, this message translates to:
  /// **'License'**
  String get license;

  /// No description provided for @verificationDocuments.
  ///
  /// In en, this message translates to:
  /// **'Verification documents'**
  String get verificationDocuments;

  /// No description provided for @uploadAndVerifyDocuments.
  ///
  /// In en, this message translates to:
  /// **'Upload and verify documents'**
  String get uploadAndVerifyDocuments;

  /// No description provided for @docDrivingLicense.
  ///
  /// In en, this message translates to:
  /// **'Driving License'**
  String get docDrivingLicense;

  /// No description provided for @docPan.
  ///
  /// In en, this message translates to:
  /// **'PAN'**
  String get docPan;

  /// No description provided for @docAadhaar.
  ///
  /// In en, this message translates to:
  /// **'Aadhaar'**
  String get docAadhaar;

  /// No description provided for @docVehicleRc.
  ///
  /// In en, this message translates to:
  /// **'Vehicle RC'**
  String get docVehicleRc;

  /// No description provided for @upload.
  ///
  /// In en, this message translates to:
  /// **'Upload'**
  String get upload;

  /// No description provided for @pending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pending;

  /// No description provided for @vehicleDetails.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Details'**
  String get vehicleDetails;

  /// No description provided for @yourDeliveryVehicle.
  ///
  /// In en, this message translates to:
  /// **'Your delivery vehicle'**
  String get yourDeliveryVehicle;

  /// No description provided for @active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// No description provided for @bikeDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Bike Details'**
  String get bikeDetailsTitle;

  /// No description provided for @registrationNumber.
  ///
  /// In en, this message translates to:
  /// **'Registration Number'**
  String get registrationNumber;

  /// No description provided for @pollutionCertificate.
  ///
  /// In en, this message translates to:
  /// **'Pollution Certificate'**
  String get pollutionCertificate;

  /// No description provided for @vehicleStatus.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Status'**
  String get vehicleStatus;

  /// No description provided for @verified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get verified;

  /// No description provided for @weAreHereToHelp.
  ///
  /// In en, this message translates to:
  /// **'We are here to help'**
  String get weAreHereToHelp;

  /// No description provided for @faq.
  ///
  /// In en, this message translates to:
  /// **'FAQ'**
  String get faq;

  /// No description provided for @commonQuestions.
  ///
  /// In en, this message translates to:
  /// **'Common questions'**
  String get commonQuestions;

  /// No description provided for @chatSupport.
  ///
  /// In en, this message translates to:
  /// **'Chat Support'**
  String get chatSupport;

  /// No description provided for @chatWithTeam.
  ///
  /// In en, this message translates to:
  /// **'Chat with our team'**
  String get chatWithTeam;

  /// No description provided for @callSupport.
  ///
  /// In en, this message translates to:
  /// **'Call Support'**
  String get callSupport;

  /// No description provided for @talkToSupportAgent.
  ///
  /// In en, this message translates to:
  /// **'Talk to support agent'**
  String get talkToSupportAgent;

  /// No description provided for @raiseTicket.
  ///
  /// In en, this message translates to:
  /// **'Raise Ticket'**
  String get raiseTicket;

  /// No description provided for @submitSupportRequest.
  ///
  /// In en, this message translates to:
  /// **'Submit a support request'**
  String get submitSupportRequest;

  /// No description provided for @support247.
  ///
  /// In en, this message translates to:
  /// **'24/7 Support'**
  String get support247;

  /// No description provided for @supportAvailableRoundClock.
  ///
  /// In en, this message translates to:
  /// **'Our team is available round the clock'**
  String get supportAvailableRoundClock;

  /// No description provided for @darkMode.
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get darkMode;

  /// No description provided for @darkThemeOn.
  ///
  /// In en, this message translates to:
  /// **'Dark theme is on'**
  String get darkThemeOn;

  /// No description provided for @lightThemeOn.
  ///
  /// In en, this message translates to:
  /// **'Light theme is on'**
  String get lightThemeOn;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @pushNotifications.
  ///
  /// In en, this message translates to:
  /// **'Push Notifications'**
  String get pushNotifications;

  /// No description provided for @orderAlerts.
  ///
  /// In en, this message translates to:
  /// **'Order Alerts'**
  String get orderAlerts;

  /// No description provided for @privacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get privacy;

  /// No description provided for @privacyPolicyTerms.
  ///
  /// In en, this message translates to:
  /// **'Privacy policy & terms'**
  String get privacyPolicyTerms;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @passwordHint.
  ///
  /// In en, this message translates to:
  /// **'Enter password (min 6 chars)'**
  String get passwordHint;

  /// No description provided for @login.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// No description provided for @register.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get createAccount;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Login'**
  String get alreadyHaveAccount;

  /// No description provided for @dontHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'New partner? Register'**
  String get dontHaveAccount;

  /// No description provided for @enterPhoneAndPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your phone number and password'**
  String get enterPhoneAndPassword;

  /// No description provided for @authError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get authError;

  /// No description provided for @selectArea.
  ///
  /// In en, this message translates to:
  /// **'Select Area'**
  String get selectArea;

  /// No description provided for @selectAreaSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your delivery area'**
  String get selectAreaSubtitle;

  /// No description provided for @searchArea.
  ///
  /// In en, this message translates to:
  /// **'Search area'**
  String get searchArea;

  /// No description provided for @noAreasFound.
  ///
  /// In en, this message translates to:
  /// **'No areas found'**
  String get noAreasFound;

  /// No description provided for @verificationPendingTitle.
  ///
  /// In en, this message translates to:
  /// **'Verification in progress'**
  String get verificationPendingTitle;

  /// No description provided for @verificationPendingHours.
  ///
  /// In en, this message translates to:
  /// **'Document & identity verification usually completes within 3–6 hours.'**
  String get verificationPendingHours;

  /// No description provided for @verificationOfflineVisit.
  ///
  /// In en, this message translates to:
  /// **'Please visit your area Delivery Manager for offline verification with original documents.'**
  String get verificationOfflineVisit;

  /// No description provided for @verificationManagerLabel.
  ///
  /// In en, this message translates to:
  /// **'Delivery Manager'**
  String get verificationManagerLabel;

  /// No description provided for @verificationStoreLabel.
  ///
  /// In en, this message translates to:
  /// **'Store'**
  String get verificationStoreLabel;

  /// No description provided for @verificationAddressLabel.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get verificationAddressLabel;

  /// No description provided for @verificationPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get verificationPhoneLabel;

  /// No description provided for @verificationNoManagerYet.
  ///
  /// In en, this message translates to:
  /// **'No delivery manager is registered for your area yet. Stay offline until verification is assigned.'**
  String get verificationNoManagerYet;

  /// No description provided for @verificationCannotGoOnline.
  ///
  /// In en, this message translates to:
  /// **'You can go online after verification is complete.'**
  String get verificationCannotGoOnline;

  /// No description provided for @verificationApprovedTitle.
  ///
  /// In en, this message translates to:
  /// **'You\'re verified'**
  String get verificationApprovedTitle;

  /// No description provided for @verificationApprovedToast.
  ///
  /// In en, this message translates to:
  /// **'Verified! You can go online now.'**
  String get verificationApprovedToast;

  /// No description provided for @verificationRejectedTitle.
  ///
  /// In en, this message translates to:
  /// **'Verification rejected'**
  String get verificationRejectedTitle;

  /// No description provided for @verificationRejectedHint.
  ///
  /// In en, this message translates to:
  /// **'Contact your area delivery manager for help.'**
  String get verificationRejectedHint;

  /// No description provided for @myShifts.
  ///
  /// In en, this message translates to:
  /// **'My Shifts'**
  String get myShifts;

  /// No description provided for @myShiftsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your booked and available delivery shifts'**
  String get myShiftsSubtitle;

  /// No description provided for @availableShifts.
  ///
  /// In en, this message translates to:
  /// **'Available Shifts'**
  String get availableShifts;

  /// No description provided for @myProgress.
  ///
  /// In en, this message translates to:
  /// **'My Progress'**
  String get myProgress;

  /// No description provided for @loginHours.
  ///
  /// In en, this message translates to:
  /// **'Login Hours'**
  String get loginHours;

  /// No description provided for @totalOrdersToday.
  ///
  /// In en, this message translates to:
  /// **'Total Orders Today'**
  String get totalOrdersToday;

  /// No description provided for @shiftBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked'**
  String get shiftBooked;

  /// No description provided for @shiftAvailable.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get shiftAvailable;

  /// No description provided for @bookShift.
  ///
  /// In en, this message translates to:
  /// **'Book Shift'**
  String get bookShift;

  /// No description provided for @shiftBookedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Shift booked successfully!'**
  String get shiftBookedSuccess;

  /// No description provided for @noShiftsYet.
  ///
  /// In en, this message translates to:
  /// **'No shifts booked yet'**
  String get noShiftsYet;

  /// No description provided for @noShiftsYetHint.
  ///
  /// In en, this message translates to:
  /// **'Book a shift from available slots below'**
  String get noShiftsYetHint;

  /// No description provided for @noAvailableShifts.
  ///
  /// In en, this message translates to:
  /// **'No shifts available'**
  String get noAvailableShifts;

  /// No description provided for @noAvailableShiftsHint.
  ///
  /// In en, this message translates to:
  /// **'Check back later for new slots'**
  String get noAvailableShiftsHint;

  /// No description provided for @ordersExpected.
  ///
  /// In en, this message translates to:
  /// **'orders expected'**
  String get ordersExpected;

  /// No description provided for @viewAllShifts.
  ///
  /// In en, this message translates to:
  /// **'View all shifts'**
  String get viewAllShifts;

  /// No description provided for @dailyProgress.
  ///
  /// In en, this message translates to:
  /// **'Daily Progress'**
  String get dailyProgress;

  /// No description provided for @dailyProgressSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track your goals for today'**
  String get dailyProgressSubtitle;

  /// No description provided for @complete.
  ///
  /// In en, this message translates to:
  /// **'complete'**
  String get complete;

  /// No description provided for @onlineForToday.
  ///
  /// In en, this message translates to:
  /// **'Online for'**
  String get onlineForToday;

  /// No description provided for @peakHoursBanner.
  ///
  /// In en, this message translates to:
  /// **'Peak hours right now — earn extra per order'**
  String get peakHoursBanner;

  /// No description provided for @shiftBookedBanner.
  ///
  /// In en, this message translates to:
  /// **'You\'re booked for {label} ({time})'**
  String shiftBookedBanner(String label, String time);

  /// No description provided for @shiftBookingHint.
  ///
  /// In en, this message translates to:
  /// **'Booking a shift helps the store plan — you can still go online/offline anytime'**
  String get shiftBookingHint;

  /// No description provided for @bookTomorrowShift.
  ///
  /// In en, this message translates to:
  /// **'Book Tomorrow\'s Shift'**
  String get bookTomorrowShift;

  /// No description provided for @youreOnline.
  ///
  /// In en, this message translates to:
  /// **'You\'re online'**
  String get youreOnline;

  /// No description provided for @goOnlineToReceive.
  ///
  /// In en, this message translates to:
  /// **'Go online to receive orders'**
  String get goOnlineToReceive;

  /// No description provided for @tapToStartReceiving.
  ///
  /// In en, this message translates to:
  /// **'Tap the switch to start receiving orders'**
  String get tapToStartReceiving;

  /// No description provided for @waitingForOrders.
  ///
  /// In en, this message translates to:
  /// **'Waiting for orders...'**
  String get waitingForOrders;

  /// No description provided for @waitingForOrdersHint.
  ///
  /// In en, this message translates to:
  /// **'Stay nearby — new deliveries will appear here'**
  String get waitingForOrdersHint;

  /// No description provided for @onADelivery.
  ///
  /// In en, this message translates to:
  /// **'On a delivery'**
  String get onADelivery;

  /// No description provided for @reachedStore.
  ///
  /// In en, this message translates to:
  /// **'Reached store'**
  String get reachedStore;

  /// No description provided for @incentiveOrdersLeft.
  ///
  /// In en, this message translates to:
  /// **'Complete {count} more orders for today\'s bonus'**
  String incentiveOrdersLeft(int count);

  /// No description provided for @dailyTargetReached.
  ///
  /// In en, this message translates to:
  /// **'Daily order target reached — great work!'**
  String get dailyTargetReached;

  /// No description provided for @referAndEarn.
  ///
  /// In en, this message translates to:
  /// **'Refer & Earn'**
  String get referAndEarn;

  /// No description provided for @referAndEarnSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Invite your friends and earn amazing rewards'**
  String get referAndEarnSubtitle;

  /// No description provided for @earnBonus.
  ///
  /// In en, this message translates to:
  /// **'Earn Bonus'**
  String get earnBonus;

  /// No description provided for @earnBonusSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Complete more gigs and earn exciting bonuses'**
  String get earnBonusSubtitle;

  /// No description provided for @viewWallet.
  ///
  /// In en, this message translates to:
  /// **'View Wallet'**
  String get viewWallet;

  /// No description provided for @verifiedPartner.
  ///
  /// In en, this message translates to:
  /// **'Verified Partner'**
  String get verifiedPartner;

  /// No description provided for @youAreOnline.
  ///
  /// In en, this message translates to:
  /// **'You are Online'**
  String get youAreOnline;

  /// No description provided for @youAreOffline.
  ///
  /// In en, this message translates to:
  /// **'You are Offline'**
  String get youAreOffline;

  /// No description provided for @receiveDeliveryRequests.
  ///
  /// In en, this message translates to:
  /// **'You will receive delivery requests.'**
  String get receiveDeliveryRequests;

  /// No description provided for @offlineDeliveryHint.
  ///
  /// In en, this message translates to:
  /// **'Go online to receive delivery requests.'**
  String get offlineDeliveryHint;

  /// No description provided for @completeMoreDeliveriesBonus.
  ///
  /// In en, this message translates to:
  /// **'Complete {count} more deliveries to earn extra {amount} bonus'**
  String completeMoreDeliveriesBonus(int count, String amount);

  /// No description provided for @currentOrder.
  ///
  /// In en, this message translates to:
  /// **'Current Order'**
  String get currentOrder;

  /// No description provided for @orderEarnings.
  ///
  /// In en, this message translates to:
  /// **'Order Earnings'**
  String get orderEarnings;

  /// No description provided for @acceptOrder.
  ///
  /// In en, this message translates to:
  /// **'Accept Order'**
  String get acceptOrder;

  /// No description provided for @kmAway.
  ///
  /// In en, this message translates to:
  /// **'{distance} km away'**
  String kmAway(String distance);

  /// No description provided for @todaysOrders.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Orders'**
  String get todaysOrders;

  /// No description provided for @completed.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get completed;

  /// No description provided for @shiftRunning.
  ///
  /// In en, this message translates to:
  /// **'Running'**
  String get shiftRunning;

  /// No description provided for @shiftUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get shiftUpcoming;

  /// No description provided for @myOrders.
  ///
  /// In en, this message translates to:
  /// **'My Orders'**
  String get myOrders;

  /// No description provided for @thisWeekEarnings.
  ///
  /// In en, this message translates to:
  /// **'This Week'**
  String get thisWeekEarnings;

  /// No description provided for @continueDelivery.
  ///
  /// In en, this message translates to:
  /// **'Continue Delivery'**
  String get continueDelivery;

  /// No description provided for @goOnlineToReceiveOrders.
  ///
  /// In en, this message translates to:
  /// **'Go online to receive delivery requests'**
  String get goOnlineToReceiveOrders;

  /// No description provided for @moreOrders.
  ///
  /// In en, this message translates to:
  /// **'More orders'**
  String get moreOrders;

  /// No description provided for @moreEarnings.
  ///
  /// In en, this message translates to:
  /// **'More earnings'**
  String get moreEarnings;

  /// No description provided for @goOnline.
  ///
  /// In en, this message translates to:
  /// **'Go Online'**
  String get goOnline;

  /// No description provided for @goOffline.
  ///
  /// In en, this message translates to:
  /// **'Go Offline'**
  String get goOffline;

  /// No description provided for @todaysProgress.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Progress'**
  String get todaysProgress;

  /// No description provided for @viewAll.
  ///
  /// In en, this message translates to:
  /// **'View All'**
  String get viewAll;

  /// No description provided for @viewAllGigs.
  ///
  /// In en, this message translates to:
  /// **'View All Gigs'**
  String get viewAllGigs;

  /// No description provided for @bookAndGoOnline.
  ///
  /// In en, this message translates to:
  /// **'Book & Go Online'**
  String get bookAndGoOnline;

  /// No description provided for @trips.
  ///
  /// In en, this message translates to:
  /// **'Trips'**
  String get trips;

  /// No description provided for @gigs.
  ///
  /// In en, this message translates to:
  /// **'Gigs'**
  String get gigs;

  /// No description provided for @sessions.
  ///
  /// In en, this message translates to:
  /// **'Sessions'**
  String get sessions;

  /// No description provided for @shifts.
  ///
  /// In en, this message translates to:
  /// **'Shifts'**
  String get shifts;

  /// No description provided for @incentiveSlabsBonusLevels.
  ///
  /// In en, this message translates to:
  /// **'INCENTIVE SLABS & BONUS LEVELS'**
  String get incentiveSlabsBonusLevels;

  /// No description provided for @earnBonusTitle.
  ///
  /// In en, this message translates to:
  /// **'Earn Bonus'**
  String get earnBonusTitle;

  /// No description provided for @exploreBonuses.
  ///
  /// In en, this message translates to:
  /// **'Explore Bonuses'**
  String get exploreBonuses;

  /// No description provided for @referAndEarnTitle.
  ///
  /// In en, this message translates to:
  /// **'Refer & Earn'**
  String get referAndEarnTitle;

  /// No description provided for @referNow.
  ///
  /// In en, this message translates to:
  /// **'Refer Now'**
  String get referNow;

  /// No description provided for @gigsAndIncentives.
  ///
  /// In en, this message translates to:
  /// **'Gigs & Incentives'**
  String get gigsAndIncentives;

  /// No description provided for @earnUpToExtra.
  ///
  /// In en, this message translates to:
  /// **'Earn up to ₹{bonus} extra'**
  String earnUpToExtra(Object bonus);

  /// No description provided for @lunchIncentive.
  ///
  /// In en, this message translates to:
  /// **'Lunch Incentive'**
  String get lunchIncentive;

  /// No description provided for @dinnerIncentive.
  ///
  /// In en, this message translates to:
  /// **'Dinner Incentive'**
  String get dinnerIncentive;

  /// No description provided for @specialGigDesc.
  ///
  /// In en, this message translates to:
  /// **'Special Gig • You can go online even now'**
  String get specialGigDesc;

  /// No description provided for @noShiftsBookedYet.
  ///
  /// In en, this message translates to:
  /// **'No Shifts Booked Yet'**
  String get noShiftsBookedYet;

  /// No description provided for @noShiftBookedForToday.
  ///
  /// In en, this message translates to:
  /// **'No Shift Booked For Today'**
  String get noShiftBookedForToday;

  /// No description provided for @mandatoryBookShiftHint.
  ///
  /// In en, this message translates to:
  /// **'Mandatory: You must book today\'s shift before going online and receiving orders.'**
  String get mandatoryBookShiftHint;

  /// No description provided for @bookShiftNow.
  ///
  /// In en, this message translates to:
  /// **'Book Shift Now 📅'**
  String get bookShiftNow;

  /// No description provided for @selectShiftSlotNow.
  ///
  /// In en, this message translates to:
  /// **'Select Shift Slot Now'**
  String get selectShiftSlotNow;

  /// No description provided for @verifyLocationAndGoOnline.
  ///
  /// In en, this message translates to:
  /// **'Verify Location & Go Online 🟢'**
  String get verifyLocationAndGoOnline;

  /// No description provided for @upcomingShiftsTitle.
  ///
  /// In en, this message translates to:
  /// **'UPCOMING SHIFTS'**
  String get upcomingShiftsTitle;

  /// No description provided for @bookMore.
  ///
  /// In en, this message translates to:
  /// **'+ Book More'**
  String get bookMore;

  /// No description provided for @noFutureUpcomingShifts.
  ///
  /// In en, this message translates to:
  /// **'No future upcoming shifts booked.'**
  String get noFutureUpcomingShifts;

  /// No description provided for @availableShiftSlots.
  ///
  /// In en, this message translates to:
  /// **'Available Shift Slots'**
  String get availableShiftSlots;

  /// No description provided for @filterServerTimeHint.
  ///
  /// In en, this message translates to:
  /// **'Past and full slots are automatically filtered by server time.'**
  String get filterServerTimeHint;

  /// No description provided for @noActiveGigsTitle.
  ///
  /// In en, this message translates to:
  /// **'No Active Gigs'**
  String get noActiveGigsTitle;

  /// No description provided for @noActiveGigsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'There are no active gig incentives for your store right now.'**
  String get noActiveGigsSubtitle;

  /// No description provided for @shiftStatusYourBooked.
  ///
  /// In en, this message translates to:
  /// **'YOUR BOOKED SHIFT ✓'**
  String get shiftStatusYourBooked;

  /// No description provided for @shiftStatusEnded.
  ///
  /// In en, this message translates to:
  /// **'SHIFT ENDED'**
  String get shiftStatusEnded;

  /// No description provided for @shiftStatusFull.
  ///
  /// In en, this message translates to:
  /// **'FULLY BOOKED'**
  String get shiftStatusFull;

  /// No description provided for @spotsLeftCount.
  ///
  /// In en, this message translates to:
  /// **'{count} spots left!'**
  String spotsLeftCount(int count);

  /// No description provided for @spotsAvailableCount.
  ///
  /// In en, this message translates to:
  /// **'{count} spots available'**
  String spotsAvailableCount(int count);

  /// No description provided for @badgeBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked ✓'**
  String get badgeBooked;

  /// No description provided for @badgeEnded.
  ///
  /// In en, this message translates to:
  /// **'Ended'**
  String get badgeEnded;

  /// No description provided for @badgeFull.
  ///
  /// In en, this message translates to:
  /// **'Full'**
  String get badgeFull;

  /// No description provided for @btnBook.
  ///
  /// In en, this message translates to:
  /// **'Book'**
  String get btnBook;

  /// No description provided for @todayUpper.
  ///
  /// In en, this message translates to:
  /// **'TODAY'**
  String get todayUpper;

  /// No description provided for @confirmShiftTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm Shift'**
  String get confirmShiftTitle;

  /// No description provided for @workingHoursLabel.
  ///
  /// In en, this message translates to:
  /// **'Working Hours'**
  String get workingHoursLabel;

  /// No description provided for @confirmBookQuestion.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to book this shift slot?'**
  String get confirmBookQuestion;

  /// No description provided for @shiftBookedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'✓ Shift Booked Successfully'**
  String get shiftBookedSuccessfully;

  /// No description provided for @shiftConfirmedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your shift has been confirmed.'**
  String get shiftConfirmedSubtitle;

  /// No description provided for @verificationPendingBody.
  ///
  /// In en, this message translates to:
  /// **'Your profile is under review by our verification team. This usually takes 24-48 hours.'**
  String get verificationPendingBody;

  /// No description provided for @verificationPendingDarkStoreHint.
  ///
  /// In en, this message translates to:
  /// **'Visit your registered dark store for instant offline verification.'**
  String get verificationPendingDarkStoreHint;

  /// No description provided for @verificationRejectedBody.
  ///
  /// In en, this message translates to:
  /// **'Your document verification was rejected. Please re-upload valid documents.'**
  String get verificationRejectedBody;

  /// No description provided for @selectYourShift.
  ///
  /// In en, this message translates to:
  /// **'Select Your Shift'**
  String get selectYourShift;

  /// No description provided for @noAvailableSlotsForDate.
  ///
  /// In en, this message translates to:
  /// **'No Available Slots for this date'**
  String get noAvailableSlotsForDate;

  /// No description provided for @allSlotsBookedOrEnded.
  ///
  /// In en, this message translates to:
  /// **'All slots for this date are booked or ended.'**
  String get allSlotsBookedOrEnded;

  /// No description provided for @liveServerTime.
  ///
  /// In en, this message translates to:
  /// **'Live Server Time'**
  String get liveServerTime;

  /// No description provided for @year.
  ///
  /// In en, this message translates to:
  /// **'Year'**
  String get year;

  /// No description provided for @onlineTime.
  ///
  /// In en, this message translates to:
  /// **'Online Time'**
  String get onlineTime;

  /// No description provided for @shiftsBookedLabel.
  ///
  /// In en, this message translates to:
  /// **'Shifts Booked'**
  String get shiftsBookedLabel;

  /// No description provided for @completedShiftsLabel.
  ///
  /// In en, this message translates to:
  /// **'Completed Shifts'**
  String get completedShiftsLabel;

  /// No description provided for @earnShort.
  ///
  /// In en, this message translates to:
  /// **'Earn'**
  String get earnShort;

  /// No description provided for @doneShort.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get doneShort;

  /// No description provided for @couldNotLoadHistory.
  ///
  /// In en, this message translates to:
  /// **'Could not load history'**
  String get couldNotLoadHistory;

  /// No description provided for @noActivityInPeriod.
  ///
  /// In en, this message translates to:
  /// **'No activity in this period'**
  String get noActivityInPeriod;

  /// No description provided for @tripsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} Trips'**
  String tripsCount(int count);

  /// No description provided for @tripCountOne.
  ///
  /// In en, this message translates to:
  /// **'{count} Trip'**
  String tripCountOne(int count);

  /// No description provided for @shiftsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} Shifts'**
  String shiftsCount(int count);

  /// No description provided for @shiftCountOne.
  ///
  /// In en, this message translates to:
  /// **'{count} Shift'**
  String shiftCountOne(int count);

  /// No description provided for @completedCountLabel.
  ///
  /// In en, this message translates to:
  /// **'{count} Completed'**
  String completedCountLabel(int count);

  /// No description provided for @shiftsBookedValue.
  ///
  /// In en, this message translates to:
  /// **'{count} booked'**
  String shiftsBookedValue(int count);

  /// No description provided for @shiftsDoneValue.
  ///
  /// In en, this message translates to:
  /// **'{count} shifts'**
  String shiftsDoneValue(int count);

  /// No description provided for @tripsAndOnlineSummary.
  ///
  /// In en, this message translates to:
  /// **'{trips} trips · {onlineTime}'**
  String tripsAndOnlineSummary(int trips, String onlineTime);

  /// No description provided for @thisWeekEarningsTitle.
  ///
  /// In en, this message translates to:
  /// **'This week earnings'**
  String get thisWeekEarningsTitle;

  /// No description provided for @fullWeekEarnings.
  ///
  /// In en, this message translates to:
  /// **'Full week earnings'**
  String get fullWeekEarnings;

  /// No description provided for @deliveriesAndToday.
  ///
  /// In en, this message translates to:
  /// **'{count} deliveries · Today {amount}'**
  String deliveriesAndToday(int count, String amount);

  /// No description provided for @withdrawRequestSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Withdraw request for {amount} submitted.'**
  String withdrawRequestSubmitted(String amount);

  /// No description provided for @withdrawAvailableSaturday.
  ///
  /// In en, this message translates to:
  /// **'Withdraw is available today (Saturday).'**
  String get withdrawAvailableSaturday;

  /// No description provided for @noEarningsToWithdraw.
  ///
  /// In en, this message translates to:
  /// **'No earnings to withdraw this week.'**
  String get noEarningsToWithdraw;

  /// No description provided for @withdrawOpensSaturday.
  ///
  /// In en, this message translates to:
  /// **'Withdraw opens only on Saturday. Your weekly earnings stay locked until then.'**
  String get withdrawOpensSaturday;

  /// No description provided for @weeklyChart.
  ///
  /// In en, this message translates to:
  /// **'Weekly chart'**
  String get weeklyChart;

  /// No description provided for @noEarningsThisWeekYet.
  ///
  /// In en, this message translates to:
  /// **'No earnings this week yet'**
  String get noEarningsThisWeekYet;

  /// No description provided for @dayWiseEarnings.
  ///
  /// In en, this message translates to:
  /// **'Day-wise earnings'**
  String get dayWiseEarnings;

  /// No description provided for @completeDeliveriesForWeekly.
  ///
  /// In en, this message translates to:
  /// **'Complete deliveries to see weekly earnings here.'**
  String get completeDeliveriesForWeekly;

  /// No description provided for @deliveriesCount.
  ///
  /// In en, this message translates to:
  /// **'{count} deliveries'**
  String deliveriesCount(int count);

  /// No description provided for @todayWithLabel.
  ///
  /// In en, this message translates to:
  /// **'Today · {label}'**
  String todayWithLabel(String label);

  /// No description provided for @dayWithDate.
  ///
  /// In en, this message translates to:
  /// **'{label} · {date}'**
  String dayWithDate(String label, String date);

  /// No description provided for @todayTrips.
  ///
  /// In en, this message translates to:
  /// **'Today trips'**
  String get todayTrips;

  /// No description provided for @lifetimeEarnings.
  ///
  /// In en, this message translates to:
  /// **'Lifetime'**
  String get lifetimeEarnings;

  /// No description provided for @noDeliveriesTodayYet.
  ///
  /// In en, this message translates to:
  /// **'No deliveries completed today yet.'**
  String get noDeliveriesTodayYet;

  /// No description provided for @orderNumberHash.
  ///
  /// In en, this message translates to:
  /// **'Order #{number}'**
  String orderNumberHash(String number);

  /// No description provided for @deliveriesUpdatedLive.
  ///
  /// In en, this message translates to:
  /// **'{count} deliveries · {updatedLive}'**
  String deliveriesUpdatedLive(int count, String updatedLive);

  /// No description provided for @distanceKmValue.
  ///
  /// In en, this message translates to:
  /// **'{km} km'**
  String distanceKmValue(String km);

  /// No description provided for @welcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome Back!'**
  String get welcomeBack;

  /// No description provided for @loginOtpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your mobile number — we\'ll send you an OTP'**
  String get loginOtpSubtitle;

  /// No description provided for @registerOtpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Join as a Delivery Partner with your mobile number'**
  String get registerOtpSubtitle;

  /// No description provided for @otpSentTo.
  ///
  /// In en, this message translates to:
  /// **'We\'ve sent a 6 digit OTP to\n+91 {phone}'**
  String otpSentTo(String phone);

  /// No description provided for @resendOtpIn.
  ///
  /// In en, this message translates to:
  /// **'Resend OTP in '**
  String get resendOtpIn;

  /// No description provided for @resendNow.
  ///
  /// In en, this message translates to:
  /// **'Resend Now'**
  String get resendNow;

  /// No description provided for @otpResent.
  ///
  /// In en, this message translates to:
  /// **'OTP resent successfully'**
  String get otpResent;

  /// No description provided for @agreeTermsPrefix.
  ///
  /// In en, this message translates to:
  /// **'I agree to the '**
  String get agreeTermsPrefix;

  /// No description provided for @termsAndConditions.
  ///
  /// In en, this message translates to:
  /// **'Terms & Conditions'**
  String get termsAndConditions;

  /// No description provided for @andWord.
  ///
  /// In en, this message translates to:
  /// **' and '**
  String get andWord;

  /// No description provided for @privacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyPolicy;

  /// No description provided for @agreeTermsError.
  ///
  /// In en, this message translates to:
  /// **'Please agree to Terms & Conditions'**
  String get agreeTermsError;

  /// No description provided for @noAccountPrompt.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? '**
  String get noAccountPrompt;

  /// No description provided for @haveAccountPrompt.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? '**
  String get haveAccountPrompt;

  /// No description provided for @registerNow.
  ///
  /// In en, this message translates to:
  /// **'Register Now'**
  String get registerNow;

  /// No description provided for @pickupDriverLogin.
  ///
  /// In en, this message translates to:
  /// **'Pickup driver? Login with password'**
  String get pickupDriverLogin;

  /// No description provided for @markAsRead.
  ///
  /// In en, this message translates to:
  /// **'Mark as read'**
  String get markAsRead;

  /// No description provided for @announcementMovedToNotifications.
  ///
  /// In en, this message translates to:
  /// **'Moved to Notifications'**
  String get announcementMovedToNotifications;

  /// No description provided for @noSlotAssignedTitle.
  ///
  /// In en, this message translates to:
  /// **'No slot assigned'**
  String get noSlotAssignedTitle;

  /// No description provided for @noSlotAssignedMessage.
  ///
  /// In en, this message translates to:
  /// **'No slot is assigned to you for today. Your Delivery Manager assigns slots — you can also go online while a live gig is running.'**
  String get noSlotAssignedMessage;

  /// No description provided for @viewMySlots.
  ///
  /// In en, this message translates to:
  /// **'View my slots'**
  String get viewMySlots;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @orderDeliveredTitle.
  ///
  /// In en, this message translates to:
  /// **'Order delivered successfully'**
  String get orderDeliveredTitle;

  /// No description provided for @orderDeliveredBody.
  ///
  /// In en, this message translates to:
  /// **'Order #{number} has been delivered.'**
  String orderDeliveredBody(String number);

  /// No description provided for @goToHome.
  ///
  /// In en, this message translates to:
  /// **'Go to Home'**
  String get goToHome;

  /// No description provided for @deliveryPartnerApp.
  ///
  /// In en, this message translates to:
  /// **'Delivery Partner App'**
  String get deliveryPartnerApp;

  /// No description provided for @fullNameHint.
  ///
  /// In en, this message translates to:
  /// **'Enter your full name'**
  String get fullNameHint;

  /// No description provided for @enterNameError.
  ///
  /// In en, this message translates to:
  /// **'Please enter your full name'**
  String get enterNameError;

  /// No description provided for @noAreasInCity.
  ///
  /// In en, this message translates to:
  /// **'No delivery hubs in this city yet. Please choose another city.'**
  String get noAreasInCity;

  /// No description provided for @nextDelivery.
  ///
  /// In en, this message translates to:
  /// **'Next delivery'**
  String get nextDelivery;

  /// No description provided for @detectingLocation.
  ///
  /// In en, this message translates to:
  /// **'Detecting your location…'**
  String get detectingLocation;

  /// No description provided for @locationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t get your location. Turn on GPS and try again.'**
  String get locationUnavailable;

  /// No description provided for @locationVerified.
  ///
  /// In en, this message translates to:
  /// **'Location verified'**
  String get locationVerified;

  /// No description provided for @locationCheckFailed.
  ///
  /// In en, this message translates to:
  /// **'Location check failed'**
  String get locationCheckFailed;

  /// No description provided for @slotsAssignedByManager.
  ///
  /// In en, this message translates to:
  /// **'Slots are assigned by your Delivery Manager. You\'ll get a notification when a new slot is assigned.'**
  String get slotsAssignedByManager;

  /// No description provided for @todaysSlots.
  ///
  /// In en, this message translates to:
  /// **'TODAY\'S SLOTS'**
  String get todaysSlots;

  /// No description provided for @noSlotAssignedToday.
  ///
  /// In en, this message translates to:
  /// **'No slot assigned for today yet.'**
  String get noSlotAssignedToday;

  /// No description provided for @noUpcomingSlotsAssigned.
  ///
  /// In en, this message translates to:
  /// **'No upcoming slots assigned.'**
  String get noUpcomingSlotsAssigned;

  /// No description provided for @incentivePerKm.
  ///
  /// In en, this message translates to:
  /// **'₹{rate}/km incentive'**
  String incentivePerKm(String rate);

  /// No description provided for @incentivePerKmAfter.
  ///
  /// In en, this message translates to:
  /// **'₹{rate}/km after {km} km'**
  String incentivePerKmAfter(String rate, String km);

  /// No description provided for @kmDoneInSlot.
  ///
  /// In en, this message translates to:
  /// **'{done} / {km} km done'**
  String kmDoneInSlot(String done, String km);

  /// No description provided for @incentivePerHour.
  ///
  /// In en, this message translates to:
  /// **'₹{rate}/hr incentive'**
  String incentivePerHour(String rate);

  /// No description provided for @salaryAndIncentives.
  ///
  /// In en, this message translates to:
  /// **'Salary & Incentives'**
  String get salaryAndIncentives;

  /// No description provided for @slotIncentives.
  ///
  /// In en, this message translates to:
  /// **'Slot Incentives'**
  String get slotIncentives;

  /// No description provided for @perMonth.
  ///
  /// In en, this message translates to:
  /// **'per month'**
  String get perMonth;

  /// No description provided for @todayIncentiveEarned.
  ///
  /// In en, this message translates to:
  /// **'{amount} incentive earned today'**
  String todayIncentiveEarned(String amount);

  /// No description provided for @salaryAmount.
  ///
  /// In en, this message translates to:
  /// **'Salary {amount}'**
  String salaryAmount(String amount);

  /// No description provided for @salaryNotCreditedYet.
  ///
  /// In en, this message translates to:
  /// **'Salary pending'**
  String get salaryNotCreditedYet;

  /// No description provided for @incentiveAmount.
  ///
  /// In en, this message translates to:
  /// **'Incentive {amount}'**
  String incentiveAmount(String amount);

  /// No description provided for @recentIncentives.
  ///
  /// In en, this message translates to:
  /// **'Recent incentives'**
  String get recentIncentives;

  /// No description provided for @todaysIncentive.
  ///
  /// In en, this message translates to:
  /// **'Today\'s incentive'**
  String get todaysIncentive;

  /// No description provided for @salaryLabel.
  ///
  /// In en, this message translates to:
  /// **'Salary'**
  String get salaryLabel;

  /// No description provided for @perDay.
  ///
  /// In en, this message translates to:
  /// **'per day'**
  String get perDay;

  /// No description provided for @perWeek.
  ///
  /// In en, this message translates to:
  /// **'per week'**
  String get perWeek;

  /// No description provided for @salaryNotSet.
  ///
  /// In en, this message translates to:
  /// **'Not set yet'**
  String get salaryNotSet;

  /// No description provided for @shiftEndedNowOffline.
  ///
  /// In en, this message translates to:
  /// **'Your shift/gig ended. You are now offline.'**
  String get shiftEndedNowOffline;

  /// No description provided for @orderAlreadyAccepted.
  ///
  /// In en, this message translates to:
  /// **'Order already accepted — opening active delivery.'**
  String get orderAlreadyAccepted;

  /// No description provided for @assignmentNoLongerAvailable.
  ///
  /// In en, this message translates to:
  /// **'This assignment is no longer available.'**
  String get assignmentNoLongerAvailable;

  /// No description provided for @shiftEndedGraceOffline.
  ///
  /// In en, this message translates to:
  /// **'Your shift/gig ended. You stayed online 5 more minutes and are now offline.'**
  String get shiftEndedGraceOffline;

  /// No description provided for @verificationRequiredToGoOnline.
  ///
  /// In en, this message translates to:
  /// **'Account verification required to go online.'**
  String get verificationRequiredToGoOnline;

  /// No description provided for @youAreNowOffline.
  ///
  /// In en, this message translates to:
  /// **'You are now Offline.'**
  String get youAreNowOffline;

  /// No description provided for @failedToUpdateStatus.
  ///
  /// In en, this message translates to:
  /// **'Failed to update status.'**
  String get failedToUpdateStatus;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get somethingWentWrong;

  /// No description provided for @managerAssignedPreOrders.
  ///
  /// In en, this message translates to:
  /// **'Delivery Manager assigned you {count} pre-order(s)'**
  String managerAssignedPreOrders(int count);

  /// No description provided for @view.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get view;

  /// No description provided for @readyToDeliver.
  ///
  /// In en, this message translates to:
  /// **'Ready to deliver?'**
  String get readyToDeliver;

  /// No description provided for @receivingNearbyRequests.
  ///
  /// In en, this message translates to:
  /// **'Receiving nearby delivery requests.'**
  String get receivingNearbyRequests;

  /// No description provided for @goOnlineToReceiveRequests.
  ///
  /// In en, this message translates to:
  /// **'Go online to receive requests.'**
  String get goOnlineToReceiveRequests;

  /// No description provided for @todaysProgressTitle.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Progress'**
  String get todaysProgressTitle;

  /// No description provided for @todaysEarningsLabel.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Earnings'**
  String get todaysEarningsLabel;

  /// No description provided for @tripsCompletedLabel.
  ///
  /// In en, this message translates to:
  /// **'Trips Completed'**
  String get tripsCompletedLabel;

  /// No description provided for @currentEarningsLabel.
  ///
  /// In en, this message translates to:
  /// **'Current Earnings'**
  String get currentEarningsLabel;

  /// No description provided for @currentBonusLabel.
  ///
  /// In en, this message translates to:
  /// **'Current Bonus'**
  String get currentBonusLabel;

  /// No description provided for @completeMoreOrdersForBonus.
  ///
  /// In en, this message translates to:
  /// **'Complete {count} more orders to get +{bonus} bonus'**
  String completeMoreOrdersForBonus(int count, String bonus);

  /// No description provided for @ordersProgress.
  ///
  /// In en, this message translates to:
  /// **'{done} / {total} Orders'**
  String ordersProgress(int done, int total);

  /// No description provided for @ratingLabel.
  ///
  /// In en, this message translates to:
  /// **'Rating'**
  String get ratingLabel;

  /// No description provided for @acceptanceLabel.
  ///
  /// In en, this message translates to:
  /// **'Acceptance'**
  String get acceptanceLabel;

  /// No description provided for @onTimeLabel.
  ///
  /// In en, this message translates to:
  /// **'On-Time'**
  String get onTimeLabel;

  /// No description provided for @acceptShort.
  ///
  /// In en, this message translates to:
  /// **'Accept'**
  String get acceptShort;

  /// No description provided for @declineShort.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get declineShort;

  /// No description provided for @completeDeliveriesForGraph.
  ///
  /// In en, this message translates to:
  /// **'Complete deliveries to see your graph'**
  String get completeDeliveriesForGraph;

  /// No description provided for @noPerformanceDataYet.
  ///
  /// In en, this message translates to:
  /// **'No performance data yet'**
  String get noPerformanceDataYet;

  /// No description provided for @completeDeliveriesForPerformance.
  ///
  /// In en, this message translates to:
  /// **'Complete deliveries to see your performance\nand growth here.'**
  String get completeDeliveriesForPerformance;

  /// No description provided for @preOrdersAssignedToYou.
  ///
  /// In en, this message translates to:
  /// **'{count} pre-order(s) assigned to you'**
  String preOrdersAssignedToYou(int count);

  /// No description provided for @preOrdersToCollect.
  ///
  /// In en, this message translates to:
  /// **'{count} to collect — scan each order\'s QR at the store'**
  String preOrdersToCollect(int count);

  /// No description provided for @allCollectedDeliverOneByOne.
  ///
  /// In en, this message translates to:
  /// **'All collected — deliver one by one'**
  String get allCollectedDeliverOneByOne;

  /// No description provided for @openAction.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get openAction;

  /// No description provided for @deliveryInProgress.
  ///
  /// In en, this message translates to:
  /// **'Delivery in Progress'**
  String get deliveryInProgress;

  /// No description provided for @tapToViewOrderDetails.
  ///
  /// In en, this message translates to:
  /// **'Tap to view order details & navigation'**
  String get tapToViewOrderDetails;

  /// No description provided for @kindHoliday.
  ///
  /// In en, this message translates to:
  /// **'Holiday'**
  String get kindHoliday;

  /// No description provided for @kindShift.
  ///
  /// In en, this message translates to:
  /// **'Shift'**
  String get kindShift;

  /// No description provided for @kindNote.
  ///
  /// In en, this message translates to:
  /// **'Note'**
  String get kindNote;

  /// No description provided for @kindUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get kindUpcoming;

  /// No description provided for @cashDepositDue.
  ///
  /// In en, this message translates to:
  /// **'Cash Deposit Due'**
  String get cashDepositDue;

  /// No description provided for @detailsAction.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get detailsAction;

  /// No description provided for @handOverToStoreToday.
  ///
  /// In en, this message translates to:
  /// **'Hand over to darkstore manager today'**
  String get handOverToStoreToday;

  /// No description provided for @couldNotLoadPreOrders.
  ///
  /// In en, this message translates to:
  /// **'Could not load your pre-orders.'**
  String get couldNotLoadPreOrders;

  /// No description provided for @addressesUnlocked.
  ///
  /// In en, this message translates to:
  /// **'Addresses unlocked for the scanned orders.'**
  String get addressesUnlocked;

  /// No description provided for @preOrderDeliveriesTitle.
  ///
  /// In en, this message translates to:
  /// **'Pre-order deliveries'**
  String get preOrderDeliveriesTitle;

  /// No description provided for @noPreOrdersAssigned.
  ///
  /// In en, this message translates to:
  /// **'No pre-orders assigned'**
  String get noPreOrdersAssigned;

  /// No description provided for @collectAtStore.
  ///
  /// In en, this message translates to:
  /// **'Collect at {store}'**
  String collectAtStore(String store);

  /// No description provided for @theDarkStore.
  ///
  /// In en, this message translates to:
  /// **'the dark store'**
  String get theDarkStore;

  /// No description provided for @preOrderProgressLine.
  ///
  /// In en, this message translates to:
  /// **'{delivered} delivered · {onTheWay} on the way · {toScan} to scan'**
  String preOrderProgressLine(int delivered, int onTheWay, int toScan);

  /// No description provided for @failedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} failed'**
  String failedCount(int count);

  /// No description provided for @preOrdersSalaryBased.
  ///
  /// In en, this message translates to:
  /// **'Pre-orders are salary-based — no per-km amount is added to your wallet.'**
  String get preOrdersSalaryBased;

  /// No description provided for @scanOrderQrsLeft.
  ///
  /// In en, this message translates to:
  /// **'Scan order QRs ({count} left)'**
  String scanOrderQrsLeft(int count);

  /// No description provided for @preOrdersEmptyHint.
  ///
  /// In en, this message translates to:
  /// **'You will get a notification when your Delivery Manager assigns pre-orders to you.'**
  String get preOrdersEmptyHint;

  /// No description provided for @outForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for delivery'**
  String get outForDelivery;

  /// No description provided for @atStoreScanToSeeAddress.
  ///
  /// In en, this message translates to:
  /// **'At the store — scan to see address'**
  String get atStoreScanToSeeAddress;

  /// No description provided for @finishedToday.
  ///
  /// In en, this message translates to:
  /// **'Finished today'**
  String get finishedToday;

  /// No description provided for @paidOnline.
  ///
  /// In en, this message translates to:
  /// **'Paid online'**
  String get paidOnline;

  /// No description provided for @collectCashAmount.
  ///
  /// In en, this message translates to:
  /// **'Collect {amount} cash'**
  String collectCashAmount(String amount);

  /// No description provided for @slotLabel.
  ///
  /// In en, this message translates to:
  /// **'Slot {slot}'**
  String slotLabel(String slot);

  /// No description provided for @itemsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} items'**
  String itemsCount(int count);

  /// No description provided for @scanQr.
  ///
  /// In en, this message translates to:
  /// **'Scan QR'**
  String get scanQr;

  /// No description provided for @scanBagQrHint.
  ///
  /// In en, this message translates to:
  /// **'Scan the QR on this order\'s bag to see customer address and number.'**
  String get scanBagQrHint;

  /// No description provided for @callAction.
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get callAction;

  /// No description provided for @deliverAction.
  ///
  /// In en, this message translates to:
  /// **'Deliver'**
  String get deliverAction;

  /// No description provided for @failedStatus.
  ///
  /// In en, this message translates to:
  /// **'Failed'**
  String get failedStatus;

  /// No description provided for @editName.
  ///
  /// In en, this message translates to:
  /// **'Edit name'**
  String get editName;

  /// No description provided for @fullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fullName;

  /// No description provided for @saveAction.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get saveAction;

  /// No description provided for @profilePhotoSaved.
  ///
  /// In en, this message translates to:
  /// **'Profile photo saved to your account'**
  String get profilePhotoSaved;

  /// No description provided for @ratingsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} ratings'**
  String ratingsCount(int count);

  /// No description provided for @tapPhotoToUpdate.
  ///
  /// In en, this message translates to:
  /// **'Tap photo to update · saved to cloud & home avatar'**
  String get tapPhotoToUpdate;

  /// No description provided for @accountDetails.
  ///
  /// In en, this message translates to:
  /// **'Account details'**
  String get accountDetails;

  /// No description provided for @bankViewOnlyManaged.
  ///
  /// In en, this message translates to:
  /// **'View only · managed by Delivery Manager'**
  String get bankViewOnlyManaged;

  /// No description provided for @detailsUpdatedByManager.
  ///
  /// In en, this message translates to:
  /// **'These details can only be updated by your Delivery Manager.'**
  String get detailsUpdatedByManager;

  /// No description provided for @bankViewOnlyContact.
  ///
  /// In en, this message translates to:
  /// **'View only · contact Delivery Manager to update'**
  String get bankViewOnlyContact;

  /// No description provided for @salaryAccount.
  ///
  /// In en, this message translates to:
  /// **'Salary account'**
  String get salaryAccount;

  /// No description provided for @primaryLabel.
  ///
  /// In en, this message translates to:
  /// **'Primary'**
  String get primaryLabel;

  /// No description provided for @bankUpdatedByManager.
  ///
  /// In en, this message translates to:
  /// **'Bank details can only be updated by your Delivery Manager.'**
  String get bankUpdatedByManager;

  /// No description provided for @yesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get yesterday;

  /// No description provided for @clearAllNotificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Clear all notifications?'**
  String get clearAllNotificationsTitle;

  /// No description provided for @clearAllNotificationsBody.
  ///
  /// In en, this message translates to:
  /// **'This removes all notifications from your list.'**
  String get clearAllNotificationsBody;

  /// No description provided for @clearAll.
  ///
  /// In en, this message translates to:
  /// **'Clear all'**
  String get clearAll;

  /// No description provided for @noNotificationsYet.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet'**
  String get noNotificationsYet;

  /// No description provided for @noNotificationsHint.
  ///
  /// In en, this message translates to:
  /// **'Orders, shifts, gigs and wallet updates will show here.'**
  String get noNotificationsHint;

  /// No description provided for @markAllAsRead.
  ///
  /// In en, this message translates to:
  /// **'Mark all as read'**
  String get markAllAsRead;

  /// No description provided for @notifVerifiedTitle.
  ///
  /// In en, this message translates to:
  /// **'You\'re Verified!'**
  String get notifVerifiedTitle;

  /// No description provided for @notifVerifiedBody.
  ///
  /// In en, this message translates to:
  /// **'You can now receive orders.'**
  String get notifVerifiedBody;

  /// No description provided for @notifShiftStartedTitle.
  ///
  /// In en, this message translates to:
  /// **'Time to go online'**
  String get notifShiftStartedTitle;

  /// No description provided for @notifShiftStartedBody.
  ///
  /// In en, this message translates to:
  /// **'Your slot has started. Go online to receive orders.'**
  String get notifShiftStartedBody;

  /// No description provided for @notifShiftReminderTitle.
  ///
  /// In en, this message translates to:
  /// **'Shift starting soon'**
  String get notifShiftReminderTitle;

  /// No description provided for @notifShiftReminderBody.
  ///
  /// In en, this message translates to:
  /// **'Your shift starts in about {minutes} min. Be ready to go online.'**
  String notifShiftReminderBody(int minutes);

  /// No description provided for @notifNewOrderTitle.
  ///
  /// In en, this message translates to:
  /// **'New Order'**
  String get notifNewOrderTitle;

  /// No description provided for @notifNewOrderBody.
  ///
  /// In en, this message translates to:
  /// **'You have a new order request.'**
  String get notifNewOrderBody;

  /// No description provided for @notifPreOrdersAssignedTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery Manager assigned you {count} pre-order(s)'**
  String notifPreOrdersAssignedTitle(int count);

  /// No description provided for @notifPreOrdersAssignedBody.
  ///
  /// In en, this message translates to:
  /// **'Collect them at the dark store. Scan each order\'s QR to see that customer\'s address.'**
  String get notifPreOrdersAssignedBody;

  /// No description provided for @notifOrdersAssignedTitle.
  ///
  /// In en, this message translates to:
  /// **'{count} new order(s) assigned'**
  String notifOrdersAssignedTitle(int count);

  /// No description provided for @notifOrdersAssignedBody.
  ///
  /// In en, this message translates to:
  /// **'Orders {numbers} have been assigned to you.'**
  String notifOrdersAssignedBody(String numbers);

  /// No description provided for @notifOrderCompletedTitle.
  ///
  /// In en, this message translates to:
  /// **'Order Completed'**
  String get notifOrderCompletedTitle;

  /// No description provided for @notifOrderCompletedBody.
  ///
  /// In en, this message translates to:
  /// **'You earned ₹{amount}. Added to your wallet.'**
  String notifOrderCompletedBody(String amount);

  /// No description provided for @notifWalletCreditedTitle.
  ///
  /// In en, this message translates to:
  /// **'₹{amount} Added'**
  String notifWalletCreditedTitle(String amount);

  /// No description provided for @notifWalletCreditedBody.
  ///
  /// In en, this message translates to:
  /// **'Your earnings have been added to your wallet.'**
  String get notifWalletCreditedBody;

  /// No description provided for @notifNewGigTitle.
  ///
  /// In en, this message translates to:
  /// **'New Gig Available'**
  String get notifNewGigTitle;

  /// No description provided for @notifNewGigBody.
  ///
  /// In en, this message translates to:
  /// **'A new gig is available near you.'**
  String get notifNewGigBody;

  /// No description provided for @monthlyEarnings.
  ///
  /// In en, this message translates to:
  /// **'Monthly earnings'**
  String get monthlyEarnings;

  /// No description provided for @dailyEarnings.
  ///
  /// In en, this message translates to:
  /// **'Daily earnings'**
  String get dailyEarnings;

  /// No description provided for @onlineDuration.
  ///
  /// In en, this message translates to:
  /// **'{time} online'**
  String onlineDuration(String time);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi', 'mr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
    case 'mr':
      return AppLocalizationsMr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
