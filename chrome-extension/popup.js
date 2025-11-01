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
    
    const isTournamentPage = tab.url.includes('/tournament/');
    
    if (!isTournamentPage) {
      showStatus('Please navigate to a tournament page', 'error');
      return;
    }
    
    // Automatically fetch and export with player histories
    await fetchAndExportWithHistories(tab);
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Fetch TT Elite Series';
  }
});

async function fetchAndExportWithHistories(tab) {
  showStatus('Fetching tournament events...', 'info');
  
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const urlMatch = window.location.href.match(/\/tournament\/.*\/(\d+)/);
      if (!urlMatch) return { error: 'Could not find tournament ID in URL' };
      
      const tournamentId = urlMatch[1];
      
      try {
        const [pastResponse, upcomingResponse] = await Promise.all([
          fetch(`https://www.sofascore.com/api/v1/unique-tournament/${tournamentId}/events/last/0`, {
            headers: { 
              'accept': '*/*', 
              'cache-control': 'max-age=0',
              'x-requested-with': '4ecab9'
            }
          }),
          fetch(`https://www.sofascore.com/api/v1/unique-tournament/${tournamentId}/events/next/0`, {
            headers: { 
              'accept': '*/*', 
              'cache-control': 'max-age=0',
              'x-requested-with': 'e518f8'
            }
          })
        ]);
        
        if (!pastResponse.ok && !upcomingResponse.ok) {
          throw new Error(`HTTP ${pastResponse.status} / ${upcomingResponse.status}`);
        }
        
        const pastData = pastResponse.ok ? await pastResponse.json() : { events: [] };
        const upcomingData = upcomingResponse.ok ? await upcomingResponse.json() : { events: [] };
        
        return {
          pastEvents: pastData.events || [],
          upcomingEvents: upcomingData.events || []
        };
      } catch (error) {
        return { error: error.message };
      }
    }
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
  
  showStatus(`Found ${data.pastEvents?.length || 0} past and ${data.upcomingEvents?.length || 0} upcoming events. Starting export...`, 'info');
  
  // Combine all events
  const allEvents = [...(data.pastEvents || []), ...(data.upcomingEvents || [])];
  
  // Immediately export with player histories
  await exportWithPlayerHistories(allEvents, tab);
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = type;
  status.style.display = 'block';
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
  
  // Track player IDs and start fetching their histories in parallel
  const playerIds = new Set();
  const playerNames = {};
  const playerHistoryPromises = new Map();
  
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
              headers: { 'x-requested-with': '3212e2' }
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
              await new Promise(resolve => setTimeout(resolve, 100));
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
  
  // Fetch all event details
  const allData = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const matchName = `${event.homeTeam?.name || 'Unknown'} vs ${event.awayTeam?.name || 'Unknown'}`;
    showStatus(`Fetching... ${matchName} (${i + 1}/${events.length})`, 'info');
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (eventId) => {
        const response = await fetch(`https://www.sofascore.com/api/v1/event/${eventId}`, {
          headers: { 'x-requested-with': '3212e2' }
        });
        return await response.json();
      },
      args: [events[i].id]
    });
    
    if (result && result[0] && result[0].result) {
      const processed = processEventData(result[0].result);
      if (processed) {
        // Add player IDs
        processed.homeTeamId = result[0].result.event.homeTeam.id;
        processed.awayTeamId = result[0].result.event.awayTeam.id;
        allData.push(processed);
        
        // Start fetching player histories in parallel if we haven't already
        if (processed.homeTeamId && !playerIds.has(processed.homeTeamId)) {
          playerIds.add(processed.homeTeamId);
          playerNames[processed.homeTeamId] = processed.homeTeam;
          playerHistoryPromises.set(
            processed.homeTeamId, 
            fetchPlayerHistory(processed.homeTeamId, processed.homeTeam)
          );
        }
        
        if (processed.awayTeamId && !playerIds.has(processed.awayTeamId)) {
          playerIds.add(processed.awayTeamId);
          playerNames[processed.awayTeamId] = processed.awayTeam;
          playerHistoryPromises.set(
            processed.awayTeamId,
            fetchPlayerHistory(processed.awayTeamId, processed.awayTeam)
          );
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Sort by date descending (most recent first)
  allData.sort((a, b) => {
    const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
    const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
    return dateB - dateA;
  });
  
  showStatus(`Found ${playerIds.size} unique players. Waiting for player histories...`, 'info');
  
  // Wait for all player history fetches to complete
  const playerHistories = await Promise.all(Array.from(playerHistoryPromises.values()));
  
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
    'Start Time': row.startTime,
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
  let playerCount = 0;
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
          'Start Time': event.startTimestamp ? new Date(event.startTimestamp * 1000).toISOString() : '',
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
        const sheetName = playerName.substring(0, 31);
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
