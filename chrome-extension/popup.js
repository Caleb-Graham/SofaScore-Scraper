// Set default date to today
const today = new Date();
document.getElementById('pastMatchesDate').valueAsDate = today;

// Load cached history matches preference
const cachedHistoryMatches = localStorage.getItem('historyMatches');
if (cachedHistoryMatches) {
  document.getElementById('historyMatches').value = cachedHistoryMatches;
}

// Save history matches preference when changed
document.getElementById('historyMatches').addEventListener('input', (e) => {
  localStorage.setItem('historyMatches', e.target.value);
});

document.getElementById('fetchBtn').addEventListener('click', async () => {
  const button = document.getElementById('fetchBtn');
  const status = document.getElementById('status');
  
  button.disabled = true;
  button.textContent = 'Fetching...';
  status.style.display = 'none';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('sofascore.com')) {
      showStatus('Please navigate to a SofaScore page first', 'error');
      return;
    }
    
    await fetchAndExportWithHistories(tab);
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Fetch TT Elite Series';
  }
});

async function fetchAndExportWithHistories(tab) {
  showStatus('Fetching tournament matches...', 'info');
  
  // Get user preference for past matches date
  const pastMatchesDate = document.getElementById('pastMatchesDate').value;
  
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (dateString) => {
      try {
        let allEvents = [];
        
        // Format date as YYYY-MM-DD for the API
        let dateFormatted = dateString;
        if (!dateFormatted) {
          const today = new Date();
          dateFormatted = today.toISOString().split('T')[0];
        }
        
        const scheduledEventsUrl = `https://www.sofascore.com/api/v1/sport/table-tennis/scheduled-events/${dateFormatted}`;
        
        const response = await fetch(scheduledEventsUrl, {
          headers: { 
            'accept': '*/*', 
            'x-requested-with': '1f6364'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.events && data.events.length > 0) {
            const ttEliteEvents = data.events.filter(event => {
              const tournamentSlug = event.tournament?.slug || '';
              return tournamentSlug === 'tt-elite-series';
            });
            
            allEvents = ttEliteEvents;
          }
        } else {
          return { error: `Failed to fetch events: ${response.statusText}` };
        }
        
        return {
          pastEvents: allEvents,
          upcomingEvents: []
        };
      } catch (error) {
        return { error: error.message };
      }
    },
    args: [pastMatchesDate]
  });
  
  const data = result.result;
  
  if (data.error) {
    showStatus(`Error: ${data.error}`, 'error');
    return;
  }
  
  const totalEvents = (data.pastEvents?.length || 0) + (data.upcomingEvents?.length || 0);
  
  if (totalEvents === 0) {
    showStatus('No events found for this tournament', 'error');
    return;
  }
  
  showStatus(`Found ${data.pastEvents?.length || 0} TT Elite Series events. Starting export...`, 'info');
  
  // Combine all events and remove duplicates by event ID
  const allEvents = [...(data.pastEvents || []), ...(data.upcomingEvents || [])];
  const uniqueEvents = [];
  const seenEventIds = new Set();
  
  for (const event of allEvents) {
    if (!seenEventIds.has(event.id)) {
      seenEventIds.add(event.id);
      uniqueEvents.push(event);
    }
  }
  
  // Immediately export with player histories
  await exportWithPlayerHistories(uniqueEvents, tab);
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = type;
  status.style.display = 'block';
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function calculateSetStats(homeScore, awayScore, defaultPeriodCount = 5) {
  const maxPeriods = Math.max(defaultPeriodCount, 7);
  const sets = [];
  
  for (let i = 1; i <= maxPeriods; i++) {
    const homeSetScore = safeNum(homeScore[`period${i}`]);
    const awaySetScore = safeNum(awayScore[`period${i}`]);
    
    if (homeSetScore !== null || awaySetScore !== null) {
      const home = homeSetScore !== null ? homeSetScore : 0;
      const away = awaySetScore !== null ? awaySetScore : 0;
      
      sets.push({
        period: i,
        homeScore: homeSetScore,
        awayScore: awaySetScore,
        total: home + away,
        isOver185: (home + away) >= 19
      });
    }
  }
  
  return sets;
}

function processEventData(data) {
  const event = data.event;
  if (!event) return null;
  
  const homeScore = event.homeScore || {};
  const awayScore = event.awayScore || {};
  
  const sets = calculateSetStats(homeScore, awayScore, event.defaultPeriodCount);
  
  const homeTotal = sets.reduce((sum, set) => sum + (set.homeScore || 0), 0);
  const awayTotal = sets.reduce((sum, set) => sum + (set.awayScore || 0), 0);
  
  const getSetScore = (scoreObj, period) => safeNum(scoreObj[`period${period}`]);
  
  return {
    eventId: event.id,
    homeTeam: event.homeTeam.name,
    awayTeam: event.awayTeam.name,
    tournament: event.tournament.name,
    homeGames: safeNum(homeScore.current) || 0,
    awayGames: safeNum(awayScore.current) || 0,
    totalGames: (safeNum(homeScore.current) || 0) + (safeNum(awayScore.current) || 0),
    homePoints: homeTotal,
    awayPoints: awayTotal,
    totalPoints: homeTotal + awayTotal,
    setsPlayed: sets.length,
    gamesOver185: sets.filter(s => s.isOver185).length,
    gamesUnder185: sets.filter(s => !s.isOver185).length,
    status: event.status.description,
    startTime: event.startTimestamp ? new Date(event.startTimestamp * 1000).toISOString() : '',
    homeSet1: getSetScore(homeScore, 1),
    homeSet2: getSetScore(homeScore, 2),
    homeSet3: getSetScore(homeScore, 3),
    homeSet4: getSetScore(homeScore, 4),
    homeSet5: getSetScore(homeScore, 5),
    homeSet6: getSetScore(homeScore, 6),
    homeSet7: getSetScore(homeScore, 7),
    awaySet1: getSetScore(awayScore, 1),
    awaySet2: getSetScore(awayScore, 2),
    awaySet3: getSetScore(awayScore, 3),
    awaySet4: getSetScore(awayScore, 4),
    awaySet5: getSetScore(awayScore, 5),
    awaySet6: getSetScore(awayScore, 6),
    awaySet7: getSetScore(awayScore, 7),
  };
}

async function exportWithPlayerHistories(events, tab) {
  showStatus('Fetching all tournament matches...', 'info');
  
  // Get user's history match preference
  const historyMatchesInput = document.getElementById('historyMatches');
  const maxMatches = parseInt(historyMatchesInput.value) || 200;
  const eventsPerPage = 20; // SofaScore API returns exactly 20 events per page
  const maxPages = Math.ceil(maxMatches / eventsPerPage);
  
  // Track player IDs and names
  const playerIds = new Set();
  const playerNames = {};
  
  // Collect all unique players from events first
  for (const event of events) {
    if (event.homeTeam?.id) {
      playerIds.add(event.homeTeam.id);
      playerNames[event.homeTeam.id] = event.homeTeam.name;
    }
    if (event.awayTeam?.id) {
      playerIds.add(event.awayTeam.id);
      playerNames[event.awayTeam.id] = event.awayTeam.name;
    }
  }
  
  // Function to fetch player history
  const fetchPlayerHistory = async (playerId, playerName) => {
    try {
      let allPlayerEvents = [];
      let page = 0;
      let hasMorePages = true;
      
      while (hasMorePages && page < maxPages && allPlayerEvents.length < maxMatches) {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (pid, pageNum) => {
            const response = await fetch(`https://www.sofascore.com/api/v1/team/${pid}/events/last/${pageNum}`, {
              headers: { 
                'x-requested-with': '3212e2'
              }
            });
            return await response.json();
          },
          args: [playerId, page]
        });
        
        if (result && result[0] && result[0].result) {
          const data = result[0].result;
          if (data.events && data.events.length > 0) {
            allPlayerEvents = allPlayerEvents.concat(data.events);
            hasMorePages = data.hasNextPage || false;
            page++;
            
            if (hasMorePages) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } else {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
      }
      
      // Trim to exact match count if we fetched more
      if (allPlayerEvents.length > maxMatches) {
        allPlayerEvents = allPlayerEvents.slice(0, maxMatches);
      }
      
      return { playerId, playerName, events: allPlayerEvents };
    } catch (error) {
      console.error(`Error fetching history for player ${playerId}:`, error);
      return { playerId, playerName, events: [] };
    }
  };
  
  // Start fetching ALL player histories in parallel immediately
  showStatus(`Found ${playerIds.size} unique players. Fetching match history...`, 'info');
  const playerHistoryPromises = Array.from(playerIds).map(playerId => 
    fetchPlayerHistory(playerId, playerNames[playerId])
  );
  
  // Fetch all event details in parallel too
  showStatus(`Fetching details for ${events.length} matches...`, 'info');
  const eventDetailPromises = events.map(async (event, i) => {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (eventId) => {
        const response = await fetch(`https://www.sofascore.com/api/v1/event/${eventId}`, {
          headers: { 
            'x-requested-with': '3212e2'
          }
        });
        return await response.json();
      },
      args: [event.id]
    });
    
    if (result && result[0] && result[0].result) {
      const processed = processEventData(result[0].result);
      if (processed) {
        processed.homeTeamId = result[0].result.event.homeTeam.id;
        processed.awayTeamId = result[0].result.event.awayTeam.id;
        return processed;
      }
    }
    return null;
  });
  
  // Wait for all event details to complete
  const allData = (await Promise.all(eventDetailPromises)).filter(d => d !== null);
  
  // Sort by date descending (most recent first)
  allData.sort((a, b) => {
    const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
    const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
    return dateB - dateA;
  });
  
  showStatus(`Waiting for all ${playerIds.size} player histories to complete...`, 'info');
  
  // Wait for all player history fetches to complete
  const playerHistories = await Promise.all(playerHistoryPromises);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Add tournament matches sheet
  const tournamentSheet = XLSX.utils.json_to_sheet(allData.map(row => ({
    'Event ID': row.eventId,
    'Home Team': row.homeTeam,
    'Away Team': row.awayTeam,
    'Tournament': row.tournament,
    'Home Games': row.homeGames,
    'Away Games': row.awayGames,
    'Total Games': row.totalGames,
    'Games Over 18.5': row.gamesOver185,
    'Games Under 18.5': row.gamesUnder185,
    'Home Points': row.homePoints,
    'Away Points': row.awayPoints,
    'Total Points': row.totalPoints,
    'Sets Played': row.setsPlayed,
    'Status': row.status,
    'Start Time': formatDate(row.startTime),
    'Home Set 1': row.homeSet1 !== null ? row.homeSet1 : '',
    'Home Set 2': row.homeSet2 !== null ? row.homeSet2 : '',
    'Home Set 3': row.homeSet3 !== null ? row.homeSet3 : '',
    'Home Set 4': row.homeSet4 !== null ? row.homeSet4 : '',
    'Home Set 5': row.homeSet5 !== null ? row.homeSet5 : '',
    'Home Set 6': row.homeSet6 !== null ? row.homeSet6 : '',
    'Home Set 7': row.homeSet7 !== null ? row.homeSet7 : '',
    'Away Set 1': row.awaySet1 !== null ? row.awaySet1 : '',
    'Away Set 2': row.awaySet2 !== null ? row.awaySet2 : '',
    'Away Set 3': row.awaySet3 !== null ? row.awaySet3 : '',
    'Away Set 4': row.awaySet4 !== null ? row.awaySet4 : '',
    'Away Set 5': row.awaySet5 !== null ? row.awaySet5 : '',
    'Away Set 6': row.awaySet6 !== null ? row.awaySet6 : '',
    'Away Set 7': row.awaySet7 !== null ? row.awaySet7 : ''
  })));
  
  XLSX.utils.book_append_sheet(wb, tournamentSheet, 'Tournament Matches');
  
  // Process player histories (already fetched in parallel)
  // playerHistories is already unique by player ID from how we built playerHistoryPromises Map
  let playerCount = 0;
  const usedSheetNames = new Set(['Tournament Matches']);
  
  for (const playerHistoryData of playerHistories) {
    playerCount++;
    const { playerId, playerName, events: allPlayerEvents } = playerHistoryData;
    
    showStatus(`Processing history for ${playerName} (${playerCount}/${playerHistories.length})...`, 'info');
    
    if (allPlayerEvents.length > 0) {
      const playerEvents = allPlayerEvents;
      
      // Process each event
      const playerHistory = [];
      for (const event of playerEvents) {
        const homeScore = event.homeScore || {};
        const awayScore = event.awayScore || {};
        
        const sets = calculateSetStats(homeScore, awayScore, event.defaultPeriodCount);
        
        const homeTotal = sets.reduce((sum, set) => sum + (set.homeScore || 0), 0);
        const awayTotal = sets.reduce((sum, set) => sum + (set.awayScore || 0), 0);
        
        const getSetScore = (scoreObj, period) => {
          const score = safeNum(scoreObj[`period${period}`]);
          return score !== null ? score : '';
        };
        
        playerHistory.push({
          'Event ID': event.id,
          'Home Team': event.homeTeam.name,
          'Away Team': event.awayTeam.name,
          'Tournament': event.tournament.name,
          'Home Games': safeNum(homeScore.current) || 0,
          'Away Games': safeNum(awayScore.current) || 0,
          'Total Games': (safeNum(homeScore.current) || 0) + (safeNum(awayScore.current) || 0),
          'Games Over 18.5': sets.filter(s => s.isOver185).length,
          'Games Under 18.5': sets.filter(s => !s.isOver185).length,
          'Home Points': homeTotal,
          'Away Points': awayTotal,
          'Total Points': homeTotal + awayTotal,
          'Status': event.status.description,
          'Start Time': formatDate(event.startTimestamp ? new Date(event.startTimestamp * 1000).toISOString() : ''),
          'Home Set 1': getSetScore(homeScore, 1),
          'Home Set 2': getSetScore(homeScore, 2),
          'Home Set 3': getSetScore(homeScore, 3),
          'Home Set 4': getSetScore(homeScore, 4),
          'Home Set 5': getSetScore(homeScore, 5),
          'Home Set 6': getSetScore(homeScore, 6),
          'Home Set 7': getSetScore(homeScore, 7),
          'Away Set 1': getSetScore(awayScore, 1),
          'Away Set 2': getSetScore(awayScore, 2),
          'Away Set 3': getSetScore(awayScore, 3),
          'Away Set 4': getSetScore(awayScore, 4),
          'Away Set 5': getSetScore(awayScore, 5),
          'Away Set 6': getSetScore(awayScore, 6),
          'Away Set 7': getSetScore(awayScore, 7)
        });
      }
        
        // Sort player history by date descending
        playerHistory.sort((a, b) => {
          const dateA = a['Start Time'] ? new Date(a['Start Time']).getTime() : 0;
          const dateB = b['Start Time'] ? new Date(b['Start Time']).getTime() : 0;
          return dateB - dateA;
        });
        
        // Add player sheet (sheet names limited to 31 chars)
        // Handle duplicate names by adding player ID suffix
        let baseSheetName = playerName.substring(0, 31);
        let sheetName = baseSheetName;
        
        // If sheet name already exists, add last 4 digits of player ID
        if (usedSheetNames.has(sheetName)) {
          const idSuffix = ` (${String(playerId).slice(-4)})`;
          const maxBaseLength = 31 - idSuffix.length;
          sheetName = `${playerName.substring(0, maxBaseLength)}${idSuffix}`;
        }
        usedSheetNames.add(sheetName);
        
        const playerSheet = XLSX.utils.json_to_sheet(playerHistory);
        XLSX.utils.book_append_sheet(wb, playerSheet, sheetName);
        
        showStatus(`Added ${allPlayerEvents.length} matches for ${playerName}`, 'info');
      }
  }
  
  // Download the workbook
  showStatus('Generating Excel file...', 'info');
  XLSX.writeFile(wb, `sofascore_data_${Date.now()}.xlsx`);
  
  showStatus(`Successfully exported ${allData.length} matches with complete histories for ${playerIds.size} players!`, 'success');
}
