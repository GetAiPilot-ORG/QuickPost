@echo off
echo Updating environment variables for Phase 2 OAuth...

REM Backup existing .env file
copy .env .env.backup >nul 2>&1

REM Update variable names using PowerShell
powershell -Command "(Get-Content .env) -replace 'YOUTUBE_CLIENT_ID=', 'GOOGLE_CLIENT_ID=' -replace 'YOUTUBE_CLIENT_SECRET=', 'GOOGLE_CLIENT_SECRET=' -replace 'YOUTUBE_REDIRECT_URI=', 'GOOGLE_REDIRECT_URI=' | Set-Content .env.temp"
move /Y .env.temp .env >nul 2>&1

REM Add JWT secret if not present
findstr /C:"JWT_SECRET" .env >nul 2>&1
if errorlevel 1 (
    echo. >> .env
    echo # JWT Authentication >> .env
    echo JWT_SECRET=quickpost-dev-secret-change-in-production-12345678901234567890 >> .env
    echo SESSION_SECRET=session-secret-change-in-production-09876543210987654321 >> .env
)

REM Add Instagram Login for Business credentials if not present
findstr /C:"IG_APP_ID" .env >nul 2>&1
if errorlevel 1 (
    echo. >> .env
    echo # Instagram Login for Business OAuth >> .env
    echo IG_APP_ID=your-instagram-app-id >> .env
    echo IG_APP_SECRET=your-instagram-app-secret >> .env
    echo IG_OAUTH_CALLBACK_URL=https://your-project.supabase.co/functions/v1/oauth-callback >> .env
    echo FACEBOOK_LOGIN_CONFIG_ID=your-facebook-login-for-business-config-id >> .env
)

echo ✓ Environment variables updated!
echo ✓ Backup saved to .env.backup
echo.
echo Please verify your .env file and restart the server.
echo.
pause
