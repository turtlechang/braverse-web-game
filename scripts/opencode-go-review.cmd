@echo off
setlocal EnableExtensions

call "%~dp0opencode-go.cmd" run --agent review-fast --pure %*
exit /b %ERRORLEVEL%
