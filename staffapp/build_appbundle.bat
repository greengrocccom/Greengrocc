@echo off
setlocal

echo =======================================================
echo   GreenGrocc Staff App - Production Build (App Bundle)
echo =======================================================
echo.

if not exist "android\key.properties" (
    echo [WARNING] android\key.properties was not found!
    echo If you build without key.properties, a debug-signed bundle will be generated.
    echo Google Play Store requires a release-signed bundle.
    echo.
    echo Please run generate_keystore.bat first to create your release keystore.
    echo.
    set /p PROCEED="Do you want to continue anyway? (y/N): "
    if /i not "%PROCEED%"=="y" goto :EOF
)

echo.
echo [1/3] Cleaning previous build artifacts...
call flutter clean

echo.
echo [2/3] Fetching dependencies...
call flutter pub get

echo.
echo [3/3] Building Android App Bundle (AAB) for Google Play Store...
call flutter build appbundle --release

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Flutter build failed! Check errors above.
    pause
    goto :EOF
)

echo.
echo =======================================================
echo   BUILD SUCCESSFUL!
echo =======================================================
echo Your release bundle is ready for Google Play Store at:
echo   build\app\outputs\bundle\release\app-release.aab
echo =======================================================
echo.
pause
