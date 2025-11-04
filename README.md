# 🏓 SofaScore Data Scraper

A Chrome extension to extract comprehensive match data and player histories from SofaScore table tennis tournaments.

## Installation

1. Download this repository:

   - Click the green "Code" button
   - Select "Download ZIP"
   - Extract the ZIP file to a location on your computer

   Or clone with git:

   ```bash
   git clone https://github.com/Caleb-Graham/SofaScore-Scraper.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder from this project
6. The extension icon should appear in your toolbar

## Usage

1. Navigate to any SofaScore page (e.g., https://www.sofascore.com/)
2. Click the extension icon in your toolbar
3. Select a date from the date picker (defaults to today)
4. Optionally adjust the number of past matches to fetch per player (default: 200)
5. Click "Fetch TT Elite Series"
6. The extension will automatically:
   - Fetch all TT Elite Series matches for the selected date
   - Retrieve detailed statistics for each match
   - Fetch complete match history for each player
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

- ✅ Date-based filtering - select any date to fetch TT Elite Series matches
- ✅ Automatic tournament filtering - only extracts TT Elite Series events from all table tennis data
- ✅ One-click export - automatically fetches and exports everything
- ✅ Comprehensive player histories included
- ✅ Highly optimized parallel data fetching for fast performance
- ✅ Excel format with multiple sheets for easy analysis
- ✅ Real-time progress updates
- ✅ Calculates over/under 18.5 points per game
- ✅ Configurable match history depth per player
- ✅ Intelligent browser caching for efficiency
- ✅ Dark theme UI with ping pong theme 🏓💰

## Use Cases

- Analyze betting patterns (over/under per game)
- Track player performance across tournaments
- Study head-to-head matchups
- Export complete tournament data with player context
- Statistical analysis of table tennis matches

## Note

This extension specifically targets the TT Elite Series tournament from SofaScore's table tennis API. It requires an active sofascore.com page to be open to fetch data.
