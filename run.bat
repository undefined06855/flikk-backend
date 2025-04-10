@echo off
cls
if "%1" == "--dev" goto dev
goto main

:dev
echo Using branch dev (if error is given run `git switch -c dev`)
git checkout dev
git pull origin dev
goto :skip

:main
echo Using branch main (use --dev as first arg to move to dev)
git checkout main
git pull origin main

:skip
@REM set ADMIN_PASSWORD=the admin password
node main %*
