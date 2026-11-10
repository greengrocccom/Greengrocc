@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo   GreenGrocc Staff App - Release Keystore Setup
echo =======================================================
echo.

set KEYSTORE_NAME=upload-keystore.jks
set KEY_ALIAS=greengroo_staff
set KEYSTORE_PATH=android\%KEYSTORE_NAME%
set KEY_PROPERTIES=android\key.properties

if exist "%KEYSTORE_PATH%" (
    echo [!] An existing keystore was found at %KEYSTORE_PATH%
    set /p OVERWRITE="Do you want to overwrite it? (y/N): "
    if /i not "!OVERWRITE!"=="y" (
        echo Keystore creation cancelled. Existing keystore kept.
        goto :EOF
    )
)

echo.
echo Please enter a strong password for your release keystore.
set /p PASSWORD="Enter Keystore Password (min 6 characters): "

if "%PASSWORD%"=="" (
    echo [ERROR] Password cannot be empty!
    pause
    goto :EOF
)

set KEYTOOL_CMD=keytool
where keytool >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\Program Files\Java\jdk-25\bin\keytool.exe" (
        set "KEYTOOL_CMD=C:\Program Files\Java\jdk-25\bin\keytool.exe"
    ) else if exist "C:\Program Files\Java\jdk-21\bin\keytool.exe" (
        set "KEYTOOL_CMD=C:\Program Files\Java\jdk-21\bin\keytool.exe"
    ) else if exist "C:\Program Files\Java\jdk-17\bin\keytool.exe" (
        set "KEYTOOL_CMD=C:\Program Files\Java\jdk-17\bin\keytool.exe"
    ) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" (
        set "KEYTOOL_CMD=C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    )
)

echo.
echo Generating %KEYSTORE_PATH% ...
"!KEYTOOL_CMD!" -genkey -v -keystore "%KEYSTORE_PATH%" -alias %KEY_ALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass %PASSWORD% -keypass %PASSWORD% -dname "CN=GreenGrocc Staff, OU=Operations, O=GreenGrocc, L=Bangalore, ST=Karnataka, C=IN"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] keytool failed. Please ensure Java JDK is installed and in your PATH.
    pause
    goto :EOF
)

echo.
echo Creating %KEY_PROPERTIES% ...
(
    echo storePassword=%PASSWORD%
    echo keyPassword=%PASSWORD%
    echo keyAlias=%KEY_ALIAS%
    echo storeFile=../%KEYSTORE_NAME%
) > "%KEY_PROPERTIES%"

echo.
echo =======================================================
echo   SUCCESS: Release Keystore and key.properties created!
echo =======================================================
echo Keystore: %KEYSTORE_PATH%
echo Properties: %KEY_PROPERTIES%
echo.
echo You can now build the release appbundle by running:
echo   build_appbundle.bat
echo =======================================================
echo.
pause
