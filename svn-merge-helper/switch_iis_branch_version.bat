echo off

cls

set /p ver="branches version:"

echo switch to %ver%

echo on

copy SettingFiles\%ver%\applicationHost.config C:\Windows\System32\inetsrv\config\applicationHost.config

pause