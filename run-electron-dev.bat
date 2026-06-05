@echo off
cd /d "%~dp0"
npm.cmd install
npm.cmd run electron:dev
