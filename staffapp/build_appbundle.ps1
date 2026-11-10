# =======================================================
#   GreenGrocc Staff App - Build Release App Bundle (.aab)
# =======================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   GreenGrocc Staff App - Building Release App Bundle" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$KeyPropertiesPath = Join-Path $ScriptDir "android\key.properties"
$KeystorePath = Join-Path $ScriptDir "android\upload-keystore.jks"

if (-not (Test-Path $KeyPropertiesPath)) {
    Write-Host "[WARNING] android\key.properties was not found!" -ForegroundColor Yellow
    Write-Host "Have you run .\generate_keystore.ps1 yet?" -ForegroundColor Yellow
    $Proceed = Read-Host "Do you want to continue anyway? (y/N)"
    if ($Proceed.ToLower() -ne "y") {
        Write-Host "Build cancelled. Please run .\generate_keystore.ps1 first." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] Found android\key.properties" -ForegroundColor Green
    if (Test-Path $KeystorePath) {
        Write-Host "[OK] Found android\upload-keystore.jks" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Step 1: Running flutter clean..." -ForegroundColor Cyan
flutter clean

Write-Host ""
Write-Host "Step 2: Fetching dependencies (flutter pub get)..." -ForegroundColor Cyan
flutter pub get

Write-Host ""
Write-Host "Step 3: Building Android App Bundle (flutter build appbundle --release)..." -ForegroundColor Cyan
flutter build appbundle --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed! Check the output logs above." -ForegroundColor Red
    exit 1
}

$AabPath = Join-Path $ScriptDir "build\app\outputs\bundle\release\app-release.aab"

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   SUCCESS: Production App Bundle Created!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Bundle Location: $AabPath" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open Google Play Console: https://play.google.com/console" -ForegroundColor White
Write-Host "2. Go to Testing -> Internal testing OR Production -> Releases" -ForegroundColor White
Write-Host "3. Upload the app-release.aab file from the location above." -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Green
