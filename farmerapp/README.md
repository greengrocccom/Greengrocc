# GreenGrocc Farmer Mobile App (Flutter)

A cross-platform Flutter mobile application for farmers in the GreenGrocc supply chain ecosystem, directly adapted from the web portal `D:\GreenGroo\farmer`.

## Key Features

1. **Dashboard (`DashboardScreen`)**: Real-time overview of active crops, pickup notifications, earnings, and harvest schedule.
2. **My Crops & Planning (`CropsScreen`)**: Complete 26-stage agricultural lifecycle tracking (from Planning Created to Harvest Batch Created & Completed).
3. **Farm Products (`ProductsScreen`)**: Manage farmer produce inventory, market rates, stock availability, and grade information.
4. **Orders & Harvest (`OrdersScreen`)**: Track pickup orders, assigned delivery drivers, preparing/ready status, and payout settlement.
5. **Farmer Profile (`ProfileScreen`)**: Land records, 7/12 Utara, Aadhaar KYC verification, bank settlement, and PM-KISAN schemes.

## Project Structure

```
farmerapp/
├── lib/
│   ├── core/
│   │   ├── constants/
│   │   │   └── app_colors.dart
│   │   └── theme/
│   │       └── app_theme.dart
│   ├── models/
│   │   └── crop_plan.dart
│   ├── screens/
│   │   ├── main_shell.dart
│   │   ├── dashboard/
│   │   │   └── dashboard_screen.dart
│   │   ├── crops/
│   │   │   └── crops_screen.dart
│   │   ├── products/
│   │   │   └── products_screen.dart
│   │   ├── orders/
│   │   │   └── orders_screen.dart
│   │   └── profile/
│   │       └── profile_screen.dart
│   └── main.dart
├── pubspec.yaml
└── test/
```

## Running the App

```bash
flutter pub get
flutter run
```
