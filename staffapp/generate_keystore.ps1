# =======================================================
#   GreenGrocc Staff App - Release Keystore Setup (PowerShell)
# =======================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$KeystoreName = "upload-keystore.jks"
$KeyAlias = "greengroo_staff"
$KeystorePath = Join-Path $ScriptDir "android\$KeystoreName"
$KeyPropertiesPath = Join-Path $ScriptDir "android\key.properties"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   GreenGrocc Staff App - Release Keystore Setup" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Find keytool executable
$KeytoolCmd = $null
if (Get-Command keytool -ErrorAction SilentlyContinue) {
    $KeytoolCmd = "keytool"
} else {
    $PotentialPaths = @(
        "C:\Program Files\Java\jdk-25\bin\keytool.exe",
        "C:\Program Files\Java\jdk-21\bin\keytool.exe",
        "C:\Program Files\Java\jdk-17\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    )
    foreach ($path in $PotentialPaths) {
        if (Test-Path $path) {
            $KeytoolCmd = $path
            break
        }
    }
    if (-not $KeytoolCmd) {
        $Found = Get-ChildItem -Path "C:\Program Files\Java" -Filter "keytool.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($Found) {
            $KeytoolCmd = $Found.FullName
        }
    }
}

if (-not $KeytoolCmd) {
    Write-Host "[ERROR] keytool executable could not be found." -ForegroundColor Red
    Write-Host "Please ensure Java JDK is installed or added to your PATH." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Using keytool from: $KeytoolCmd" -ForegroundColor Gray

if (Test-Path $KeystorePath) {
    Write-Host "[!] An existing keystore was found at: $KeystorePath" -ForegroundColor Yellow
    $Overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($Overwrite.ToLower() -ne "y") {
        Write-Host "Keystore creation cancelled. Existing keystore kept." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Please enter a password for your release keystore." -ForegroundColor Green
$Password = Read-Host "Enter Keystore Password (min 6 characters)"

if ([string]::IsNullOrWhiteSpace($Password) -or $Password.Length -lt 6) {
    Write-Host "[ERROR] Password must be at least 6 characters long!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Generating keystore at: $KeystorePath ..." -ForegroundColor Cyan

$KeytoolArgs = @(
    "-genkey", "-v",
    "-keystore", $KeystorePath,
    "-alias", $KeyAlias,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", $Password,
    "-keypass", $Password,
    "-dname", "CN=GreenGrocc Staff, OU=Operations, O=GreenGrocc, L=Bangalore, ST=Karnataka, C=IN"
)

& $KeytoolCmd $KeytoolArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] keytool failed to generate the keystore." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Writing $KeyPropertiesPath ..." -ForegroundColor Cyan
$PropertiesContent = @"
storePassword=$Password
keyPassword=$Password
keyAlias=$KeyAlias
storeFile=../$KeystoreName
"@

Set-Content -Path $KeyPropertiesPath -Value $PropertiesContent -Encoding ASCII

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   SUCCESS: Release Keystore and key.properties created!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Keystore:   $KeystorePath" -ForegroundColor White
Write-Host "Properties: $KeyPropertiesPath" -ForegroundColor White
Write-Host ""
Write-Host "You can now build the release App Bundle by running:" -ForegroundColor Cyan
Write-Host "   .\build_appbundle.ps1" -ForegroundColor Yellow
Write-Host "   or: flutter build appbundle --release" -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Green
