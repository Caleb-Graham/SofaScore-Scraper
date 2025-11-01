# 🏓 SofaScore Data Scraper

A Chrome extension to extract comprehensive match data and player histories from SofaScore table tennis tournaments.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to a SofaScore tournament page (e.g., https://www.sofascore.com/tournament/table-tennis/poland/tt-elite-series/19041)
2. Click the extension icon in your toolbar
3. Click "Fetch TT Elite Series"
4. The extension will automatically:
   - Fetch all past and upcoming tournament events
   - Retrieve detailed statistics for each match
   - Fetch complete match history for each player in the tournament
   - Export everything to a single Excel file with multiple sheets

## Exported Data

The extension generates an Excel (.xlsx) file with:

### Tournament Matches Sheet

Each match record includes:

- Event ID
- Home Team & Away Team names
- Tournament name
- Home Games, Away Games, Total Games
- Games Over 18.5 / Games Under 18.5
- Home Points, Away Points, Total Points
- Sets Played
- Match Status
- Start Time (ISO format)
- Individual set scores (Home Set 1-7, Away Set 1-7)

### Player History Sheets

For each unique player in the tournament:

- Complete match history (up to 5 pages of past matches)
- Same detailed statistics as tournament matches
- Sorted by date (most recent first)
- Sheet named after the player

## Features

- ✅ One-click export - automatically fetches and exports everything
- ✅ Comprehensive player histories included
- ✅ Parallel data fetching for faster performance
- ✅ Excel format with multiple sheets for easy analysis
- ✅ Real-time progress updates
- ✅ Calculates over/under 18.5 points per game
- ✅ Works on all SofaScore tournament pages
- ✅ Dark theme UI with ping pong theme 🏓💰

## Use Cases

- Analyze betting patterns (over/under per game)
- Track player performance across tournaments
- Study head-to-head matchups
- Export complete tournament data with player context
- Statistical analysis of table tennis matches

## Note

This extension only works on sofascore.com tournament pages.
