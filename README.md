# Outlook Batch Manager

Outlook / Hotmail account registration, login verification, token management, and account library tooling.

## Architecture

- `Electron + React`: the only frontend
- `Python`: local backend, automation runner, SQLite data layer, and CLI bridge
- `.example/`: read-only reference code, excluded from git

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .[dev]
cd .\electron-app
npm install
```

## Run

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

## Layout

- `src/outlook_batch_manager/` Python backend
- `electron-app/` Electron + React frontend
- `tests/` Python tests
