$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
if (!(Test-Path $cacheDir)) { New-Item -ItemType Directory -Force -Path $cacheDir }
$zipPath = "$cacheDir\winCodeSign-2.6.0.7z"
Invoke-WebRequest -Uri "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z" -OutFile $zipPath
$extractPath = "$cacheDir\winCodeSign-2.6.0"
if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
& "d:\project\Code7\svn-merge-helper\node_modules\7zip-bin\win\x64\7za.exe" x -y $zipPath -o$extractPath -xr!darwin
