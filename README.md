# TS Storage Dwell Time Counter

This repository now includes a React + TypeScript web app for Excel file transformation.

## What it does

- Upload an Excel file (.xlsx or .xls)
- Read the first worksheet
- Add a new column named DummyComputedValue
- Apply a dummy math formula for each row
- Download the updated workbook as a new .xlsx file

Current dummy formula:

DummyComputedValue = average(all numeric cells in row) * 1.27 + 5

If a row has no numeric values, the app uses the row number as baseline.

## Tech stack

- Frontend: React + TypeScript (Vite)
- UI: Material UI
- Excel: xlsx
- Download: file-saver

## Run locally

1. Open a terminal in this repository.
2. Move into the app folder:
   cd app
3. Install dependencies:
   npm install
4. Start development server:
   npm run dev
5. Build production bundle:
   npm run build

## App location

The web app source code is inside the app folder.
