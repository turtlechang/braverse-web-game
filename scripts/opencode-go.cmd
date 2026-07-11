@echo off
setlocal EnableExtensions

set "OPENCODE_RUNTIME_ROOT=%USERPROFILE%\Documents\Codex\.opencode-runtime"
set "XDG_CONFIG_HOME=%OPENCODE_RUNTIME_ROOT%\config"
set "XDG_DATA_HOME=%OPENCODE_RUNTIME_ROOT%\data"
set "XDG_STATE_HOME=%OPENCODE_RUNTIME_ROOT%\state"
set "XDG_CACHE_HOME=%OPENCODE_RUNTIME_ROOT%\cache"
set "OPENCODE_CONFIG=%~dp0opencode-go.config.json"

if not defined NO_PROXY (
  set "NO_PROXY=localhost,127.0.0.1"
)

node "%~dp0opencode-go-wrapper.mjs" %*
exit /b %ERRORLEVEL%
