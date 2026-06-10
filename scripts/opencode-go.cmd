@echo off
setlocal EnableExtensions

set "OPENCODE_RUNTIME_ROOT=%USERPROFILE%\Documents\Codex\.opencode-runtime"
set "XDG_CONFIG_HOME=%OPENCODE_RUNTIME_ROOT%\config"
set "XDG_DATA_HOME=%OPENCODE_RUNTIME_ROOT%\data"
set "XDG_STATE_HOME=%OPENCODE_RUNTIME_ROOT%\state"
set "XDG_CACHE_HOME=%OPENCODE_RUNTIME_ROOT%\cache"
set "OPENCODE_CONFIG=%~dp0opencode-go.config.json"

if not defined OPENCODE_GO_API_KEY (
  echo [opencode-go] OPENCODE_GO_API_KEY is not set. 1>&2
  exit /b 2
)

set "OPENCODE_COMMAND=opencode.cmd"
where opencode.cmd >nul 2>&1
if errorlevel 1 (
  if exist "%APPDATA%\npm\opencode.cmd" (
    set "OPENCODE_COMMAND=%APPDATA%\npm\opencode.cmd"
  ) else (
    echo [opencode-go] opencode.cmd was not found in PATH or %%APPDATA%%\npm. 1>&2
    exit /b 127
  )
)

if not defined NO_PROXY (
  set "NO_PROXY=localhost,127.0.0.1"
)

call "%OPENCODE_COMMAND%" %*
set "OPENCODE_GO_EXIT_CODE=%ERRORLEVEL%"

if not "%OPENCODE_GO_EXIT_CODE%"=="0" (
  echo [opencode-go] Dispatch failed with exit code %OPENCODE_GO_EXIT_CODE%. 1>&2
  echo [opencode-go] In a restricted Codex environment, run this command with approved external network access. 1>&2
)

exit /b %OPENCODE_GO_EXIT_CODE%
