@echo off
setlocal

set "OPENCODE_RUNTIME_ROOT=%USERPROFILE%\Documents\Codex\.opencode-runtime"
set "XDG_CONFIG_HOME=%OPENCODE_RUNTIME_ROOT%\config"
set "XDG_DATA_HOME=%OPENCODE_RUNTIME_ROOT%\data"
set "XDG_STATE_HOME=%OPENCODE_RUNTIME_ROOT%\state"
set "XDG_CACHE_HOME=%OPENCODE_RUNTIME_ROOT%\cache"
set "OPENCODE_CONFIG=%~dp0opencode-go.config.json"

opencode.cmd %*
