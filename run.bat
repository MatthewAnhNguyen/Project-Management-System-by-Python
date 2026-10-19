@echo off
title Project Management System Server
color 0A
echo ========================================================
echo DANG KHOI DONG HE THONG QUAN LY DU AN (FASTAPI + WEB UI)
echo ========================================================
echo.
echo [1] Giao dien Web:     http://127.0.0.1:8000/
echo [2] Tai lieu API:      http://127.0.0.1:8000/docs
echo.
echo Nhan Ctrl + C neu muon tat may chu.
echo ========================================================
echo.

if exist ".\.venv\Scripts\python.exe" (
    .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)
pause

