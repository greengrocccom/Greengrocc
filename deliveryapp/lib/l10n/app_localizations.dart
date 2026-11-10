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

  /// No description provided for @tomorrow.
  ///
  /// In en, this message translates to:
  /// **'Tomorrow'**
  String get tomorrow;

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
  /// **'Shifts Assigned'**
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
  /// **'COD cash to hand over'**
  String get cashDepositDue;

  /// No description provided for @detailsAction.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get detailsAction;

  /// No description provided for @handOverToStoreToday.
  ///
  /// In en, this message translates to:
  /// **'Return this amount to your dark store manager by the end of the day.'**
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

  /// No description provided for @delQrScannedAddressUnlocked.
  ///
  /// In en, this message translates to:
  /// **'QR scanned! Customer address unlocked.'**
  String get delQrScannedAddressUnlocked;

  /// No description provided for @delQrScannedCaptureItemPhoto.
  ///
  /// In en, this message translates to:
  /// **'QR scanned! Now capture item photo for manager approval.'**
  String get delQrScannedCaptureItemPhoto;

  /// No description provided for @delItemProof.
  ///
  /// In en, this message translates to:
  /// **'Item Proof'**
  String get delItemProof;

  /// No description provided for @delItemProofSendSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Send this photo to the manager for approval.'**
  String get delItemProofSendSubtitle;

  /// No description provided for @delSendToManager.
  ///
  /// In en, this message translates to:
  /// **'Send to Manager'**
  String get delSendToManager;

  /// No description provided for @delItemPhotoSentWaiting.
  ///
  /// In en, this message translates to:
  /// **'Item photo sent. Waiting for manager approval.'**
  String get delItemPhotoSentWaiting;

  /// No description provided for @delCameraOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not open camera. Check permissions.'**
  String get delCameraOpenFailed;

  /// No description provided for @delDeliveryProof.
  ///
  /// In en, this message translates to:
  /// **'Delivery Proof'**
  String get delDeliveryProof;

  /// No description provided for @delDeliveryProofSendSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Send this photo, then enter the customer OTP.'**
  String get delDeliveryProofSendSubtitle;

  /// No description provided for @delSendPhoto.
  ///
  /// In en, this message translates to:
  /// **'Send Photo'**
  String get delSendPhoto;

  /// No description provided for @delRetake.
  ///
  /// In en, this message translates to:
  /// **'Retake'**
  String get delRetake;

  /// No description provided for @delPhotoSendFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not send photo. Try again.'**
  String get delPhotoSendFailed;

  /// No description provided for @delEmergencySent.
  ///
  /// In en, this message translates to:
  /// **'Emergency sent to your Delivery Manager.'**
  String get delEmergencySent;

  /// No description provided for @delMarkedFailedNotified.
  ///
  /// In en, this message translates to:
  /// **'Delivery marked as failed. Manager has been notified.'**
  String get delMarkedFailedNotified;

  /// No description provided for @delCouldNotMarkFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not mark failed.'**
  String get delCouldNotMarkFailed;

  /// No description provided for @delDelaySent.
  ///
  /// In en, this message translates to:
  /// **'Delay sent to your Delivery Manager.'**
  String get delDelaySent;

  /// No description provided for @delCouldNotSendDelay.
  ///
  /// In en, this message translates to:
  /// **'Could not send the delay.'**
  String get delCouldNotSendDelay;

  /// No description provided for @delIncorrectOtp.
  ///
  /// In en, this message translates to:
  /// **'Incorrect OTP'**
  String get delIncorrectOtp;

  /// No description provided for @delCashConfirmFailed.
  ///
  /// In en, this message translates to:
  /// **'Cash confirmation failed'**
  String get delCashConfirmFailed;

  /// No description provided for @delPreviousQrExpired.
  ///
  /// In en, this message translates to:
  /// **'The previous QR expired. Tap Online again for a new QR.'**
  String get delPreviousQrExpired;

  /// No description provided for @delUnableToOpenPaymentQr.
  ///
  /// In en, this message translates to:
  /// **'Unable to open payment QR.'**
  String get delUnableToOpenPaymentQr;

  /// No description provided for @delPleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Please try again.'**
  String get delPleaseTryAgain;

  /// No description provided for @delScanToPayUpi.
  ///
  /// In en, this message translates to:
  /// **'Scan to pay by UPI'**
  String get delScanToPayUpi;

  /// No description provided for @delPaymentQrUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Payment QR is unavailable.'**
  String get delPaymentQrUnavailable;

  /// No description provided for @delCloseQr.
  ///
  /// In en, this message translates to:
  /// **'Close QR'**
  String get delCloseQr;

  /// No description provided for @delCheckPayment.
  ///
  /// In en, this message translates to:
  /// **'Check payment'**
  String get delCheckPayment;

  /// No description provided for @delBackToPreOrders.
  ///
  /// In en, this message translates to:
  /// **'Back to pre-orders'**
  String get delBackToPreOrders;

  /// No description provided for @delQrNotForThisOrder.
  ///
  /// In en, this message translates to:
  /// **'This QR is for another order. Scan the bag for #{orderNumber}.'**
  String delQrNotForThisOrder(String orderNumber);

  /// No description provided for @orderCompleted.
  ///
  /// In en, this message translates to:
  /// **'Order completed'**
  String get orderCompleted;

  /// No description provided for @cashCollectedAmount.
  ///
  /// In en, this message translates to:
  /// **'Cash collected {amount}'**
  String cashCollectedAmount(String amount);

  /// No description provided for @delCouldNotCompleteDelivery.
  ///
  /// In en, this message translates to:
  /// **'Could not complete delivery.'**
  String get delCouldNotCompleteDelivery;

  /// No description provided for @delCouldNotOpenMaps.
  ///
  /// In en, this message translates to:
  /// **'Could not open Google Maps. Install Maps or try again.'**
  String get delCouldNotOpenMaps;

  /// No description provided for @delStorePhoneUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Store phone number not available.'**
  String get delStorePhoneUnavailable;

  /// No description provided for @delCustomerPhoneUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Customer phone number not available.'**
  String get delCustomerPhoneUnavailable;

  /// No description provided for @delCouldNotOpenDialer.
  ///
  /// In en, this message translates to:
  /// **'Could not open phone dialer.'**
  String get delCouldNotOpenDialer;

  /// No description provided for @delNoActiveDelivery.
  ///
  /// In en, this message translates to:
  /// **'No Active Delivery'**
  String get delNoActiveDelivery;

  /// No description provided for @delNoActiveDeliveryHint.
  ///
  /// In en, this message translates to:
  /// **'Stay online on the home screen to receive automated round-robin order assignments.'**
  String get delNoActiveDeliveryHint;

  /// No description provided for @delCheckForOrders.
  ///
  /// In en, this message translates to:
  /// **'Check For Orders'**
  String get delCheckForOrders;

  /// No description provided for @delOutForDelivery.
  ///
  /// In en, this message translates to:
  /// **'Out for Delivery'**
  String get delOutForDelivery;

  /// No description provided for @delAwaitingApproval.
  ///
  /// In en, this message translates to:
  /// **'Awaiting Approval'**
  String get delAwaitingApproval;

  /// No description provided for @delWaitingForPickup.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Pickup'**
  String get delWaitingForPickup;

  /// No description provided for @delReportEmergency.
  ///
  /// In en, this message translates to:
  /// **'Report emergency'**
  String get delReportEmergency;

  /// No description provided for @delPickupQrUnlocksIn.
  ///
  /// In en, this message translates to:
  /// **'Pickup QR unlocks in {countdown} — go to the dark store meanwhile.'**
  String delPickupQrUnlocksIn(String countdown);

  /// No description provided for @delAddressUnlocksAfterPickup.
  ///
  /// In en, this message translates to:
  /// **'Address unlocks after dark store pickup QR is verified'**
  String get delAddressUnlocksAfterPickup;

  /// No description provided for @delDeliverOrderBy.
  ///
  /// In en, this message translates to:
  /// **'Deliver this order by {time}'**
  String delDeliverOrderBy(String time);

  /// No description provided for @delOrderDetails.
  ///
  /// In en, this message translates to:
  /// **'Order Details'**
  String get delOrderDetails;

  /// No description provided for @delPickupDarkStore.
  ///
  /// In en, this message translates to:
  /// **'PICKUP DARK STORE'**
  String get delPickupDarkStore;

  /// No description provided for @delCallStore.
  ///
  /// In en, this message translates to:
  /// **'Call Store'**
  String get delCallStore;

  /// No description provided for @delPickupVerifiedAddressUnlocked.
  ///
  /// In en, this message translates to:
  /// **'Pickup verified — customer address unlocked'**
  String get delPickupVerifiedAddressUnlocked;

  /// No description provided for @delItemPhotoSentWaitingManager.
  ///
  /// In en, this message translates to:
  /// **'Item photo sent — waiting for manager'**
  String get delItemPhotoSentWaitingManager;

  /// No description provided for @delQrScannedTakeItemProof.
  ///
  /// In en, this message translates to:
  /// **'QR scanned — take item proof below'**
  String get delQrScannedTakeItemProof;

  /// No description provided for @delScanQrAtStoreToStart.
  ///
  /// In en, this message translates to:
  /// **'Scan QR at the store to start'**
  String get delScanQrAtStoreToStart;

  /// No description provided for @delPickupQr.
  ///
  /// In en, this message translates to:
  /// **'Pickup QR'**
  String get delPickupQr;

  /// No description provided for @delSameRouteSearch.
  ///
  /// In en, this message translates to:
  /// **'Same-route search · {countdown}'**
  String delSameRouteSearch(String countdown);

  /// No description provided for @delOrderCustomerAddress.
  ///
  /// In en, this message translates to:
  /// **'#{orderNumber} · Customer Address'**
  String delOrderCustomerAddress(String orderNumber);

  /// No description provided for @delCustomerAddress.
  ///
  /// In en, this message translates to:
  /// **'Customer Address'**
  String get delCustomerAddress;

  /// No description provided for @delViewOnMap.
  ///
  /// In en, this message translates to:
  /// **'View on Map'**
  String get delViewOnMap;

  /// No description provided for @delMinutesShort.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min'**
  String delMinutesShort(String minutes);

  /// No description provided for @delHoursShort.
  ///
  /// In en, this message translates to:
  /// **'{hours} hr'**
  String delHoursShort(String hours);

  /// No description provided for @delHoursMinutesShort.
  ///
  /// In en, this message translates to:
  /// **'{hours} hr {minutes} min'**
  String delHoursMinutesShort(String hours, String minutes);

  /// No description provided for @delDelayPrompt.
  ///
  /// In en, this message translates to:
  /// **'Stuck or running late? Let your manager know.'**
  String get delDelayPrompt;

  /// No description provided for @delReportedLateCustomerUpdated.
  ///
  /// In en, this message translates to:
  /// **'Reported {duration} late · manager updated the customer'**
  String delReportedLateCustomerUpdated(String duration);

  /// No description provided for @delReportedLateWaitingManager.
  ///
  /// In en, this message translates to:
  /// **'Reported {duration} late · waiting for manager'**
  String delReportedLateWaitingManager(String duration);

  /// No description provided for @delUpdate.
  ///
  /// In en, this message translates to:
  /// **'Update'**
  String get delUpdate;

  /// No description provided for @delReportDelay.
  ///
  /// In en, this message translates to:
  /// **'Report delay'**
  String get delReportDelay;

  /// No description provided for @delOrderItems.
  ///
  /// In en, this message translates to:
  /// **'Order Items'**
  String get delOrderItems;

  /// No description provided for @delGroceryPack.
  ///
  /// In en, this message translates to:
  /// **'Grocery Pack'**
  String get delGroceryPack;

  /// No description provided for @delItemsAndTotal.
  ///
  /// In en, this message translates to:
  /// **'{count} items • ₹{amount}'**
  String delItemsAndTotal(String count, String amount);

  /// No description provided for @delOrderTimeline.
  ///
  /// In en, this message translates to:
  /// **'Order Timeline'**
  String get delOrderTimeline;

  /// No description provided for @delOrderAssigned.
  ///
  /// In en, this message translates to:
  /// **'Order Assigned'**
  String get delOrderAssigned;

  /// No description provided for @delOrderAssignedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You have been assigned a new order'**
  String get delOrderAssignedSubtitle;

  /// No description provided for @delGoToStoreScanPickupQr.
  ///
  /// In en, this message translates to:
  /// **'Go to the store and scan the pickup QR.'**
  String get delGoToStoreScanPickupQr;

  /// No description provided for @delSuggestedRoute.
  ///
  /// In en, this message translates to:
  /// **'Suggested route · {count} deliveries'**
  String delSuggestedRoute(String count);

  /// No description provided for @delWaitingForManager.
  ///
  /// In en, this message translates to:
  /// **'Waiting for Manager'**
  String get delWaitingForManager;

  /// No description provided for @delTakeItemProof.
  ///
  /// In en, this message translates to:
  /// **'Take Item Proof'**
  String get delTakeItemProof;

  /// No description provided for @delCaptureDeliveryProof.
  ///
  /// In en, this message translates to:
  /// **'Capture Delivery Proof'**
  String get delCaptureDeliveryProof;

  /// No description provided for @delEnterOtpAndComplete.
  ///
  /// In en, this message translates to:
  /// **'Enter OTP & Complete'**
  String get delEnterOtpAndComplete;

  /// No description provided for @delCompleteDelivery.
  ///
  /// In en, this message translates to:
  /// **'Complete Delivery'**
  String get delCompleteDelivery;

  /// No description provided for @delDeliveryFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivery Failed'**
  String get delDeliveryFailed;

  /// No description provided for @delEnterDeliveryOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter delivery OTP'**
  String get delEnterDeliveryOtp;

  /// No description provided for @delAskCustomerOtpForOrder.
  ///
  /// In en, this message translates to:
  /// **'Ask the customer for the 4-digit OTP shown on their order #{orderNumber}.'**
  String delAskCustomerOtpForOrder(String orderNumber);

  /// No description provided for @delVerifyOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP'**
  String get delVerifyOtp;

  /// No description provided for @delCollectAmount.
  ///
  /// In en, this message translates to:
  /// **'Collect ₹{amount}'**
  String delCollectAmount(String amount);

  /// No description provided for @delPaymentBreakdownQuestion.
  ///
  /// In en, this message translates to:
  /// **'Items ₹{itemsTotal}  ·  Delivery fee ₹{deliveryFee}\nHow will the customer pay?'**
  String delPaymentBreakdownQuestion(String itemsTotal, String deliveryFee);

  /// No description provided for @delOnlinePayment.
  ///
  /// In en, this message translates to:
  /// **'Online payment'**
  String get delOnlinePayment;

  /// No description provided for @delOnlinePaymentSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Show a UPI QR with the exact amount for the customer to scan'**
  String get delOnlinePaymentSubtitle;

  /// No description provided for @delCashOnDelivery.
  ///
  /// In en, this message translates to:
  /// **'Cash on delivery'**
  String get delCashOnDelivery;

  /// No description provided for @delCashOnDeliverySubtitle.
  ///
  /// In en, this message translates to:
  /// **'You collected cash from the customer'**
  String get delCashOnDeliverySubtitle;

  /// No description provided for @delCashCollected.
  ///
  /// In en, this message translates to:
  /// **'Cash collected'**
  String get delCashCollected;

  /// No description provided for @delCashCollectedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Submit this cash to your dark store manager before the end of the day.'**
  String get delCashCollectedSubtitle;

  /// No description provided for @delItemTotal.
  ///
  /// In en, this message translates to:
  /// **'Item total'**
  String get delItemTotal;

  /// No description provided for @delDeliveryFee.
  ///
  /// In en, this message translates to:
  /// **'Delivery fee'**
  String get delDeliveryFee;

  /// No description provided for @delTotalToSubmit.
  ///
  /// In en, this message translates to:
  /// **'Total to submit'**
  String get delTotalToSubmit;

  /// No description provided for @delAddNoteOptional.
  ///
  /// In en, this message translates to:
  /// **'Add a quick note for the store (optional).'**
  String get delAddNoteOptional;

  /// No description provided for @delNoteHandedToCustomer.
  ///
  /// In en, this message translates to:
  /// **'Handed to customer'**
  String get delNoteHandedToCustomer;

  /// No description provided for @delNoteLeftAtDoor.
  ///
  /// In en, this message translates to:
  /// **'Left at the door'**
  String get delNoteLeftAtDoor;

  /// No description provided for @delNoteHandedToFamily.
  ///
  /// In en, this message translates to:
  /// **'Handed to family member'**
  String get delNoteHandedToFamily;

  /// No description provided for @delNoteHandedToSecurity.
  ///
  /// In en, this message translates to:
  /// **'Handed to security'**
  String get delNoteHandedToSecurity;

  /// No description provided for @delAnythingElseOptional.
  ///
  /// In en, this message translates to:
  /// **'Anything else? (optional)'**
  String get delAnythingElseOptional;

  /// No description provided for @delMarkAsDelivered.
  ///
  /// In en, this message translates to:
  /// **'Mark as delivered'**
  String get delMarkAsDelivered;

  /// No description provided for @delNotYet.
  ///
  /// In en, this message translates to:
  /// **'Not yet'**
  String get delNotYet;

  /// No description provided for @delReasonHeavyTraffic.
  ///
  /// In en, this message translates to:
  /// **'Heavy traffic'**
  String get delReasonHeavyTraffic;

  /// No description provided for @delReasonVehicleIssue.
  ///
  /// In en, this message translates to:
  /// **'Vehicle issue'**
  String get delReasonVehicleIssue;

  /// No description provided for @delReasonBadWeather.
  ///
  /// In en, this message translates to:
  /// **'Bad weather'**
  String get delReasonBadWeather;

  /// No description provided for @delReasonOtherDeliveriesFirst.
  ///
  /// In en, this message translates to:
  /// **'Other deliveries first'**
  String get delReasonOtherDeliveriesFirst;

  /// No description provided for @delReasonOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get delReasonOther;

  /// No description provided for @delRunningLateTitle.
  ///
  /// In en, this message translates to:
  /// **'Delivery running late?'**
  String get delRunningLateTitle;

  /// No description provided for @delRunningLateSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell your Delivery Manager how late you will be. They can update the customer.'**
  String get delRunningLateSubtitle;

  /// No description provided for @delHours.
  ///
  /// In en, this message translates to:
  /// **'Hours'**
  String get delHours;

  /// No description provided for @delMinutes.
  ///
  /// In en, this message translates to:
  /// **'Minutes'**
  String get delMinutes;

  /// No description provided for @delAddDetailsOptional.
  ///
  /// In en, this message translates to:
  /// **'Add details (optional)'**
  String get delAddDetailsOptional;

  /// No description provided for @delSendDelayWithDuration.
  ///
  /// In en, this message translates to:
  /// **'Send delay · {duration}'**
  String delSendDelayWithDuration(String duration);

  /// No description provided for @delPickADelay.
  ///
  /// In en, this message translates to:
  /// **'Pick a delay'**
  String get delPickADelay;

  /// No description provided for @delReasonCustomerNotReachable.
  ///
  /// In en, this message translates to:
  /// **'Customer not reachable'**
  String get delReasonCustomerNotReachable;

  /// No description provided for @delReasonCustomerNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Customer not available'**
  String get delReasonCustomerNotAvailable;

  /// No description provided for @delReasonWrongAddress.
  ///
  /// In en, this message translates to:
  /// **'Wrong / incomplete address'**
  String get delReasonWrongAddress;

  /// No description provided for @delReasonCustomerRefused.
  ///
  /// In en, this message translates to:
  /// **'Customer refused order'**
  String get delReasonCustomerRefused;

  /// No description provided for @delReasonFlatTyre.
  ///
  /// In en, this message translates to:
  /// **'Flat tyre'**
  String get delReasonFlatTyre;

  /// No description provided for @delReasonVehicleBreakdown.
  ///
  /// In en, this message translates to:
  /// **'Vehicle breakdown'**
  String get delReasonVehicleBreakdown;

  /// No description provided for @delReasonHealthEmergency.
  ///
  /// In en, this message translates to:
  /// **'Health emergency'**
  String get delReasonHealthEmergency;

  /// No description provided for @delReportAnEmergency.
  ///
  /// In en, this message translates to:
  /// **'Report an emergency'**
  String get delReportAnEmergency;

  /// No description provided for @delDeliveryFailedQuestion.
  ///
  /// In en, this message translates to:
  /// **'Delivery failed?'**
  String get delDeliveryFailedQuestion;

  /// No description provided for @delEmergencyWithParcelHint.
  ///
  /// In en, this message translates to:
  /// **'Your manager will be alerted. If you have the parcel, contact the store to arrange handover.'**
  String get delEmergencyWithParcelHint;

  /// No description provided for @delEmergencyNoParcelHint.
  ///
  /// In en, this message translates to:
  /// **'Tell your manager why you can’t continue so they can assign another rider.'**
  String get delEmergencyNoParcelHint;

  /// No description provided for @delFailedDeliveryHint.
  ///
  /// In en, this message translates to:
  /// **'Tell the store what happened. The manager and customer will be notified.'**
  String get delFailedDeliveryHint;

  /// No description provided for @delDescribeReason.
  ///
  /// In en, this message translates to:
  /// **'Describe the reason'**
  String get delDescribeReason;

  /// No description provided for @delSubmitFailedDelivery.
  ///
  /// In en, this message translates to:
  /// **'Submit failed delivery'**
  String get delSubmitFailedDelivery;

  /// No description provided for @delInvalidPickupQr.
  ///
  /// In en, this message translates to:
  /// **'Invalid pickup QR. Scan the code shown on the manager screen.'**
  String get delInvalidPickupQr;

  /// No description provided for @delScanPreOrderQrs.
  ///
  /// In en, this message translates to:
  /// **'Scan pre-order QRs'**
  String get delScanPreOrderQrs;

  /// No description provided for @delScanPickupQr.
  ///
  /// In en, this message translates to:
  /// **'Scan Pickup QR'**
  String get delScanPickupQr;

  /// No description provided for @delUnlockedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} unlocked'**
  String delUnlockedCount(String count);

  /// No description provided for @delCameraUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Camera unavailable'**
  String get delCameraUnavailable;

  /// No description provided for @delUnableToStartCamera.
  ///
  /// In en, this message translates to:
  /// **'Unable to start the camera.'**
  String get delUnableToStartCamera;

  /// No description provided for @delCameraPermissionNeeded.
  ///
  /// In en, this message translates to:
  /// **'Camera permission needed'**
  String get delCameraPermissionNeeded;

  /// No description provided for @delAllowCameraToScanPickup.
  ///
  /// In en, this message translates to:
  /// **'Allow camera access to scan the Pickup QR from the manager screen.'**
  String get delAllowCameraToScanPickup;

  /// No description provided for @delAllowCamera.
  ///
  /// In en, this message translates to:
  /// **'Allow camera'**
  String get delAllowCamera;

  /// No description provided for @delOpenAppSettings.
  ///
  /// In en, this message translates to:
  /// **'Open app settings'**
  String get delOpenAppSettings;

  /// No description provided for @delScannerNotReady.
  ///
  /// In en, this message translates to:
  /// **'Scanner not ready'**
  String get delScannerNotReady;

  /// No description provided for @delCameraOpenError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong while opening the camera.'**
  String get delCameraOpenError;

  /// No description provided for @delVerifyingPickup.
  ///
  /// In en, this message translates to:
  /// **'Verifying pickup…'**
  String get delVerifyingPickup;

  /// No description provided for @delScanEachBagHint.
  ///
  /// In en, this message translates to:
  /// **'Scan the QR on each bag, one by one. Each scan shows that customer\'s address.'**
  String get delScanEachBagHint;

  /// No description provided for @delAlignQrHint.
  ///
  /// In en, this message translates to:
  /// **'Align the QR inside the frame. The manager shows it under Show Pickup QR.'**
  String get delAlignQrHint;

  /// No description provided for @delOrderNumberItems.
  ///
  /// In en, this message translates to:
  /// **'#{orderNumber} · {count} items'**
  String delOrderNumberItems(String orderNumber, String count);

  /// No description provided for @delNoItemsInOrder.
  ///
  /// In en, this message translates to:
  /// **'No items in this order'**
  String get delNoItemsInOrder;

  /// No description provided for @delItemFallback.
  ///
  /// In en, this message translates to:
  /// **'Item'**
  String get delItemFallback;

  /// No description provided for @delQty.
  ///
  /// In en, this message translates to:
  /// **'Qty: {qty}'**
  String delQty(String qty);

  /// No description provided for @delQtyWithUnit.
  ///
  /// In en, this message translates to:
  /// **'Qty: {qty} {unit}'**
  String delQtyWithUnit(String qty, String unit);

  /// No description provided for @delCouldNotSendItemPhoto.
  ///
  /// In en, this message translates to:
  /// **'Could not send item photo. Try again.'**
  String get delCouldNotSendItemPhoto;

  /// No description provided for @delItemProofHint.
  ///
  /// In en, this message translates to:
  /// **'Take a clear photo of the packed items. Manager will verify and unlock customer address.'**
  String get delItemProofHint;

  /// No description provided for @delTapToCaptureItemPhoto.
  ///
  /// In en, this message translates to:
  /// **'Tap to capture item photo'**
  String get delTapToCaptureItemPhoto;

  /// No description provided for @delCouldNotUploadDeliveryPhoto.
  ///
  /// In en, this message translates to:
  /// **'Could not upload delivery photo. Try again.'**
  String get delCouldNotUploadDeliveryPhoto;

  /// No description provided for @delDeliveryProofHint.
  ///
  /// In en, this message translates to:
  /// **'Take a photo at the customer door / handed package. Then enter the customer OTP to finish.'**
  String get delDeliveryProofHint;

  /// No description provided for @delTapToCaptureDeliveryPhoto.
  ///
  /// In en, this message translates to:
  /// **'Tap to capture delivery photo'**
  String get delTapToCaptureDeliveryPhoto;

  /// No description provided for @delUploadAndContinueToOtp.
  ///
  /// In en, this message translates to:
  /// **'Upload & Continue to OTP'**
  String get delUploadAndContinueToOtp;

  /// No description provided for @delCouldNotSendEmergency.
  ///
  /// In en, this message translates to:
  /// **'Could not send emergency report.'**
  String get delCouldNotSendEmergency;

  /// No description provided for @delOrderOffer.
  ///
  /// In en, this message translates to:
  /// **'Order offer'**
  String get delOrderOffer;

  /// No description provided for @delNewDeliveryOffer.
  ///
  /// In en, this message translates to:
  /// **'New delivery offer'**
  String get delNewDeliveryOffer;

  /// No description provided for @delSecondsToRespond.
  ///
  /// In en, this message translates to:
  /// **'{seconds}s to respond'**
  String delSecondsToRespond(String seconds);

  /// No description provided for @delCouldNotLoadAssignedOrders.
  ///
  /// In en, this message translates to:
  /// **'Could not load assigned orders.'**
  String get delCouldNotLoadAssignedOrders;

  /// No description provided for @delAssignedOrders.
  ///
  /// In en, this message translates to:
  /// **'Assigned Orders'**
  String get delAssignedOrders;

  /// No description provided for @delOrderAssignedCountOne.
  ///
  /// In en, this message translates to:
  /// **'{count} order assigned'**
  String delOrderAssignedCountOne(String count);

  /// No description provided for @delOrdersAssignedCount.
  ///
  /// In en, this message translates to:
  /// **'{count} orders assigned'**
  String delOrdersAssignedCount(String count);

  /// No description provided for @delDeliveredTodayAssignedByManager.
  ///
  /// In en, this message translates to:
  /// **'{count} delivered today · Assigned by your Delivery Manager'**
  String delDeliveredTodayAssignedByManager(String count);

  /// No description provided for @delStartDelivery.
  ///
  /// In en, this message translates to:
  /// **'Start Delivery'**
  String get delStartDelivery;

  /// No description provided for @delNoOrdersAssignedHint.
  ///
  /// In en, this message translates to:
  /// **'No orders assigned right now.\nYou will get a notification when your manager assigns one.'**
  String get delNoOrdersAssignedHint;

  /// No description provided for @delDeliveredToday.
  ///
  /// In en, this message translates to:
  /// **'Delivered Today'**
  String get delDeliveredToday;

  /// No description provided for @delReadyForPickup.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get delReadyForPickup;

  /// No description provided for @delPickupVerified.
  ///
  /// In en, this message translates to:
  /// **'Pickup verified'**
  String get delPickupVerified;

  /// No description provided for @delPreOrder.
  ///
  /// In en, this message translates to:
  /// **'Pre-Order'**
  String get delPreOrder;

  /// No description provided for @delAddressUnlocksAfterPickupVerification.
  ///
  /// In en, this message translates to:
  /// **'Customer address unlocks after pickup verification'**
  String get delAddressUnlocksAfterPickupVerification;

  /// No description provided for @delTurnOnLocationForTracking.
  ///
  /// In en, this message translates to:
  /// **'Turn on location to share live tracking'**
  String get delTurnOnLocationForTracking;

  /// No description provided for @delLocationPermissionForTracking.
  ///
  /// In en, this message translates to:
  /// **'Location permission is needed to share live tracking'**
  String get delLocationPermissionForTracking;

  /// No description provided for @delTrackingNotificationTitle.
  ///
  /// In en, this message translates to:
  /// **'Sharing live location'**
  String get delTrackingNotificationTitle;

  /// No description provided for @delTrackingNotificationText.
  ///
  /// In en, this message translates to:
  /// **'The customer can follow your delivery on the map'**
  String get delTrackingNotificationText;

  /// No description provided for @delTrackingChannelName.
  ///
  /// In en, this message translates to:
  /// **'Live delivery tracking'**
  String get delTrackingChannelName;

  /// No description provided for @ftDurationHours.
  ///
  /// In en, this message translates to:
  /// **'{hours}h'**
  String ftDurationHours(String hours);

  /// No description provided for @ftDurationMinutes.
  ///
  /// In en, this message translates to:
  /// **'{minutes}m'**
  String ftDurationMinutes(String minutes);

  /// No description provided for @ftEveryDay.
  ///
  /// In en, this message translates to:
  /// **'Every day'**
  String get ftEveryDay;

  /// No description provided for @ftPresent.
  ///
  /// In en, this message translates to:
  /// **'Present'**
  String get ftPresent;

  /// No description provided for @ftAbsent.
  ///
  /// In en, this message translates to:
  /// **'Absent'**
  String get ftAbsent;

  /// No description provided for @ftOffDay.
  ///
  /// In en, this message translates to:
  /// **'Off Day'**
  String get ftOffDay;

  /// No description provided for @ftNotRequired.
  ///
  /// In en, this message translates to:
  /// **'Not Required'**
  String get ftNotRequired;

  /// No description provided for @ftRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get ftRetry;

  /// No description provided for @ftRefresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get ftRefresh;

  /// No description provided for @ftSalaryLeavePolicy.
  ///
  /// In en, this message translates to:
  /// **'Salary & Leave Policy'**
  String get ftSalaryLeavePolicy;

  /// No description provided for @ftMonthlySalary.
  ///
  /// In en, this message translates to:
  /// **'Monthly Salary'**
  String get ftMonthlySalary;

  /// No description provided for @ftAmountPerMonth.
  ///
  /// In en, this message translates to:
  /// **'{amount} / month'**
  String ftAmountPerMonth(String amount);

  /// No description provided for @ftLeaveDaysBeforeDeduction.
  ///
  /// In en, this message translates to:
  /// **'Leave days before deduction'**
  String get ftLeaveDaysBeforeDeduction;

  /// No description provided for @ftCountPerMonth.
  ///
  /// In en, this message translates to:
  /// **'{count} per month'**
  String ftCountPerMonth(String count);

  /// No description provided for @ftNoLeavePolicy.
  ///
  /// In en, this message translates to:
  /// **'No leave policy'**
  String get ftNoLeavePolicy;

  /// No description provided for @ftExtraLeave.
  ///
  /// In en, this message translates to:
  /// **'Extra Leave'**
  String get ftExtraLeave;

  /// No description provided for @ftAmountCutPerUnpaidLeave.
  ///
  /// In en, this message translates to:
  /// **'{amount} cut per unpaid leave'**
  String ftAmountCutPerUnpaidLeave(String amount);

  /// No description provided for @ftOneDaySalaryCutPerUnpaidLeave.
  ///
  /// In en, this message translates to:
  /// **'1 day salary cut per unpaid leave'**
  String get ftOneDaySalaryCutPerUnpaidLeave;

  /// No description provided for @ftOfflineDuringShiftCountsAsLeave.
  ///
  /// In en, this message translates to:
  /// **'Not going online during a scheduled shift counts as a leave.'**
  String get ftOfflineDuringShiftCountsAsLeave;

  /// No description provided for @ftThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This Month'**
  String get ftThisMonth;

  /// No description provided for @ftCredited.
  ///
  /// In en, this message translates to:
  /// **'Credited'**
  String get ftCredited;

  /// No description provided for @ftBaseSalary.
  ///
  /// In en, this message translates to:
  /// **'Base salary'**
  String get ftBaseSalary;

  /// No description provided for @ftPresentDays.
  ///
  /// In en, this message translates to:
  /// **'Present days'**
  String get ftPresentDays;

  /// No description provided for @ftPresentOfWorkingDays.
  ///
  /// In en, this message translates to:
  /// **'{present} of {total} working days'**
  String ftPresentOfWorkingDays(String present, String total);

  /// No description provided for @ftLeavesTaken.
  ///
  /// In en, this message translates to:
  /// **'Leaves taken'**
  String get ftLeavesTaken;

  /// No description provided for @ftLeavesTakenBreakdown.
  ///
  /// In en, this message translates to:
  /// **'{taken}  ({paid} within allowance · {unpaid} extra)'**
  String ftLeavesTakenBreakdown(String taken, String paid, String unpaid);

  /// No description provided for @ftLeaveAllowanceLeft.
  ///
  /// In en, this message translates to:
  /// **'Leave allowance left'**
  String get ftLeaveAllowanceLeft;

  /// No description provided for @ftCountOfTotal.
  ///
  /// In en, this message translates to:
  /// **'{count} of {total}'**
  String ftCountOfTotal(String count, String total);

  /// No description provided for @ftUnpaidLeaveCut.
  ///
  /// In en, this message translates to:
  /// **'Unpaid leave cut ({days} × {rate})'**
  String ftUnpaidLeaveCut(String days, String rate);

  /// No description provided for @ftAbsentDays.
  ///
  /// In en, this message translates to:
  /// **'Absent days'**
  String get ftAbsentDays;

  /// No description provided for @ftNetSalary.
  ///
  /// In en, this message translates to:
  /// **'Net salary'**
  String get ftNetSalary;

  /// No description provided for @ftEstimatedNetSalary.
  ///
  /// In en, this message translates to:
  /// **'Estimated net salary'**
  String get ftEstimatedNetSalary;

  /// No description provided for @ftUpdatesDailyWorkingDaysLeft.
  ///
  /// In en, this message translates to:
  /// **'Updates daily — {days} working days left this month.'**
  String ftUpdatesDailyWorkingDaysLeft(String days);

  /// No description provided for @ftFailedToLoadRules.
  ///
  /// In en, this message translates to:
  /// **'Failed to load rules ({code})'**
  String ftFailedToLoadRules(String code);

  /// No description provided for @ftCouldNotConnectServer.
  ///
  /// In en, this message translates to:
  /// **'Could not connect to server. Please try again.'**
  String get ftCouldNotConnectServer;

  /// No description provided for @ftFullTimeRulesPay.
  ///
  /// In en, this message translates to:
  /// **'Full-Time Rules & Pay'**
  String get ftFullTimeRulesPay;

  /// No description provided for @ftFullTimePartnerBadge.
  ///
  /// In en, this message translates to:
  /// **'FULL-TIME PARTNER'**
  String get ftFullTimePartnerBadge;

  /// No description provided for @ftFixedBaseSalary.
  ///
  /// In en, this message translates to:
  /// **'FIXED BASE SALARY'**
  String get ftFixedBaseSalary;

  /// No description provided for @ftPerMonthSuffix.
  ///
  /// In en, this message translates to:
  /// **'/ month'**
  String get ftPerMonthSuffix;

  /// No description provided for @ftDirectMonthlyPayout.
  ///
  /// In en, this message translates to:
  /// **'Direct monthly payout based on daily verified store attendance'**
  String get ftDirectMonthlyPayout;

  /// No description provided for @ftGeoRadius.
  ///
  /// In en, this message translates to:
  /// **'Geo-Radius'**
  String get ftGeoRadius;

  /// No description provided for @ftMetersCompact.
  ///
  /// In en, this message translates to:
  /// **'{meters}m'**
  String ftMetersCompact(String meters);

  /// No description provided for @ftMetersValue.
  ///
  /// In en, this message translates to:
  /// **'{meters} m'**
  String ftMetersValue(String meters);

  /// No description provided for @ftStorePunchIn.
  ///
  /// In en, this message translates to:
  /// **'Store punch-in'**
  String get ftStorePunchIn;

  /// No description provided for @ftPaidLeaves.
  ///
  /// In en, this message translates to:
  /// **'Paid Leaves'**
  String get ftPaidLeaves;

  /// No description provided for @ftDaysCount.
  ///
  /// In en, this message translates to:
  /// **'{count} Days'**
  String ftDaysCount(String count);

  /// No description provided for @ftStandard.
  ///
  /// In en, this message translates to:
  /// **'Standard'**
  String get ftStandard;

  /// No description provided for @ftPerMonthLabel.
  ///
  /// In en, this message translates to:
  /// **'Per month'**
  String get ftPerMonthLabel;

  /// No description provided for @ftDispatch.
  ///
  /// In en, this message translates to:
  /// **'Dispatch'**
  String get ftDispatch;

  /// No description provided for @ftManager.
  ///
  /// In en, this message translates to:
  /// **'Manager'**
  String get ftManager;

  /// No description provided for @ftDirectAssign.
  ///
  /// In en, this message translates to:
  /// **'Direct assign'**
  String get ftDirectAssign;

  /// No description provided for @ftAssignedShift.
  ///
  /// In en, this message translates to:
  /// **'Assigned Shift'**
  String get ftAssignedShift;

  /// No description provided for @ftAssignedRosterTiming.
  ///
  /// In en, this message translates to:
  /// **'Assigned Roster & Timing'**
  String get ftAssignedRosterTiming;

  /// No description provided for @ftFixedShift.
  ///
  /// In en, this message translates to:
  /// **'FIXED SHIFT'**
  String get ftFixedShift;

  /// No description provided for @ftWorkingDaysList.
  ///
  /// In en, this message translates to:
  /// **'Working Days: {days}'**
  String ftWorkingDaysList(String days);

  /// No description provided for @ftCurrentMonthPayroll.
  ///
  /// In en, this message translates to:
  /// **'Current Month Payroll Breakdown'**
  String get ftCurrentMonthPayroll;

  /// No description provided for @ftCreditedBadge.
  ///
  /// In en, this message translates to:
  /// **'CREDITED'**
  String get ftCreditedBadge;

  /// No description provided for @ftInProgressBadge.
  ///
  /// In en, this message translates to:
  /// **'IN PROGRESS'**
  String get ftInProgressBadge;

  /// No description provided for @ftCurrentCycle.
  ///
  /// In en, this message translates to:
  /// **'Current Cycle'**
  String get ftCurrentCycle;

  /// No description provided for @ftBaseMonthlySalary.
  ///
  /// In en, this message translates to:
  /// **'Base Monthly Salary'**
  String get ftBaseMonthlySalary;

  /// No description provided for @ftPresentDaysTitle.
  ///
  /// In en, this message translates to:
  /// **'Present Days'**
  String get ftPresentDaysTitle;

  /// No description provided for @ftPresentOfDays.
  ///
  /// In en, this message translates to:
  /// **'{present} of {total} days'**
  String ftPresentOfDays(String present, String total);

  /// No description provided for @ftLeavesTakenTitle.
  ///
  /// In en, this message translates to:
  /// **'Leaves Taken'**
  String get ftLeavesTakenTitle;

  /// No description provided for @ftLeavesTakenDaysBreakdown.
  ///
  /// In en, this message translates to:
  /// **'{taken} days ({paid} paid · {unpaid} extra)'**
  String ftLeavesTakenDaysBreakdown(String taken, String paid, String unpaid);

  /// No description provided for @ftRemainingPaidLeaves.
  ///
  /// In en, this message translates to:
  /// **'Remaining Paid Leaves'**
  String get ftRemainingPaidLeaves;

  /// No description provided for @ftCountOfTotalLeft.
  ///
  /// In en, this message translates to:
  /// **'{count} of {total} left'**
  String ftCountOfTotalLeft(String count, String total);

  /// No description provided for @ftLeaveDeductionCalc.
  ///
  /// In en, this message translates to:
  /// **'Leave Deduction ({days} × {rate})'**
  String ftLeaveDeductionCalc(String days, String rate);

  /// No description provided for @ftUnexcusedAbsentDays.
  ///
  /// In en, this message translates to:
  /// **'Unexcused Absent Days'**
  String get ftUnexcusedAbsentDays;

  /// No description provided for @ftFinalCreditedAmount.
  ///
  /// In en, this message translates to:
  /// **'Final Credited Amount'**
  String get ftFinalCreditedAmount;

  /// No description provided for @ftEstimatedNetPayout.
  ///
  /// In en, this message translates to:
  /// **'Estimated Net Payout'**
  String get ftEstimatedNetPayout;

  /// No description provided for @ftUpdatedDailyShiftsLeft.
  ///
  /// In en, this message translates to:
  /// **'• Updated daily. {count} scheduled shifts left this month.'**
  String ftUpdatedDailyShiftsLeft(String count);

  /// No description provided for @ftDailyAttendanceGeofencing.
  ///
  /// In en, this message translates to:
  /// **'Daily Attendance & Geofencing'**
  String get ftDailyAttendanceGeofencing;

  /// No description provided for @ftDarkStoreGeofenceCheck.
  ///
  /// In en, this message translates to:
  /// **'Dark Store Geofence Check'**
  String get ftDarkStoreGeofenceCheck;

  /// No description provided for @ftGeofenceCheckDesc.
  ///
  /// In en, this message translates to:
  /// **'You must be physically present within {meters}m of your assigned dark store to punch in attendance.'**
  String ftGeofenceCheckDesc(String meters);

  /// No description provided for @ftGpsLocationVerification.
  ///
  /// In en, this message translates to:
  /// **'GPS Location Verification'**
  String get ftGpsLocationVerification;

  /// No description provided for @ftGpsVerificationDesc.
  ///
  /// In en, this message translates to:
  /// **'High-accuracy device location is verified automatically whenever you toggle online for your shift.'**
  String get ftGpsVerificationDesc;

  /// No description provided for @ftAutoCheckInOnline.
  ///
  /// In en, this message translates to:
  /// **'Auto Check-in on Online'**
  String get ftAutoCheckInOnline;

  /// No description provided for @ftAutoCheckInDesc.
  ///
  /// In en, this message translates to:
  /// **'Attendance is logged instantly when you go online during your scheduled shift window at the store.'**
  String get ftAutoCheckInDesc;

  /// No description provided for @ftStoreAttendanceGuideline.
  ///
  /// In en, this message translates to:
  /// **'Store Attendance Guideline'**
  String get ftStoreAttendanceGuideline;

  /// No description provided for @ftLeaveTermsAbsencePolicy.
  ///
  /// In en, this message translates to:
  /// **'Leave Terms & Absence Policy'**
  String get ftLeaveTermsAbsencePolicy;

  /// No description provided for @ftPaidLeaveAllowance.
  ///
  /// In en, this message translates to:
  /// **'Paid Leave Allowance'**
  String get ftPaidLeaveAllowance;

  /// No description provided for @ftLeavePolicy.
  ///
  /// In en, this message translates to:
  /// **'Leave Policy'**
  String get ftLeavePolicy;

  /// No description provided for @ftPaidLeaveEntitlementDesc.
  ///
  /// In en, this message translates to:
  /// **'You are entitled to {count} paid leaves per calendar month without any salary deduction.'**
  String ftPaidLeaveEntitlementDesc(String count);

  /// No description provided for @ftLeavesNeedApprovalDesc.
  ///
  /// In en, this message translates to:
  /// **'Leaves must be approved in advance by your Store Manager.'**
  String get ftLeavesNeedApprovalDesc;

  /// No description provided for @ftUnpaidAbsenceDeductions.
  ///
  /// In en, this message translates to:
  /// **'Unpaid Absence Deductions'**
  String get ftUnpaidAbsenceDeductions;

  /// No description provided for @ftAmountDeductedPerLeaveDay.
  ///
  /// In en, this message translates to:
  /// **'{amount} is deducted per unapproved or excess leave day.'**
  String ftAmountDeductedPerLeaveDay(String amount);

  /// No description provided for @ftProratedSalaryDeductedDesc.
  ///
  /// In en, this message translates to:
  /// **'1 day prorated salary is deducted for each day exceeding your monthly allowance.'**
  String get ftProratedSalaryDeductedDesc;

  /// No description provided for @ftUnapprovedAbsenceDeductedDesc.
  ///
  /// In en, this message translates to:
  /// **'Unapproved absence will be deducted from your monthly settlement.'**
  String get ftUnapprovedAbsenceDeductedDesc;

  /// No description provided for @ftShiftAttendanceRule.
  ///
  /// In en, this message translates to:
  /// **'Shift Attendance Rule'**
  String get ftShiftAttendanceRule;

  /// No description provided for @ftShiftAttendanceRuleDesc.
  ///
  /// In en, this message translates to:
  /// **'Not going online during a scheduled shift is recorded as an absence unless approved prior.'**
  String get ftShiftAttendanceRuleDesc;

  /// No description provided for @ftOrderDispatchAssignment.
  ///
  /// In en, this message translates to:
  /// **'Order Dispatch & Assignment'**
  String get ftOrderDispatchAssignment;

  /// No description provided for @ftDedicatedManagerDispatch.
  ///
  /// In en, this message translates to:
  /// **'Dedicated Store Manager Dispatch'**
  String get ftDedicatedManagerDispatch;

  /// No description provided for @ftManualAssignmentDesc.
  ///
  /// In en, this message translates to:
  /// **'Orders & pre-orders are assigned directly to you by your store manager. You do not need to hunt for open orders.'**
  String get ftManualAssignmentDesc;

  /// No description provided for @ftAssignmentModeValue.
  ///
  /// In en, this message translates to:
  /// **'Assignment mode: {mode}'**
  String ftAssignmentModeValue(String mode);

  /// No description provided for @ftStoreOperationalGuidelines.
  ///
  /// In en, this message translates to:
  /// **'Store Operational Guidelines'**
  String get ftStoreOperationalGuidelines;

  /// No description provided for @ftStoreRule.
  ///
  /// In en, this message translates to:
  /// **'Store Rule'**
  String get ftStoreRule;

  /// No description provided for @ftNeedAssistanceRulesPay.
  ///
  /// In en, this message translates to:
  /// **'Need assistance with your rules or pay?'**
  String get ftNeedAssistanceRulesPay;

  /// No description provided for @ftReachOutStoreManagerAt.
  ///
  /// In en, this message translates to:
  /// **'Reach out to your Store Manager at {store}.'**
  String ftReachOutStoreManagerAt(String store);

  /// No description provided for @ftSpeakWithStoreManager.
  ///
  /// In en, this message translates to:
  /// **'Speak with your assigned Store Manager for inquiries.'**
  String get ftSpeakWithStoreManager;

  /// No description provided for @ftCouldNotLoadAttendanceRetry.
  ///
  /// In en, this message translates to:
  /// **'Could not load attendance. Please try again.'**
  String get ftCouldNotLoadAttendanceRetry;

  /// No description provided for @ftMarkedAt.
  ///
  /// In en, this message translates to:
  /// **'Marked at {time}'**
  String ftMarkedAt(String time);

  /// No description provided for @ftMetersFromStore.
  ///
  /// In en, this message translates to:
  /// **'{meters}m from store'**
  String ftMetersFromStore(String meters);

  /// No description provided for @ftLateAfterCheckIn.
  ///
  /// In en, this message translates to:
  /// **'{duration} after check-in time'**
  String ftLateAfterCheckIn(String duration);

  /// No description provided for @ftTodayNotWorkingDay.
  ///
  /// In en, this message translates to:
  /// **'Today is not a working day.'**
  String get ftTodayNotWorkingDay;

  /// No description provided for @ftAttendanceNotRequired.
  ///
  /// In en, this message translates to:
  /// **'Attendance is not required for your shift.'**
  String get ftAttendanceNotRequired;

  /// No description provided for @ftNoAttendanceRecorded.
  ///
  /// In en, this message translates to:
  /// **'No attendance was recorded for this day.'**
  String get ftNoAttendanceRecorded;

  /// No description provided for @ftAttendanceAutoWithinRadius.
  ///
  /// In en, this message translates to:
  /// **'Attendance is recorded automatically when you go online within {meters}m of the dark store.'**
  String ftAttendanceAutoWithinRadius(String meters);

  /// No description provided for @ftAttendanceAuto.
  ///
  /// In en, this message translates to:
  /// **'Attendance is recorded automatically when you go online.'**
  String get ftAttendanceAuto;

  /// No description provided for @ftTodaysAttendance.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Attendance'**
  String get ftTodaysAttendance;

  /// No description provided for @ftCheckIn.
  ///
  /// In en, this message translates to:
  /// **'Check-in'**
  String get ftCheckIn;

  /// No description provided for @ftStoreRadius.
  ///
  /// In en, this message translates to:
  /// **'Store radius'**
  String get ftStoreRadius;

  /// No description provided for @ftFromStore.
  ///
  /// In en, this message translates to:
  /// **'From store'**
  String get ftFromStore;

  /// No description provided for @ftLateBy.
  ///
  /// In en, this message translates to:
  /// **'Late by'**
  String get ftLateBy;

  /// No description provided for @ftOnTime.
  ///
  /// In en, this message translates to:
  /// **'On time'**
  String get ftOnTime;

  /// No description provided for @ftWorkRules.
  ///
  /// In en, this message translates to:
  /// **'Work rules'**
  String get ftWorkRules;

  /// No description provided for @ftDarkStore.
  ///
  /// In en, this message translates to:
  /// **'Dark Store'**
  String get ftDarkStore;

  /// No description provided for @ftLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get ftLocation;

  /// No description provided for @ftWithinMetersOfStore.
  ///
  /// In en, this message translates to:
  /// **'Within {meters}m of store'**
  String ftWithinMetersOfStore(String meters);

  /// No description provided for @ftDaysPresent.
  ///
  /// In en, this message translates to:
  /// **'{count} days present'**
  String ftDaysPresent(String count);

  /// No description provided for @ftThisMonthLower.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get ftThisMonthLower;

  /// No description provided for @ftMonthlyAttendanceSummary.
  ///
  /// In en, this message translates to:
  /// **'Monthly attendance summary'**
  String get ftMonthlyAttendanceSummary;

  /// No description provided for @ftLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get ftLeave;

  /// No description provided for @ftRemaining.
  ///
  /// In en, this message translates to:
  /// **'Remaining'**
  String get ftRemaining;

  /// No description provided for @ftLate.
  ///
  /// In en, this message translates to:
  /// **'Late'**
  String get ftLate;

  /// No description provided for @ftOffDayLegend.
  ///
  /// In en, this message translates to:
  /// **'Off day'**
  String get ftOffDayLegend;

  /// No description provided for @ftCouldNotLoadPerformance.
  ///
  /// In en, this message translates to:
  /// **'Could not load performance. Pull to retry.'**
  String get ftCouldNotLoadPerformance;

  /// No description provided for @ftKeyRates.
  ///
  /// In en, this message translates to:
  /// **'Key rates'**
  String get ftKeyRates;

  /// No description provided for @ftSinceVerification.
  ///
  /// In en, this message translates to:
  /// **'Since verification'**
  String get ftSinceVerification;

  /// No description provided for @ftDeclineRate.
  ///
  /// In en, this message translates to:
  /// **'Decline rate'**
  String get ftDeclineRate;

  /// No description provided for @ftOrderOffers.
  ///
  /// In en, this message translates to:
  /// **'Order offers'**
  String get ftOrderOffers;

  /// No description provided for @ftHowYouRespondedOffers.
  ///
  /// In en, this message translates to:
  /// **'How you responded to offers'**
  String get ftHowYouRespondedOffers;

  /// No description provided for @ftNoOrderOffersYet.
  ///
  /// In en, this message translates to:
  /// **'No order offers yet. Go online to start receiving orders.'**
  String get ftNoOrderOffersYet;

  /// No description provided for @ftOffersLower.
  ///
  /// In en, this message translates to:
  /// **'offers'**
  String get ftOffersLower;

  /// No description provided for @ftAccepted.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get ftAccepted;

  /// No description provided for @ftDeclined.
  ///
  /// In en, this message translates to:
  /// **'Declined'**
  String get ftDeclined;

  /// No description provided for @ftMissed.
  ///
  /// In en, this message translates to:
  /// **'Missed'**
  String get ftMissed;

  /// No description provided for @ftTripOutcomes.
  ///
  /// In en, this message translates to:
  /// **'Trip outcomes'**
  String get ftTripOutcomes;

  /// No description provided for @ftDeliveredVsCancelledVsFailed.
  ///
  /// In en, this message translates to:
  /// **'Delivered vs cancelled vs failed'**
  String get ftDeliveredVsCancelledVsFailed;

  /// No description provided for @ftTripOutcomesEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your trip outcomes will show here after your first delivery.'**
  String get ftTripOutcomesEmpty;

  /// No description provided for @ftCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get ftCancelled;

  /// No description provided for @ftOnTimeDeliveries.
  ///
  /// In en, this message translates to:
  /// **'On-time deliveries'**
  String get ftOnTimeDeliveries;

  /// No description provided for @ftDeliveredWithin60Min.
  ///
  /// In en, this message translates to:
  /// **'Delivered within 60 minutes of assignment'**
  String get ftDeliveredWithin60Min;

  /// No description provided for @ftTripsDelivered.
  ///
  /// In en, this message translates to:
  /// **'Trips delivered'**
  String get ftTripsDelivered;

  /// No description provided for @ftOffersReceived.
  ///
  /// In en, this message translates to:
  /// **'Offers received'**
  String get ftOffersReceived;

  /// No description provided for @ftCancellationRate.
  ///
  /// In en, this message translates to:
  /// **'Cancellation rate'**
  String get ftCancellationRate;

  /// No description provided for @ftMissedOffers.
  ///
  /// In en, this message translates to:
  /// **'Missed offers'**
  String get ftMissedOffers;

  /// No description provided for @ftRatingsAppearAfter.
  ///
  /// In en, this message translates to:
  /// **'Customer ratings appear after customers rate your deliveries.'**
  String get ftRatingsAppearAfter;

  /// No description provided for @ftBasedOnDeliveriesSinceVerification.
  ///
  /// In en, this message translates to:
  /// **'Based on your deliveries since verification.'**
  String get ftBasedOnDeliveriesSinceVerification;

  /// No description provided for @ftRatingCountOne.
  ///
  /// In en, this message translates to:
  /// **'{count} rating'**
  String ftRatingCountOne(String count);

  /// No description provided for @ftSinceDate.
  ///
  /// In en, this message translates to:
  /// **'since {date}'**
  String ftSinceDate(String date);

  /// No description provided for @ftNoRatingsYet.
  ///
  /// In en, this message translates to:
  /// **'No ratings yet'**
  String get ftNoRatingsYet;

  /// No description provided for @ftNoDataYet.
  ///
  /// In en, this message translates to:
  /// **'No data yet'**
  String get ftNoDataYet;

  /// No description provided for @ftNotEnoughTrendData.
  ///
  /// In en, this message translates to:
  /// **'Not enough data for a trend yet'**
  String get ftNotEnoughTrendData;

  /// No description provided for @ftCouldNotLoadAttendancePull.
  ///
  /// In en, this message translates to:
  /// **'Could not load attendance. Pull to retry.'**
  String get ftCouldNotLoadAttendancePull;

  /// No description provided for @ftOnlineTime.
  ///
  /// In en, this message translates to:
  /// **'Online time'**
  String get ftOnlineTime;

  /// No description provided for @ftTotalTrips.
  ///
  /// In en, this message translates to:
  /// **'Total trips'**
  String get ftTotalTrips;

  /// No description provided for @ftShiftsBooked.
  ///
  /// In en, this message translates to:
  /// **'Shifts booked'**
  String get ftShiftsBooked;

  /// No description provided for @ftTodaysProgress.
  ///
  /// In en, this message translates to:
  /// **'Today’s progress'**
  String get ftTodaysProgress;

  /// No description provided for @ftOnlineHours.
  ///
  /// In en, this message translates to:
  /// **'Online hours'**
  String get ftOnlineHours;

  /// No description provided for @ftActiveDays.
  ///
  /// In en, this message translates to:
  /// **'Active days'**
  String get ftActiveDays;

  /// No description provided for @ftShiftsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Shifts completed'**
  String get ftShiftsCompleted;

  /// No description provided for @ftTripsPerDay.
  ///
  /// In en, this message translates to:
  /// **'Trips per day'**
  String get ftTripsPerDay;

  /// No description provided for @ftOnlineHoursPerDay.
  ///
  /// In en, this message translates to:
  /// **'Online hours per day'**
  String get ftOnlineHoursPerDay;

  /// No description provided for @ftTapBarForDetails.
  ///
  /// In en, this message translates to:
  /// **'Tap a bar for day details'**
  String get ftTapBarForDetails;

  /// No description provided for @ftNoActivityThisWeek.
  ///
  /// In en, this message translates to:
  /// **'No activity recorded this week'**
  String get ftNoActivityThisWeek;

  /// No description provided for @ftTripCountOne.
  ///
  /// In en, this message translates to:
  /// **'{count} trip'**
  String ftTripCountOne(String count);

  /// No description provided for @ftTripCountMany.
  ///
  /// In en, this message translates to:
  /// **'{count} trips'**
  String ftTripCountMany(String count);

  /// No description provided for @ftWeekCalendar.
  ///
  /// In en, this message translates to:
  /// **'Week calendar'**
  String get ftWeekCalendar;

  /// No description provided for @ftTapDayForDetails.
  ///
  /// In en, this message translates to:
  /// **'Tap a day to see online time and trips'**
  String get ftTapDayForDetails;

  /// No description provided for @ftNoDaysYet.
  ///
  /// In en, this message translates to:
  /// **'No days to show yet.'**
  String get ftNoDaysYet;

  /// No description provided for @ftNoActivity.
  ///
  /// In en, this message translates to:
  /// **'No activity'**
  String get ftNoActivity;

  /// No description provided for @ftHours.
  ///
  /// In en, this message translates to:
  /// **'Hours'**
  String get ftHours;

  /// No description provided for @ftAvgPerOrder.
  ///
  /// In en, this message translates to:
  /// **'Avg / order'**
  String get ftAvgPerOrder;

  /// No description provided for @ftEarningPerKm.
  ///
  /// In en, this message translates to:
  /// **'Earning per km'**
  String get ftEarningPerKm;

  /// No description provided for @ftAvgPerActiveDay.
  ///
  /// In en, this message translates to:
  /// **'{amount} avg / active day'**
  String ftAvgPerActiveDay(String amount);

  /// No description provided for @ftNoEarningsYetLower.
  ///
  /// In en, this message translates to:
  /// **'no earnings yet'**
  String get ftNoEarningsYetLower;

  /// No description provided for @ftWeeklyEarningsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Weekly earnings unavailable right now'**
  String get ftWeeklyEarningsUnavailable;

  /// No description provided for @ftTodaysEarningsTimeline.
  ///
  /// In en, this message translates to:
  /// **'Today\'s earnings timeline'**
  String get ftTodaysEarningsTimeline;

  /// No description provided for @ftCumulativeEarningsDesc.
  ///
  /// In en, this message translates to:
  /// **'Cumulative earnings after each delivery'**
  String get ftCumulativeEarningsDesc;

  /// No description provided for @ftAmountTotal.
  ///
  /// In en, this message translates to:
  /// **'{amount} total'**
  String ftAmountTotal(String amount);

  /// No description provided for @ftOrderCountOne.
  ///
  /// In en, this message translates to:
  /// **'{count} order'**
  String ftOrderCountOne(String count);

  /// No description provided for @ftOrderCountMany.
  ///
  /// In en, this message translates to:
  /// **'{count} orders'**
  String ftOrderCountMany(String count);

  /// No description provided for @ftGigsNoBookingNeeded.
  ///
  /// In en, this message translates to:
  /// **'Gigs do not need booking. Go online when the gig is live to join automatically.'**
  String get ftGigsNoBookingNeeded;

  /// No description provided for @ftAddAtLeastOneLeaveDate.
  ///
  /// In en, this message translates to:
  /// **'Add at least one leave date'**
  String get ftAddAtLeastOneLeaveDate;

  /// No description provided for @ftReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Reason is required'**
  String get ftReasonRequired;

  /// No description provided for @ftLeaveRequestSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Leave request submitted'**
  String get ftLeaveRequestSubmitted;

  /// No description provided for @ftCasualLeave.
  ///
  /// In en, this message translates to:
  /// **'Casual leave'**
  String get ftCasualLeave;

  /// No description provided for @ftSickLeave.
  ///
  /// In en, this message translates to:
  /// **'Sick leave'**
  String get ftSickLeave;

  /// No description provided for @ftEarnedLeave.
  ///
  /// In en, this message translates to:
  /// **'Earned leave'**
  String get ftEarnedLeave;

  /// No description provided for @ftUnpaidLeave.
  ///
  /// In en, this message translates to:
  /// **'Unpaid leave'**
  String get ftUnpaidLeave;

  /// No description provided for @ftLeaveTypeGeneric.
  ///
  /// In en, this message translates to:
  /// **'{type} leave'**
  String ftLeaveTypeGeneric(String type);

  /// No description provided for @ftApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get ftApproved;

  /// No description provided for @ftRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get ftRejected;

  /// No description provided for @ftApplyLeave.
  ///
  /// In en, this message translates to:
  /// **'Apply Leave'**
  String get ftApplyLeave;

  /// No description provided for @ftApplyLeaveSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Request time off with one or more dates'**
  String get ftApplyLeaveSubtitle;

  /// No description provided for @ftTypeOfLeave.
  ///
  /// In en, this message translates to:
  /// **'Type of leave'**
  String get ftTypeOfLeave;

  /// No description provided for @ftLeaveTypeCasual.
  ///
  /// In en, this message translates to:
  /// **'Casual'**
  String get ftLeaveTypeCasual;

  /// No description provided for @ftLeaveTypeSick.
  ///
  /// In en, this message translates to:
  /// **'Sick'**
  String get ftLeaveTypeSick;

  /// No description provided for @ftLeaveTypeEarned.
  ///
  /// In en, this message translates to:
  /// **'Earned'**
  String get ftLeaveTypeEarned;

  /// No description provided for @ftLeaveTypeUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid'**
  String get ftLeaveTypeUnpaid;

  /// No description provided for @ftReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get ftReason;

  /// No description provided for @ftReasonHint.
  ///
  /// In en, this message translates to:
  /// **'Why do you need leave?'**
  String get ftReasonHint;

  /// No description provided for @ftLeaveDates.
  ///
  /// In en, this message translates to:
  /// **'Leave dates'**
  String get ftLeaveDates;

  /// No description provided for @ftLeaveDatesHint.
  ///
  /// In en, this message translates to:
  /// **'Add one or more dates. Non-continuous days supported.'**
  String get ftLeaveDatesHint;

  /// No description provided for @ftAddDate.
  ///
  /// In en, this message translates to:
  /// **'Add date'**
  String get ftAddDate;

  /// No description provided for @ftSubmitting.
  ///
  /// In en, this message translates to:
  /// **'Submitting…'**
  String get ftSubmitting;

  /// No description provided for @ftSubmitLeaveRequest.
  ///
  /// In en, this message translates to:
  /// **'Submit leave request'**
  String get ftSubmitLeaveRequest;

  /// No description provided for @ftMyLeaveRequests.
  ///
  /// In en, this message translates to:
  /// **'My leave requests'**
  String get ftMyLeaveRequests;

  /// No description provided for @ftNoLeaveRequestsYet.
  ///
  /// In en, this message translates to:
  /// **'No leave requests yet.'**
  String get ftNoLeaveRequestsYet;

  /// No description provided for @ftAdminNote.
  ///
  /// In en, this message translates to:
  /// **'Admin note: {note}'**
  String ftAdminNote(String note);

  /// No description provided for @ftCouldNotSubmitLeave.
  ///
  /// In en, this message translates to:
  /// **'Could not submit leave'**
  String get ftCouldNotSubmitLeave;

  /// No description provided for @ftRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'Request failed ({code})'**
  String ftRequestFailed(String code);

  /// No description provided for @ftCouldNotMarkAttendance.
  ///
  /// In en, this message translates to:
  /// **'Could not mark attendance'**
  String get ftCouldNotMarkAttendance;

  /// No description provided for @ftKmRange.
  ///
  /// In en, this message translates to:
  /// **'{min} – {max} KM'**
  String ftKmRange(String min, String max);

  /// No description provided for @pkStatusReadyForPickup.
  ///
  /// In en, this message translates to:
  /// **'Ready for pickup'**
  String get pkStatusReadyForPickup;

  /// No description provided for @pkStatusOnTheWayToFarm.
  ///
  /// In en, this message translates to:
  /// **'On the way to farm'**
  String get pkStatusOnTheWayToFarm;

  /// No description provided for @pkStatusReachedFarm.
  ///
  /// In en, this message translates to:
  /// **'Reached the farm'**
  String get pkStatusReachedFarm;

  /// No description provided for @pkStatusOrderChecked.
  ///
  /// In en, this message translates to:
  /// **'Order checked'**
  String get pkStatusOrderChecked;

  /// No description provided for @pkStatusQrVerified.
  ///
  /// In en, this message translates to:
  /// **'QR verified'**
  String get pkStatusQrVerified;

  /// No description provided for @pkStatusPickupConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Pickup confirmed'**
  String get pkStatusPickupConfirmed;

  /// No description provided for @pkStatusOnTheWayToCentre.
  ///
  /// In en, this message translates to:
  /// **'On the way to centre'**
  String get pkStatusOnTheWayToCentre;

  /// No description provided for @pkStatusAtCollectionCentre.
  ///
  /// In en, this message translates to:
  /// **'At collection centre'**
  String get pkStatusAtCollectionCentre;

  /// No description provided for @pkStatusReceived.
  ///
  /// In en, this message translates to:
  /// **'Received'**
  String get pkStatusReceived;

  /// No description provided for @pkStepAcceptOrReject.
  ///
  /// In en, this message translates to:
  /// **'Accept or reject'**
  String get pkStepAcceptOrReject;

  /// No description provided for @pkHintOpenToAcceptOrReject.
  ///
  /// In en, this message translates to:
  /// **'Open pickup to accept or reject'**
  String get pkHintOpenToAcceptOrReject;

  /// No description provided for @pkStepLeftForPickup.
  ///
  /// In en, this message translates to:
  /// **'Left for pickup'**
  String get pkStepLeftForPickup;

  /// No description provided for @pkHintStatusWillBecome.
  ///
  /// In en, this message translates to:
  /// **'Status will become {status}'**
  String pkHintStatusWillBecome(String status);

  /// No description provided for @pkStepCheckOrder.
  ///
  /// In en, this message translates to:
  /// **'Check order'**
  String get pkStepCheckOrder;

  /// No description provided for @pkHintOpenToVerifyOrder.
  ///
  /// In en, this message translates to:
  /// **'Open pickup to verify the order'**
  String get pkHintOpenToVerifyOrder;

  /// No description provided for @pkStepScanFarmerQr.
  ///
  /// In en, this message translates to:
  /// **'Scan Farmer QR'**
  String get pkStepScanFarmerQr;

  /// No description provided for @pkHintOpenToScanQr.
  ///
  /// In en, this message translates to:
  /// **'Open pickup to scan QR'**
  String get pkHintOpenToScanQr;

  /// No description provided for @pkStepConfirmPickup.
  ///
  /// In en, this message translates to:
  /// **'Confirm pickup'**
  String get pkStepConfirmPickup;

  /// No description provided for @pkHintOpenToConfirmWithPhoto.
  ///
  /// In en, this message translates to:
  /// **'Open pickup to confirm with photo'**
  String get pkHintOpenToConfirmWithPhoto;

  /// No description provided for @pkStepReachedCollectionCentre.
  ///
  /// In en, this message translates to:
  /// **'Reached collection centre'**
  String get pkStepReachedCollectionCentre;

  /// No description provided for @pkUnitKg.
  ///
  /// In en, this message translates to:
  /// **'Kg'**
  String get pkUnitKg;

  /// No description provided for @pkUnitGram.
  ///
  /// In en, this message translates to:
  /// **'g'**
  String get pkUnitGram;

  /// No description provided for @pkUnitQuintal.
  ///
  /// In en, this message translates to:
  /// **'Quintal'**
  String get pkUnitQuintal;

  /// No description provided for @pkUnitTon.
  ///
  /// In en, this message translates to:
  /// **'Ton'**
  String get pkUnitTon;

  /// No description provided for @pkUnitCrate.
  ///
  /// In en, this message translates to:
  /// **'Crate'**
  String get pkUnitCrate;

  /// No description provided for @pkUnitBox.
  ///
  /// In en, this message translates to:
  /// **'Box'**
  String get pkUnitBox;

  /// No description provided for @pkUnitBag.
  ///
  /// In en, this message translates to:
  /// **'Bag'**
  String get pkUnitBag;

  /// No description provided for @pkUnitPiece.
  ///
  /// In en, this message translates to:
  /// **'Piece'**
  String get pkUnitPiece;

  /// No description provided for @pkUnitDozen.
  ///
  /// In en, this message translates to:
  /// **'Dozen'**
  String get pkUnitDozen;

  /// No description provided for @pkUnitBunch.
  ///
  /// In en, this message translates to:
  /// **'Bunch'**
  String get pkUnitBunch;

  /// No description provided for @pkGradeValue.
  ///
  /// In en, this message translates to:
  /// **'Grade {grade}'**
  String pkGradeValue(String grade);

  /// No description provided for @pkProduce.
  ///
  /// In en, this message translates to:
  /// **'Produce'**
  String get pkProduce;

  /// No description provided for @pkOrdersCount.
  ///
  /// In en, this message translates to:
  /// **'{count} orders'**
  String pkOrdersCount(String count);

  /// No description provided for @pkDriver.
  ///
  /// In en, this message translates to:
  /// **'Driver'**
  String get pkDriver;

  /// No description provided for @pkLoginFailed.
  ///
  /// In en, this message translates to:
  /// **'Login failed'**
  String get pkLoginFailed;

  /// No description provided for @pkSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Session expired'**
  String get pkSessionExpired;

  /// No description provided for @pkRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'Request failed ({code})'**
  String pkRequestFailed(String code);

  /// No description provided for @pkNewPickupAssigned.
  ///
  /// In en, this message translates to:
  /// **'New pickup assigned'**
  String get pkNewPickupAssigned;

  /// No description provided for @pkCopiedValue.
  ///
  /// In en, this message translates to:
  /// **'Copied {value}'**
  String pkCopiedValue(String value);

  /// No description provided for @pkTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get pkTotal;

  /// No description provided for @pkClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get pkClose;

  /// No description provided for @pkNoQr.
  ///
  /// In en, this message translates to:
  /// **'No QR'**
  String get pkNoQr;

  /// No description provided for @pkOrderQr.
  ///
  /// In en, this message translates to:
  /// **'Order QR'**
  String get pkOrderQr;

  /// No description provided for @pkScanToViewOrderDetails.
  ///
  /// In en, this message translates to:
  /// **'Scan to view order details'**
  String get pkScanToViewOrderDetails;

  /// No description provided for @pkBatchQr.
  ///
  /// In en, this message translates to:
  /// **'Batch QR'**
  String get pkBatchQr;

  /// No description provided for @pkScanToViewBatchDetails.
  ///
  /// In en, this message translates to:
  /// **'Scan to view all batch details'**
  String get pkScanToViewBatchDetails;

  /// No description provided for @pkTotalWeightOrdered.
  ///
  /// In en, this message translates to:
  /// **'Total weight (ordered)'**
  String get pkTotalWeightOrdered;

  /// No description provided for @pkPackedWeight.
  ///
  /// In en, this message translates to:
  /// **'Packed weight'**
  String get pkPackedWeight;

  /// No description provided for @pkPackages.
  ///
  /// In en, this message translates to:
  /// **'Packages'**
  String get pkPackages;

  /// No description provided for @pkOrderValue.
  ///
  /// In en, this message translates to:
  /// **'Order value'**
  String get pkOrderValue;

  /// No description provided for @pkPickups.
  ///
  /// In en, this message translates to:
  /// **'Pickups'**
  String get pkPickups;

  /// No description provided for @pkLeave.
  ///
  /// In en, this message translates to:
  /// **'Leave'**
  String get pkLeave;

  /// No description provided for @pkJustNow.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get pkJustNow;

  /// No description provided for @pkMinutesAgo.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min ago'**
  String pkMinutesAgo(String minutes);

  /// No description provided for @pkHoursAgo.
  ///
  /// In en, this message translates to:
  /// **'{hours} h ago'**
  String pkHoursAgo(String hours);

  /// No description provided for @pkNotificationsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.\nNew pickups assigned by your vendor will appear here.'**
  String get pkNotificationsEmpty;

  /// No description provided for @pksRejectPickupTitle.
  ///
  /// In en, this message translates to:
  /// **'Reject this pickup?'**
  String get pksRejectPickupTitle;

  /// No description provided for @pksRejectPickupBody.
  ///
  /// In en, this message translates to:
  /// **'It will go back to the vendor to assign another driver.'**
  String get pksRejectPickupBody;

  /// No description provided for @pksReasonOptional.
  ///
  /// In en, this message translates to:
  /// **'Reason (optional)'**
  String get pksReasonOptional;

  /// No description provided for @pksPickupRejectedSent.
  ///
  /// In en, this message translates to:
  /// **'Pickup rejected and sent back to the vendor.'**
  String get pksPickupRejectedSent;

  /// No description provided for @pksPickupAccepted.
  ///
  /// In en, this message translates to:
  /// **'Pickup accepted.'**
  String get pksPickupAccepted;

  /// No description provided for @pksPickupAcceptedHint.
  ///
  /// In en, this message translates to:
  /// **'Pickup accepted. Tap \"Left for pickup\" when you leave.'**
  String get pksPickupAcceptedHint;

  /// No description provided for @pksLeftForPickup.
  ///
  /// In en, this message translates to:
  /// **'Left for pickup.'**
  String get pksLeftForPickup;

  /// No description provided for @pksLeftForPickupOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'Left for pickup — On the way'**
  String get pksLeftForPickupOnTheWay;

  /// No description provided for @pksLeftForPickupStatus.
  ///
  /// In en, this message translates to:
  /// **'Left for pickup. Status is On the way to farm.'**
  String get pksLeftForPickupStatus;

  /// No description provided for @pksReachedFarmDone.
  ///
  /// In en, this message translates to:
  /// **'Reached the farm.'**
  String get pksReachedFarmDone;

  /// No description provided for @pksReachedFarmButton.
  ///
  /// In en, this message translates to:
  /// **'Reached the farm'**
  String get pksReachedFarmButton;

  /// No description provided for @pksOrderChecked.
  ///
  /// In en, this message translates to:
  /// **'Order checked.'**
  String get pksOrderChecked;

  /// No description provided for @pksQrVerifiedSuccess.
  ///
  /// In en, this message translates to:
  /// **'QR Verified Successfully'**
  String get pksQrVerifiedSuccess;

  /// No description provided for @pksQrVerifiedCheckItems.
  ///
  /// In en, this message translates to:
  /// **'QR verified — check the items'**
  String get pksQrVerifiedCheckItems;

  /// No description provided for @pksMatchItemsBeforeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Match every item, grade and weight with the farmer before confirming.'**
  String get pksMatchItemsBeforeConfirm;

  /// No description provided for @pksItemsMatchConfirm.
  ///
  /// In en, this message translates to:
  /// **'Items match — confirm pickup'**
  String get pksItemsMatchConfirm;

  /// No description provided for @pksLater.
  ///
  /// In en, this message translates to:
  /// **'Later'**
  String get pksLater;

  /// No description provided for @pksPickupConfirmedStatus.
  ///
  /// In en, this message translates to:
  /// **'Pickup confirmed. Status is PICKED UP.'**
  String get pksPickupConfirmedStatus;

  /// No description provided for @pksCouldNotOpenDialer.
  ///
  /// In en, this message translates to:
  /// **'Could not open dialer'**
  String get pksCouldNotOpenDialer;

  /// No description provided for @pksCouldNotOpenMap.
  ///
  /// In en, this message translates to:
  /// **'Could not open map'**
  String get pksCouldNotOpenMap;

  /// No description provided for @pksOrderTitle.
  ///
  /// In en, this message translates to:
  /// **'Order {id}'**
  String pksOrderTitle(String id);

  /// No description provided for @pksNewPickupAssignedToYou.
  ///
  /// In en, this message translates to:
  /// **'New pickup assigned to you'**
  String get pksNewPickupAssignedToYou;

  /// No description provided for @pksAcceptOrRejectHint.
  ///
  /// In en, this message translates to:
  /// **'Check the details and items below, then accept to start this pickup or reject to send it back to the vendor.'**
  String get pksAcceptOrRejectHint;

  /// No description provided for @pksYourCurrentStatus.
  ///
  /// In en, this message translates to:
  /// **'YOUR CURRENT STATUS'**
  String get pksYourCurrentStatus;

  /// No description provided for @pksNextStep.
  ///
  /// In en, this message translates to:
  /// **'Next: {step}'**
  String pksNextStep(String step);

  /// No description provided for @pksUpdateStepHint.
  ///
  /// In en, this message translates to:
  /// **'Update the step below so farmer, manager and vendor can see what you are doing.'**
  String get pksUpdateStepHint;

  /// No description provided for @pksLotBatchId.
  ///
  /// In en, this message translates to:
  /// **'Lot / Batch ID'**
  String get pksLotBatchId;

  /// No description provided for @pksShowBatchQr.
  ///
  /// In en, this message translates to:
  /// **'Show batch QR'**
  String get pksShowBatchQr;

  /// No description provided for @pksShowOrderQr.
  ///
  /// In en, this message translates to:
  /// **'Show order QR'**
  String get pksShowOrderQr;

  /// No description provided for @pksPickupProgress.
  ///
  /// In en, this message translates to:
  /// **'Pickup progress'**
  String get pksPickupProgress;

  /// No description provided for @pksPickupDetails.
  ///
  /// In en, this message translates to:
  /// **'Pickup details'**
  String get pksPickupDetails;

  /// No description provided for @pksOrderId.
  ///
  /// In en, this message translates to:
  /// **'Order ID'**
  String get pksOrderId;

  /// No description provided for @pksFarmerName.
  ///
  /// In en, this message translates to:
  /// **'Farmer Name'**
  String get pksFarmerName;

  /// No description provided for @pksFarmerLocation.
  ///
  /// In en, this message translates to:
  /// **'Farmer Location'**
  String get pksFarmerLocation;

  /// No description provided for @pksProduct.
  ///
  /// In en, this message translates to:
  /// **'Product'**
  String get pksProduct;

  /// No description provided for @pksQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get pksQuantity;

  /// No description provided for @pksPackageCount.
  ///
  /// In en, this message translates to:
  /// **'Package Count'**
  String get pksPackageCount;

  /// No description provided for @pksPickupDateTime.
  ///
  /// In en, this message translates to:
  /// **'Pickup Date/Time'**
  String get pksPickupDateTime;

  /// No description provided for @pksPickupInstructions.
  ///
  /// In en, this message translates to:
  /// **'Pickup Instructions'**
  String get pksPickupInstructions;

  /// No description provided for @pksDefaultPickupInstructions.
  ///
  /// In en, this message translates to:
  /// **'Follow farm access and packing notes.'**
  String get pksDefaultPickupInstructions;

  /// No description provided for @pksCallFarmer.
  ///
  /// In en, this message translates to:
  /// **'Call Farmer'**
  String get pksCallFarmer;

  /// No description provided for @pksViewLocation.
  ///
  /// In en, this message translates to:
  /// **'View Location'**
  String get pksViewLocation;

  /// No description provided for @pksItemsToCollect.
  ///
  /// In en, this message translates to:
  /// **'Items to collect'**
  String get pksItemsToCollect;

  /// No description provided for @pksCheckItemsThenScan.
  ///
  /// In en, this message translates to:
  /// **'Check each item, grade and weight with the farmer, then scan the Farmer QR.'**
  String get pksCheckItemsThenScan;

  /// No description provided for @pksDriverArrivedAtPickup.
  ///
  /// In en, this message translates to:
  /// **'Driver has arrived at pickup location.'**
  String get pksDriverArrivedAtPickup;

  /// No description provided for @pksOrderVerification.
  ///
  /// In en, this message translates to:
  /// **'Order verification'**
  String get pksOrderVerification;

  /// No description provided for @pksProductName.
  ///
  /// In en, this message translates to:
  /// **'Product Name'**
  String get pksProductName;

  /// No description provided for @pksVariety.
  ///
  /// In en, this message translates to:
  /// **'Variety'**
  String get pksVariety;

  /// No description provided for @pksGrade.
  ///
  /// In en, this message translates to:
  /// **'Grade'**
  String get pksGrade;

  /// No description provided for @pksOrderedQuantity.
  ///
  /// In en, this message translates to:
  /// **'Ordered Quantity'**
  String get pksOrderedQuantity;

  /// No description provided for @pksPackedQuantity.
  ///
  /// In en, this message translates to:
  /// **'Packed Quantity'**
  String get pksPackedQuantity;

  /// No description provided for @pksPickupLocation.
  ///
  /// In en, this message translates to:
  /// **'Pickup Location'**
  String get pksPickupLocation;

  /// No description provided for @pksCheckOrder.
  ///
  /// In en, this message translates to:
  /// **'Check Order'**
  String get pksCheckOrder;

  /// No description provided for @pksOrderCheckedScanNext.
  ///
  /// In en, this message translates to:
  /// **'Order checked. Scan Farmer QR next.'**
  String get pksOrderCheckedScanNext;

  /// No description provided for @pksScanFarmerQr.
  ///
  /// In en, this message translates to:
  /// **'Scan Farmer QR'**
  String get pksScanFarmerQr;

  /// No description provided for @pksScanQrToVerifyOrder.
  ///
  /// In en, this message translates to:
  /// **'Scan the QR shown by the farmer to verify this order.'**
  String get pksScanQrToVerifyOrder;

  /// No description provided for @pksAtFarmScanHint.
  ///
  /// In en, this message translates to:
  /// **'At the farm? Scanning the Farmer QR marks you as reached, checks the order and verifies the QR in one step.'**
  String get pksAtFarmScanHint;

  /// No description provided for @pksOpenCameraAndScan.
  ///
  /// In en, this message translates to:
  /// **'Open camera & scan'**
  String get pksOpenCameraAndScan;

  /// No description provided for @pksOrPasteFarmerQr.
  ///
  /// In en, this message translates to:
  /// **'Or paste the scanned Farmer QR value:'**
  String get pksOrPasteFarmerQr;

  /// No description provided for @pksPasteFarmerQr.
  ///
  /// In en, this message translates to:
  /// **'Paste Farmer QR'**
  String get pksPasteFarmerQr;

  /// No description provided for @pksVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get pksVerify;

  /// No description provided for @pksOrderSummary.
  ///
  /// In en, this message translates to:
  /// **'Order summary'**
  String get pksOrderSummary;

  /// No description provided for @pksFarmer.
  ///
  /// In en, this message translates to:
  /// **'Farmer'**
  String get pksFarmer;

  /// No description provided for @pksDriver.
  ///
  /// In en, this message translates to:
  /// **'Driver'**
  String get pksDriver;

  /// No description provided for @pksVehicleNumber.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Number'**
  String get pksVehicleNumber;

  /// No description provided for @pksConfirmOrderPickup.
  ///
  /// In en, this message translates to:
  /// **'Confirm order pickup'**
  String get pksConfirmOrderPickup;

  /// No description provided for @pksPickupConfirmedFromFarmer.
  ///
  /// In en, this message translates to:
  /// **'Pickup confirmed from farmer.'**
  String get pksPickupConfirmedFromFarmer;

  /// No description provided for @pksOnTheWayToCentre.
  ///
  /// In en, this message translates to:
  /// **'On the way to centre'**
  String get pksOnTheWayToCentre;

  /// No description provided for @pksOnTheWayToCentreDone.
  ///
  /// In en, this message translates to:
  /// **'On the way to centre.'**
  String get pksOnTheWayToCentreDone;

  /// No description provided for @pksReachedCollectionCentre.
  ///
  /// In en, this message translates to:
  /// **'Reached collection centre'**
  String get pksReachedCollectionCentre;

  /// No description provided for @pksAtCollectionCentre.
  ///
  /// In en, this message translates to:
  /// **'At collection centre.'**
  String get pksAtCollectionCentre;

  /// No description provided for @pksWaitingForCentreReceiving.
  ///
  /// In en, this message translates to:
  /// **'At collection centre. Waiting for centre receiving.'**
  String get pksWaitingForCentreReceiving;

  /// No description provided for @pksReceivedAtCentre.
  ///
  /// In en, this message translates to:
  /// **'Received at collection centre.'**
  String get pksReceivedAtCentre;

  /// No description provided for @pksCopiedValue.
  ///
  /// In en, this message translates to:
  /// **'Copied {value}'**
  String pksCopiedValue(String value);

  /// No description provided for @pksPhotoTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Photo is too large. Try again.'**
  String get pksPhotoTooLarge;

  /// No description provided for @pksCouldNotGetPhoto.
  ///
  /// In en, this message translates to:
  /// **'Could not get photo: {error}'**
  String pksCouldNotGetPhoto(String error);

  /// No description provided for @pksConfirmPickup.
  ///
  /// In en, this message translates to:
  /// **'Confirm Pickup'**
  String get pksConfirmPickup;

  /// No description provided for @pksConfirmReceivedQuestion.
  ///
  /// In en, this message translates to:
  /// **'Confirm that you have received this order from the farmer?'**
  String get pksConfirmReceivedQuestion;

  /// No description provided for @pksPickupPhotosCount.
  ///
  /// In en, this message translates to:
  /// **'Pickup photos ({count}/{max})'**
  String pksPickupPhotosCount(String count, String max);

  /// No description provided for @pksTakeLivePhotoHint.
  ///
  /// In en, this message translates to:
  /// **'Take a live photo of the goods (at least 1, up to 4).'**
  String get pksTakeLivePhotoHint;

  /// No description provided for @pksGallery.
  ///
  /// In en, this message translates to:
  /// **'Gallery'**
  String get pksGallery;

  /// No description provided for @pksPickupOrders.
  ///
  /// In en, this message translates to:
  /// **'Pickup Orders'**
  String get pksPickupOrders;

  /// No description provided for @pksAssignedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Update status when you leave for the farm.'**
  String get pksAssignedSubtitle;

  /// No description provided for @pksNoAssignedPickups.
  ///
  /// In en, this message translates to:
  /// **'No assigned pickups.'**
  String get pksNoAssignedPickups;

  /// No description provided for @pksProgressSubtitle.
  ///
  /// In en, this message translates to:
  /// **'On the way, at farm, confirming, or returning to the centre.'**
  String get pksProgressSubtitle;

  /// No description provided for @pksNoPickupsInProgress.
  ///
  /// In en, this message translates to:
  /// **'No pickups in progress.'**
  String get pksNoPickupsInProgress;

  /// No description provided for @pksCompletedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Received at the collection centre.'**
  String get pksCompletedSubtitle;

  /// No description provided for @pksNoCompletedPickups.
  ///
  /// In en, this message translates to:
  /// **'No completed pickups.'**
  String get pksNoCompletedPickups;

  /// No description provided for @pksHistorySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Finished pickups at the collection centre.'**
  String get pksHistorySubtitle;

  /// No description provided for @pksNoPickupHistory.
  ///
  /// In en, this message translates to:
  /// **'No pickup history yet.'**
  String get pksNoPickupHistory;

  /// No description provided for @pksPackagesCount.
  ///
  /// In en, this message translates to:
  /// **'{count} pkgs'**
  String pksPackagesCount(String count);

  /// No description provided for @pksShowQr.
  ///
  /// In en, this message translates to:
  /// **'Show QR'**
  String get pksShowQr;

  /// No description provided for @pksOrdersInBatchOne.
  ///
  /// In en, this message translates to:
  /// **'{count} order in this batch'**
  String pksOrdersInBatchOne(String count);

  /// No description provided for @pksOrdersInBatchMany.
  ///
  /// In en, this message translates to:
  /// **'{count} orders in this batch'**
  String pksOrdersInBatchMany(String count);

  /// No description provided for @pksDriverId.
  ///
  /// In en, this message translates to:
  /// **'Driver ID'**
  String get pksDriverId;

  /// No description provided for @pksVehicleId.
  ///
  /// In en, this message translates to:
  /// **'Vehicle ID'**
  String get pksVehicleId;

  /// No description provided for @pksBatchDetails.
  ///
  /// In en, this message translates to:
  /// **'Batch details'**
  String get pksBatchDetails;

  /// No description provided for @pksOverview.
  ///
  /// In en, this message translates to:
  /// **'Overview'**
  String get pksOverview;

  /// No description provided for @pksNoQr.
  ///
  /// In en, this message translates to:
  /// **'No QR'**
  String get pksNoQr;

  /// No description provided for @pksTapQrToEnlarge.
  ///
  /// In en, this message translates to:
  /// **'Tap the QR to enlarge'**
  String get pksTapQrToEnlarge;

  /// No description provided for @pksCollectionCentre.
  ///
  /// In en, this message translates to:
  /// **'Collection Centre'**
  String get pksCollectionCentre;

  /// No description provided for @pksDriverMobile.
  ///
  /// In en, this message translates to:
  /// **'Driver Mobile'**
  String get pksDriverMobile;

  /// No description provided for @pksFarmers.
  ///
  /// In en, this message translates to:
  /// **'Farmers'**
  String get pksFarmers;

  /// No description provided for @pksProducts.
  ///
  /// In en, this message translates to:
  /// **'Products'**
  String get pksProducts;

  /// No description provided for @pksOrdersInBatchTitle.
  ///
  /// In en, this message translates to:
  /// **'Orders in this batch ({count})'**
  String pksOrdersInBatchTitle(String count);

  /// No description provided for @pksNoOrders.
  ///
  /// In en, this message translates to:
  /// **'No orders'**
  String get pksNoOrders;

  /// No description provided for @pksLeaveCasual.
  ///
  /// In en, this message translates to:
  /// **'Casual'**
  String get pksLeaveCasual;

  /// No description provided for @pksLeaveSick.
  ///
  /// In en, this message translates to:
  /// **'Sick'**
  String get pksLeaveSick;

  /// No description provided for @pksLeaveEarned.
  ///
  /// In en, this message translates to:
  /// **'Earned'**
  String get pksLeaveEarned;

  /// No description provided for @pksLeaveUnpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid'**
  String get pksLeaveUnpaid;

  /// No description provided for @pksLeaveTypeTitle.
  ///
  /// In en, this message translates to:
  /// **'{type} leave'**
  String pksLeaveTypeTitle(String type);

  /// No description provided for @pksAddLeaveDateError.
  ///
  /// In en, this message translates to:
  /// **'Add at least one leave date'**
  String get pksAddLeaveDateError;

  /// No description provided for @pksEnterReasonError.
  ///
  /// In en, this message translates to:
  /// **'Please enter a reason'**
  String get pksEnterReasonError;

  /// No description provided for @pksLeaveSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Leave request submitted'**
  String get pksLeaveSubmitted;

  /// No description provided for @pksApplyForLeave.
  ///
  /// In en, this message translates to:
  /// **'Apply for leave'**
  String get pksApplyForLeave;

  /// No description provided for @pksLeaveIntro.
  ///
  /// In en, this message translates to:
  /// **'Pickup drivers can request leave with one or more dates.'**
  String get pksLeaveIntro;

  /// No description provided for @pksTypeOfLeave.
  ///
  /// In en, this message translates to:
  /// **'Type of leave'**
  String get pksTypeOfLeave;

  /// No description provided for @pksReason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get pksReason;

  /// No description provided for @pksLeaveReasonHint.
  ///
  /// In en, this message translates to:
  /// **'Why do you need leave?'**
  String get pksLeaveReasonHint;

  /// No description provided for @pksLeaveDates.
  ///
  /// In en, this message translates to:
  /// **'Leave dates'**
  String get pksLeaveDates;

  /// No description provided for @pksLeaveDatesHint.
  ///
  /// In en, this message translates to:
  /// **'Add one or more dates. Non-continuous days are supported.'**
  String get pksLeaveDatesHint;

  /// No description provided for @pksAddDate.
  ///
  /// In en, this message translates to:
  /// **'Add date'**
  String get pksAddDate;

  /// No description provided for @pksSubmitLeaveRequest.
  ///
  /// In en, this message translates to:
  /// **'Submit leave request'**
  String get pksSubmitLeaveRequest;

  /// No description provided for @pksMyLeaveRequests.
  ///
  /// In en, this message translates to:
  /// **'My leave requests'**
  String get pksMyLeaveRequests;

  /// No description provided for @pksNoLeaveRequests.
  ///
  /// In en, this message translates to:
  /// **'No leave requests yet.'**
  String get pksNoLeaveRequests;

  /// No description provided for @pksLeaveApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get pksLeaveApproved;

  /// No description provided for @pksLeaveRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get pksLeaveRejected;

  /// No description provided for @pksAdminNote.
  ///
  /// In en, this message translates to:
  /// **'Admin note: {note}'**
  String pksAdminNote(String note);

  /// No description provided for @pksScanQrShownByFarmer.
  ///
  /// In en, this message translates to:
  /// **'Scan the QR shown by the farmer'**
  String get pksScanQrShownByFarmer;

  /// No description provided for @pksQrNoMatch.
  ///
  /// In en, this message translates to:
  /// **'This QR does not match any of your open pickups.'**
  String get pksQrNoMatch;

  /// No description provided for @pksPickupDriverUpper.
  ///
  /// In en, this message translates to:
  /// **'PICKUP DRIVER'**
  String get pksPickupDriverUpper;

  /// No description provided for @pksHomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Farm pickups to the collection centre'**
  String get pksHomeSubtitle;

  /// No description provided for @pksLatestCount.
  ///
  /// In en, this message translates to:
  /// **'Latest {count}'**
  String pksLatestCount(String count);

  /// No description provided for @pksViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get pksViewAll;

  /// No description provided for @pksNoRecentPickups.
  ///
  /// In en, this message translates to:
  /// **'No recent pickups'**
  String get pksNoRecentPickups;

  /// No description provided for @pksNextUp.
  ///
  /// In en, this message translates to:
  /// **'NEXT UP'**
  String get pksNextUp;

  /// No description provided for @pksOpenPickup.
  ///
  /// In en, this message translates to:
  /// **'Open pickup'**
  String get pksOpenPickup;

  /// No description provided for @pksNewPickupAssigned.
  ///
  /// In en, this message translates to:
  /// **'New pickup assigned'**
  String get pksNewPickupAssigned;

  /// No description provided for @pksDismiss.
  ///
  /// In en, this message translates to:
  /// **'Dismiss'**
  String get pksDismiss;

  /// No description provided for @pksPickupWhen.
  ///
  /// In en, this message translates to:
  /// **'Pickup {when}'**
  String pksPickupWhen(String when);

  /// No description provided for @pksLogOutTitle.
  ///
  /// In en, this message translates to:
  /// **'Log out?'**
  String get pksLogOutTitle;

  /// No description provided for @pksLogOutBody.
  ///
  /// In en, this message translates to:
  /// **'You will need your mobile and password to log in again.'**
  String get pksLogOutBody;

  /// No description provided for @pksLogOut.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get pksLogOut;

  /// No description provided for @pksProfileRole.
  ///
  /// In en, this message translates to:
  /// **'Pickup Driver · Farm → Collection centre'**
  String get pksProfileRole;

  /// No description provided for @pksMobile.
  ///
  /// In en, this message translates to:
  /// **'Mobile'**
  String get pksMobile;

  /// No description provided for @pksArea.
  ///
  /// In en, this message translates to:
  /// **'Area'**
  String get pksArea;

  /// No description provided for @pksPolicies.
  ///
  /// In en, this message translates to:
  /// **'Policies'**
  String get pksPolicies;

  /// No description provided for @pksNoPolicies.
  ///
  /// In en, this message translates to:
  /// **'No policies published yet.'**
  String get pksNoPolicies;

  /// No description provided for @pksPolicy.
  ///
  /// In en, this message translates to:
  /// **'Policy'**
  String get pksPolicy;

  /// No description provided for @pksStatusInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get pksStatusInactive;

  /// No description provided for @pksTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get pksTryAgain;

  /// No description provided for @pksCameraUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Camera unavailable'**
  String get pksCameraUnavailable;

  /// No description provided for @pksCameraStartFailed.
  ///
  /// In en, this message translates to:
  /// **'Unable to start the camera. Go back and paste the QR value instead.'**
  String get pksCameraStartFailed;

  /// No description provided for @pksCameraPermissionNeeded.
  ///
  /// In en, this message translates to:
  /// **'Camera permission needed'**
  String get pksCameraPermissionNeeded;

  /// No description provided for @pksAllowCameraToScan.
  ///
  /// In en, this message translates to:
  /// **'Allow camera access to scan the Farmer QR.'**
  String get pksAllowCameraToScan;

  /// No description provided for @pksOpenAppSettings.
  ///
  /// In en, this message translates to:
  /// **'Open app settings'**
  String get pksOpenAppSettings;

  /// No description provided for @pksPointCameraHint.
  ///
  /// In en, this message translates to:
  /// **'Point the camera at the Farmer QR shown by the farmer.'**
  String get pksPointCameraHint;

  /// No description provided for @svcDarkStore.
  ///
  /// In en, this message translates to:
  /// **'Dark Store'**
  String get svcDarkStore;

  /// No description provided for @svcNearby.
  ///
  /// In en, this message translates to:
  /// **'nearby'**
  String get svcNearby;

  /// No description provided for @svcScanStoreQrToUnlock.
  ///
  /// In en, this message translates to:
  /// **'Scan Store QR to Unlock'**
  String get svcScanStoreQrToUnlock;

  /// No description provided for @svcPreOrder.
  ///
  /// In en, this message translates to:
  /// **'Pre-order'**
  String get svcPreOrder;

  /// No description provided for @svcNotPickupQr.
  ///
  /// In en, this message translates to:
  /// **'This is not a pickup QR'**
  String get svcNotPickupQr;

  /// No description provided for @svcOrderUnlocked.
  ///
  /// In en, this message translates to:
  /// **'Order unlocked'**
  String get svcOrderUnlocked;

  /// No description provided for @svcCouldNotVerifyQr.
  ///
  /// In en, this message translates to:
  /// **'Could not verify this QR'**
  String get svcCouldNotVerifyQr;

  /// No description provided for @svcNetworkErrorTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Network error — try again'**
  String get svcNetworkErrorTryAgain;

  /// No description provided for @svcNetworkError.
  ///
  /// In en, this message translates to:
  /// **'Network error. Please try again.'**
  String get svcNetworkError;

  /// No description provided for @svcIncorrectOtp.
  ///
  /// In en, this message translates to:
  /// **'Incorrect OTP. Ask the customer for their order OTP.'**
  String get svcIncorrectOtp;

  /// No description provided for @svcCouldNotMarkFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not mark delivery as failed.'**
  String get svcCouldNotMarkFailed;

  /// No description provided for @svcCouldNotSendDelay.
  ///
  /// In en, this message translates to:
  /// **'Could not send the delay.'**
  String get svcCouldNotSendDelay;

  /// No description provided for @svcCouldNotUploadDeliveryPhoto.
  ///
  /// In en, this message translates to:
  /// **'Could not upload delivery photo.'**
  String get svcCouldNotUploadDeliveryPhoto;

  /// No description provided for @svcOtpVerificationFailed.
  ///
  /// In en, this message translates to:
  /// **'OTP verification failed'**
  String get svcOtpVerificationFailed;

  /// No description provided for @svcCashConfirmationFailed.
  ///
  /// In en, this message translates to:
  /// **'Cash confirmation failed'**
  String get svcCashConfirmationFailed;

  /// No description provided for @svcCouldNotCheckRazorpay.
  ///
  /// In en, this message translates to:
  /// **'Could not check Razorpay. Please try again.'**
  String get svcCouldNotCheckRazorpay;

  /// No description provided for @svcInvalidReturnQr.
  ///
  /// In en, this message translates to:
  /// **'Invalid return QR'**
  String get svcInvalidReturnQr;

  /// No description provided for @svcPhotoUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Photo upload failed'**
  String get svcPhotoUploadFailed;

  /// No description provided for @svcCouldNotMarkReturnedToStore.
  ///
  /// In en, this message translates to:
  /// **'Could not mark returned to store'**
  String get svcCouldNotMarkReturnedToStore;

  /// No description provided for @svcFailedToSendOtp.
  ///
  /// In en, this message translates to:
  /// **'Failed to send OTP ({code})'**
  String svcFailedToSendOtp(String code);

  /// No description provided for @svcLoginAgainForOnboarding.
  ///
  /// In en, this message translates to:
  /// **'Please login again to continue onboarding'**
  String get svcLoginAgainForOnboarding;

  /// No description provided for @svcCouldNotSaveOnboarding.
  ///
  /// In en, this message translates to:
  /// **'Could not save onboarding data ({code})'**
  String svcCouldNotSaveOnboarding(String code);

  /// No description provided for @svcCouldNotUpdateStatus.
  ///
  /// In en, this message translates to:
  /// **'Could not update status'**
  String get svcCouldNotUpdateStatus;

  /// No description provided for @svcCannotReachServerAt.
  ///
  /// In en, this message translates to:
  /// **'Cannot reach {url}'**
  String svcCannotReachServerAt(String url);

  /// No description provided for @svcCouldNotLoadAreas.
  ///
  /// In en, this message translates to:
  /// **'Could not load areas ({code})'**
  String svcCouldNotLoadAreas(String code);

  /// No description provided for @svcUnableToReachServer.
  ///
  /// In en, this message translates to:
  /// **'Unable to reach server'**
  String get svcUnableToReachServer;

  /// No description provided for @svcAuthenticationFailed.
  ///
  /// In en, this message translates to:
  /// **'Authentication failed'**
  String get svcAuthenticationFailed;

  /// No description provided for @svcInvalidServerResponse.
  ///
  /// In en, this message translates to:
  /// **'Invalid server response'**
  String get svcInvalidServerResponse;

  /// No description provided for @svcLocationVerificationComplete.
  ///
  /// In en, this message translates to:
  /// **'Location verification complete'**
  String get svcLocationVerificationComplete;

  /// No description provided for @svcCannotVerifyLocation.
  ///
  /// In en, this message translates to:
  /// **'Cannot verify location. Please check server connection.'**
  String get svcCannotVerifyLocation;

  /// No description provided for @svcStoreGig.
  ///
  /// In en, this message translates to:
  /// **'Store Gig'**
  String get svcStoreGig;

  /// No description provided for @svcNewDeliveryOffer.
  ///
  /// In en, this message translates to:
  /// **'New Delivery Offer!'**
  String get svcNewDeliveryOffer;

  /// No description provided for @svcEarnAmount.
  ///
  /// In en, this message translates to:
  /// **'Earn ₹{amount}'**
  String svcEarnAmount(String amount);

  /// No description provided for @svcOfferForOrder.
  ///
  /// In en, this message translates to:
  /// **'New delivery offer for Order #{number}. Tap to review and accept!'**
  String svcOfferForOrder(String number);

  /// No description provided for @svcOfferAvailable.
  ///
  /// In en, this message translates to:
  /// **'New delivery offer available. Tap to review and accept!'**
  String get svcOfferAvailable;

  /// No description provided for @svcProfileVerifiedBody.
  ///
  /// In en, this message translates to:
  /// **'Your profile has been verified! You can now go online and receive orders.'**
  String get svcProfileVerifiedBody;

  /// No description provided for @svcVerificationStatusUpdate.
  ///
  /// In en, this message translates to:
  /// **'Verification Status Update'**
  String get svcVerificationStatusUpdate;

  /// No description provided for @svcReviewVerificationDetails.
  ///
  /// In en, this message translates to:
  /// **'Please review your verification details in the app.'**
  String get svcReviewVerificationDetails;

  /// No description provided for @svcGreenGrocAlert.
  ///
  /// In en, this message translates to:
  /// **'GreenGroc Alert'**
  String get svcGreenGrocAlert;

  /// No description provided for @svcGreenGrocDelivery.
  ///
  /// In en, this message translates to:
  /// **'GreenGroc Delivery'**
  String get svcGreenGrocDelivery;

  /// No description provided for @svcDurationMinutes.
  ///
  /// In en, this message translates to:
  /// **'{minutes} minute'**
  String svcDurationMinutes(String minutes);

  /// No description provided for @svcDurationHours.
  ///
  /// In en, this message translates to:
  /// **'{hours} hr'**
  String svcDurationHours(String hours);

  /// No description provided for @svcDurationHoursMinutes.
  ///
  /// In en, this message translates to:
  /// **'{hours} hr {minutes} minute'**
  String svcDurationHoursMinutes(String hours, String minutes);

  /// No description provided for @uiAssignedOrders.
  ///
  /// In en, this message translates to:
  /// **'Assigned Orders'**
  String get uiAssignedOrders;

  /// No description provided for @uiMyRules.
  ///
  /// In en, this message translates to:
  /// **'My Rules'**
  String get uiMyRules;

  /// No description provided for @uiApplyLeave.
  ///
  /// In en, this message translates to:
  /// **'Apply Leave'**
  String get uiApplyLeave;

  /// No description provided for @uiRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get uiRetry;

  /// No description provided for @uiUnread.
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get uiUnread;

  /// No description provided for @uiWelcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome to\nDelivery Partner'**
  String get uiWelcomeTitle;

  /// No description provided for @uiWelcomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Deliver orders. Earn on your time.\nBe your own boss.'**
  String get uiWelcomeSubtitle;

  /// No description provided for @uiByContinuingAgreePrefix.
  ///
  /// In en, this message translates to:
  /// **'By continuing, you agree to our\n'**
  String get uiByContinuingAgreePrefix;

  /// No description provided for @uiByContinuingAgreeSuffix.
  ///
  /// In en, this message translates to:
  /// **'.'**
  String get uiByContinuingAgreeSuffix;

  /// No description provided for @uiRegistrationSuccessful.
  ///
  /// In en, this message translates to:
  /// **'Registration Successful!'**
  String get uiRegistrationSuccessful;

  /// No description provided for @uiRegistrationSuccessBody.
  ///
  /// In en, this message translates to:
  /// **'Your application has been submitted\nsuccessfully. We will verify your\ndocuments and notify you soon.'**
  String get uiRegistrationSuccessBody;

  /// No description provided for @uiSelectState.
  ///
  /// In en, this message translates to:
  /// **'Select State'**
  String get uiSelectState;

  /// No description provided for @uiSelectStateSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Please select your state'**
  String get uiSelectStateSubtitle;

  /// No description provided for @uiSearchState.
  ///
  /// In en, this message translates to:
  /// **'Search state'**
  String get uiSearchState;

  /// No description provided for @uiSelectCityIn.
  ///
  /// In en, this message translates to:
  /// **'Please select your city in {state}'**
  String uiSelectCityIn(String state);

  /// No description provided for @uiSelectCitySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Please select your city'**
  String get uiSelectCitySubtitle;

  /// No description provided for @uiNoCitiesFound.
  ///
  /// In en, this message translates to:
  /// **'No cities found'**
  String get uiNoCitiesFound;

  /// No description provided for @uiSelectAreaIn.
  ///
  /// In en, this message translates to:
  /// **'Please select your area in {city}'**
  String uiSelectAreaIn(String city);

  /// No description provided for @uiSelectAreaSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Please select your area'**
  String get uiSelectAreaSubtitle;

  /// No description provided for @uiFetchingDarkStore.
  ///
  /// In en, this message translates to:
  /// **'Fetching Dark Store location details...'**
  String get uiFetchingDarkStore;

  /// No description provided for @uiCouldNotCheckDarkStores.
  ///
  /// In en, this message translates to:
  /// **'Could not check dark stores'**
  String get uiCouldNotCheckDarkStores;

  /// No description provided for @uiCheckConnectionTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Check your connection and try again.'**
  String get uiCheckConnectionTryAgain;

  /// No description provided for @uiActiveHub.
  ///
  /// In en, this message translates to:
  /// **'ACTIVE HUB'**
  String get uiActiveHub;

  /// No description provided for @uiPinCode.
  ///
  /// In en, this message translates to:
  /// **'PIN {pincode}'**
  String uiPinCode(String pincode);

  /// No description provided for @uiStoreManagerContact.
  ///
  /// In en, this message translates to:
  /// **'Store Manager Contact: {phone}'**
  String uiStoreManagerContact(String phone);

  /// No description provided for @uiNoDarkStoreRegistered.
  ///
  /// In en, this message translates to:
  /// **'No Dark Store Registered'**
  String get uiNoDarkStoreRegistered;

  /// No description provided for @uiNoHubRegistered.
  ///
  /// In en, this message translates to:
  /// **'NO HUB REGISTERED'**
  String get uiNoHubRegistered;

  /// No description provided for @uiNoDarkStoreInArea.
  ///
  /// In en, this message translates to:
  /// **'No delivery manager has registered a dark store hub in {area} yet.'**
  String uiNoDarkStoreInArea(String area);

  /// No description provided for @uiEmploymentType.
  ///
  /// In en, this message translates to:
  /// **'Employment Type'**
  String get uiEmploymentType;

  /// No description provided for @uiPartTime.
  ///
  /// In en, this message translates to:
  /// **'Part-Time'**
  String get uiPartTime;

  /// No description provided for @uiPartTimeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Flexible shifts — work when you want'**
  String get uiPartTimeSubtitle;

  /// No description provided for @uiFullTime.
  ///
  /// In en, this message translates to:
  /// **'Full-Time'**
  String get uiFullTime;

  /// No description provided for @uiFullTimeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Fixed shifts — stable monthly salary'**
  String get uiFullTimeSubtitle;

  /// No description provided for @uiProfileDetails.
  ///
  /// In en, this message translates to:
  /// **'Profile Details'**
  String get uiProfileDetails;

  /// No description provided for @uiProfileDetailsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell us more about yourself'**
  String get uiProfileDetailsSubtitle;

  /// No description provided for @uiEmailOptional.
  ///
  /// In en, this message translates to:
  /// **'Email (Optional)'**
  String get uiEmailOptional;

  /// No description provided for @uiEmailAddress.
  ///
  /// In en, this message translates to:
  /// **'Email Address'**
  String get uiEmailAddress;

  /// No description provided for @uiDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of Birth'**
  String get uiDateOfBirth;

  /// No description provided for @uiDateHint.
  ///
  /// In en, this message translates to:
  /// **'DD/MM/YYYY'**
  String get uiDateHint;

  /// No description provided for @uiEmergencyContact.
  ///
  /// In en, this message translates to:
  /// **'Emergency Contact'**
  String get uiEmergencyContact;

  /// No description provided for @uiEmergencyContactMobile.
  ///
  /// In en, this message translates to:
  /// **'Emergency Contact Mobile'**
  String get uiEmergencyContactMobile;

  /// No description provided for @uiReviewSubmit.
  ///
  /// In en, this message translates to:
  /// **'Review & Submit'**
  String get uiReviewSubmit;

  /// No description provided for @uiReviewSubmitSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Please review your details before\nsubmitting'**
  String get uiReviewSubmitSubtitle;

  /// No description provided for @uiLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get uiLocation;

  /// No description provided for @uiDocDl.
  ///
  /// In en, this message translates to:
  /// **'DL'**
  String get uiDocDl;

  /// No description provided for @uiDocRc.
  ///
  /// In en, this message translates to:
  /// **'RC'**
  String get uiDocRc;

  /// No description provided for @uiConfirmDetailsCorrect.
  ///
  /// In en, this message translates to:
  /// **'I confirm that all the above details\nare correct.'**
  String get uiConfirmDetailsCorrect;

  /// No description provided for @uiSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get uiSubmit;

  /// No description provided for @uiDocsSafeSecure.
  ///
  /// In en, this message translates to:
  /// **'Your documents are safe and secure with us.'**
  String get uiDocsSafeSecure;

  /// No description provided for @uiUploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading…'**
  String get uiUploading;

  /// No description provided for @uiUploaded.
  ///
  /// In en, this message translates to:
  /// **'Uploaded'**
  String get uiUploaded;

  /// No description provided for @uiDocsTapToView.
  ///
  /// In en, this message translates to:
  /// **'Tap a photo to view full size'**
  String get uiDocsTapToView;

  /// No description provided for @uiDocsViewOnly.
  ///
  /// In en, this message translates to:
  /// **'Documents are view-only. Contact your Delivery Manager to update them.'**
  String get uiDocsViewOnly;

  /// No description provided for @uiUploadedDocuments.
  ///
  /// In en, this message translates to:
  /// **'Uploaded documents'**
  String get uiUploadedDocuments;

  /// No description provided for @uiNotUploaded.
  ///
  /// In en, this message translates to:
  /// **'Not uploaded'**
  String get uiNotUploaded;

  /// No description provided for @uiDocPassport.
  ///
  /// In en, this message translates to:
  /// **'Passport'**
  String get uiDocPassport;

  /// No description provided for @uiDocStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get uiDocStatusApproved;

  /// No description provided for @uiDocStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get uiDocStatusRejected;

  /// No description provided for @uiUnderReview.
  ///
  /// In en, this message translates to:
  /// **'Under Review'**
  String get uiUnderReview;

  /// No description provided for @uiVehicleScreenSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Vehicle information & registered documents'**
  String get uiVehicleScreenSubtitle;

  /// No description provided for @uiVehicleTypeMotorcycle.
  ///
  /// In en, this message translates to:
  /// **'Motorcycle / Bike'**
  String get uiVehicleTypeMotorcycle;

  /// No description provided for @uiVehicleTypeElectric.
  ///
  /// In en, this message translates to:
  /// **'Electric Vehicle (EV)'**
  String get uiVehicleTypeElectric;

  /// No description provided for @uiVehicleTypeBicycle.
  ///
  /// In en, this message translates to:
  /// **'Bicycle / Cycle'**
  String get uiVehicleTypeBicycle;

  /// No description provided for @uiVehicleTypeVan.
  ///
  /// In en, this message translates to:
  /// **'Delivery Van / Auto'**
  String get uiVehicleTypeVan;

  /// No description provided for @uiVehicleTypeOnFoot.
  ///
  /// In en, this message translates to:
  /// **'Walker / On Foot'**
  String get uiVehicleTypeOnFoot;

  /// No description provided for @uiNotSpecified.
  ///
  /// In en, this message translates to:
  /// **'Not Specified'**
  String get uiNotSpecified;

  /// No description provided for @uiNoPlateNumber.
  ///
  /// In en, this message translates to:
  /// **'NO PLATE NUMBER'**
  String get uiNoPlateNumber;

  /// No description provided for @uiAssignedPartnerVehicle.
  ///
  /// In en, this message translates to:
  /// **'Assigned Delivery Partner Vehicle'**
  String get uiAssignedPartnerVehicle;

  /// No description provided for @uiVehicleSpecifications.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Specifications'**
  String get uiVehicleSpecifications;

  /// No description provided for @uiVehicleType.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Type'**
  String get uiVehicleType;

  /// No description provided for @uiNotAssigned.
  ///
  /// In en, this message translates to:
  /// **'Not Assigned'**
  String get uiNotAssigned;

  /// No description provided for @uiPropulsionCategory.
  ///
  /// In en, this message translates to:
  /// **'Propulsion / Category'**
  String get uiPropulsionCategory;

  /// No description provided for @uiPropulsionElectric.
  ///
  /// In en, this message translates to:
  /// **'Electric (EV)'**
  String get uiPropulsionElectric;

  /// No description provided for @uiPropulsionPedal.
  ///
  /// In en, this message translates to:
  /// **'Manual Pedal'**
  String get uiPropulsionPedal;

  /// No description provided for @uiPropulsionPetrol.
  ///
  /// In en, this message translates to:
  /// **'Motorized / Petrol'**
  String get uiPropulsionPetrol;

  /// No description provided for @uiRegistrationStatus.
  ///
  /// In en, this message translates to:
  /// **'Registration Status'**
  String get uiRegistrationStatus;

  /// No description provided for @uiDocumentsSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Documents Submitted'**
  String get uiDocumentsSubmitted;

  /// No description provided for @uiPendingDocuments.
  ///
  /// In en, this message translates to:
  /// **'Pending Documents'**
  String get uiPendingDocuments;

  /// No description provided for @uiVehicleDocsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Government & vehicle verification documents submitted for this vehicle.'**
  String get uiVehicleDocsSubtitle;

  /// No description provided for @uiVehicleRcFull.
  ///
  /// In en, this message translates to:
  /// **'Vehicle RC (Registration Certificate)'**
  String get uiVehicleRcFull;

  /// No description provided for @uiVehicleRcFullSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Official certificate of vehicle registration'**
  String get uiVehicleRcFullSubtitle;

  /// No description provided for @uiVehicleInsurance.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Insurance'**
  String get uiVehicleInsurance;

  /// No description provided for @uiVehicleInsuranceSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Valid motor insurance policy certificate'**
  String get uiVehicleInsuranceSubtitle;

  /// No description provided for @uiDrivingLicenceFull.
  ///
  /// In en, this message translates to:
  /// **'Driving Licence (DL)'**
  String get uiDrivingLicenceFull;

  /// No description provided for @uiDrivingLicenceFullSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Authorized motor vehicle driving permit'**
  String get uiDrivingLicenceFullSubtitle;

  /// No description provided for @uiVehicleManagedByManager.
  ///
  /// In en, this message translates to:
  /// **'Vehicle details and verification documents are managed by your Dark Store Delivery Manager. Contact your manager to update or change vehicles.'**
  String get uiVehicleManagedByManager;

  /// No description provided for @uiDocNumber.
  ///
  /// In en, this message translates to:
  /// **'Number: {number}'**
  String uiDocNumber(String number);

  /// No description provided for @uiTapToPreview.
  ///
  /// In en, this message translates to:
  /// **'Tap to preview'**
  String get uiTapToPreview;
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
