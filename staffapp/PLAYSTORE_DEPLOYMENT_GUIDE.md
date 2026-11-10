# 🚀 Google Play Store Deployment Guide for GreenGrocc Staff App

This guide covers everything required to generate production signing keys, build an **Android App Bundle (`.aab`)**, and publish the **GreenGrocc Staff App** to the **Google Play Store**.

---

## 📋 App Identification Details

| Parameter | Configuration |
| :--- | :--- |
| **App Name** | **GreenGrocc Staff** |
| **Package Name / Application ID** | `com.greengroo.staffapp` |
| **Target SDK Version** | Android 14+ (API 34/35) *(Google Play Requirement)* |
| **Minimum SDK Version** | Android 6.0+ (API 23+) |
| **Production API Base URL** | `https://api.greengrocc.com` |
| **Firebase Project** | `greengrocc-27df8` (Configured in `google-services.json`) |
| **Build Artifact** | Android App Bundle (`.aab`) |

---

## 🛠️ Step 1: Generate Release Keystore

Google Play requires all release App Bundles to be signed with a private upload key.

### Option A: Using the Automated Script (PowerShell / Windows)
From your terminal in the `staffapp` folder, run:

**In PowerShell:**
```powershell
cd staffapp
.\generate_keystore.ps1
```
*(Or if you prefer the batch file in PowerShell, run `.\generate_keystore.bat`)*

**In Command Prompt (cmd.exe):**
```cmd
cd staffapp
generate_keystore.bat
```
*(The script automatically locates your Java JDK and `keytool.exe` on Windows, prompts for a password, and creates both `android/upload-keystore.jks` and `android/key.properties`)*

### Option B: Manual Keystore Generation
Run this command from inside the `staffapp/android/` directory:
```bash
keytool -genkey -v -keystore upload-keystore.jks -alias greengroo_staff -keyalg RSA -keysize 2048 -validity 10000
```
Then create `staffapp/android/key.properties` with:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=greengroo_staff
storeFile=../upload-keystore.jks
```

> ⚠️ **IMPORTANT**: Never lose `upload-keystore.jks` or its passwords! Back it up securely. Google Play will not accept updates if the upload key does not match.

---

## 📦 Step 2: Build the Production App Bundle (`.aab`)

Google Play Console requires the **Android App Bundle (`.aab`)** format for all new app submissions.

### Option A: Using the Automated Build Script
**In PowerShell:**
```powershell
cd staffapp
.\build_appbundle.ps1
```
*(Or `.\build_appbundle.bat`)*

**In Command Prompt (cmd.exe):**
```cmd
cd staffapp
build_appbundle.bat
```

### Option B: Using Flutter CLI Directly
```bash
cd staffapp
flutter clean
flutter pub get
flutter build appbundle --release
```

Once the build finishes, your bundle will be located at:
```
staffapp/build/app/outputs/bundle/release/app-release.aab
```

---

## 📱 Step 3: Google Play Console Setup

1. **Log in to Google Play Console**: [play.google.com/console](https://play.google.com/console)
2. Click **Create app**:
   - **App name**: `GreenGrocc Staff`
   - **Default language**: English (United States or India)
   - **App or game**: App
   - **Free or paid**: Free
   - Accept the declarations and click **Create app**.

---

## 📝 Step 4: Store Listing & Store Presence

### 1. Main Store Listing
- **App name**: `GreenGrocc Staff`
- **Short description** (Up to 80 chars):
  ```
  GreenGrocc Staff operations, daily attendance punch, shift rosters, and work hub.
  ```
- **Full description** (Up to 4000 chars):
  ```
  GreenGrocc Staff is the official internal operations and HR companion for GreenGrocc employees, managers, and operational staff.

  Key Features:
  • Daily Attendance: Quick mobile punch-in and punch-out with shift duration tracking.
  • Shift Rosters: View your assigned shifts, working hours, and general schedules.
  • Leave Management: Apply for casual, sick, or earned leave and track approval status in real-time.
  • Salary & Payslips: Access your monthly salary breakdown, gross, net pay, and deductions.
  • Company Announcements: Stay informed with official GreenGrocc company notices and holidays.
  • Secure & Fast: Seamless login with OTP or company credentials.
  ```

### 2. Graphic Assets
- **App Icon**: `512 x 512 px` (32-bit PNG, up to 1 MB). You can export `staffapp/assets/icon.png` at 512x512.
- **Feature Graphic**: `1024 x 500 px` (PNG or JPEG).
- **Phone Screenshots**: Minimum 2 screenshots (Recommended: 4–6 screenshots showing Login, Dashboard, Attendance, and Shifts).

---

## 🔒 Step 5: Policy & Data Safety Declarations

In the Google Play Console under **Policy > App content**:

1. **Privacy Policy**:
   - URL: `https://greengrocc.com/privacy` or your company privacy policy page.
2. **App Access (Review Credentials)**:
   - Since this app requires a login, select **"All or some functionality is restricted"**.
   - Provide test staff credentials for the Google Reviewer:
     - **Username / Phone / Email**: e.g., staff test login credentials.
     - **Password**: test password.
     - **Instructions**: "Log in to view staff attendance, profile, and shifts dashboard."
3. **Ads**: Select **No, my app does not contain ads**.
4. **Target Audience**: Select **18 and over**.
5. **Data Safety**:
   - **Personal info**: Name, Email, Phone number (for employee profile/account management).
   - **Location**: Optional / Not collected without consent.
   - **App info and performance**: Crash logs.
   - **Data encryption in transit**: Yes, all traffic is sent over secure HTTPS (`https://api.greengrocc.com`).
   - **Account deletion**: Link to account deletion request page or in-app support.

---

## 🚀 Step 6: Create Release & Upload Bundle

1. Go to **Testing > Internal testing** (recommended for initial verification) or **Production > Create new release**.
2. Under **App bundles**, upload `app-release.aab` from:
   ```
   staffapp/build/app/outputs/bundle/release/app-release.aab
   ```
3. Enter **Release name**: `1.0.0 (1)`
4. Enter **Release notes**:
   ```
   Initial production release of GreenGrocc Staff operations app.
   - Mobile punch-in/out attendance
   - Shift rosters and schedule view
   - Leave applications and salary history
   - Real-time staff notifications
   ```
5. Click **Next** $\rightarrow$ **Review release** $\rightarrow$ **Start rollout**!

---

## 🔄 Future Version Updates

When rolling out updates in the future, increment the version in `staffapp/pubspec.yaml`:
```yaml
# Version format: <versionName>+<versionCode>
# Increment versionCode (+1) with every release!
version: 1.0.1+2
```
Then run `build_appbundle.bat` again and upload the new `.aab` file.
