# GreenGrocc Customer App (Flutter)

Flutter port of the React customer storefront in `frontend/`.

- **Same backend:** `https://api.greengrocc.com`
- **Does not modify** `frontend/` or `backend/`
- Package / app id: `com.greengrocc.app`

## Run

```powershell
cd Customerapp
flutter pub get
flutter run
```

## Config

Copy `.env.example` → `.env` (already present for live API):

```
API_URL=https://api.greengrocc.com
STORE_URL=https://www.greengrocc.in
```

## Features (parity with frontend)

Home (multi-store), categories, products, cart, checkout (COD / Razorpay / UPI),
orders, profile, addresses, wishlist, rewards, coupons, support.

## Push notifications (optional)

Place `android/app/google-services.json`, then enable the
`com.google.gms.google-services` plugin in `android/app/build.gradle.kts`.
