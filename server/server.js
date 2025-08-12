import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

// Needed to mimic __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global room state
const rooms = {};
const socketToPlayerId = {}; // { socket.id: { playerId, roomCode } }



// Serve index.html and static files manually
const server = createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;  // This strips the query string

    const filePath = pathname === "/" ? "/index.html" : pathname;
    const fullPath = path.join(__dirname, '../public', filePath);

    try {
        const data = await readFile(fullPath);
        const ext = path.extname(fullPath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json'
        }[ext] || 'text/plain';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end("404 Not Found");
    }
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
//{ roomCode, playerId, username, isHost }
    socket.on('join-room', (data, callback) => {
        let { playerId, username, isHost } = data;
        let roomCode = data.roomCode; // allow reassignment later

        console.log("Raw data received:", data);

        if (isHost) {
            do {
                roomCode = generateRoomCode();
            } while (rooms[roomCode]);

            rooms[roomCode] = {
                host: playerId,
                players: {},
                gameStarted: false
            };
            rooms[roomCode].players[playerId] = { name: username, socketId: socket.id };

            socketToPlayerId[socket.id] = { playerId, roomCode };

            socket.join(roomCode);
            console.log(`${username} hosted room ${roomCode}, Rooms object now:`, rooms);

            io.to(roomCode).emit('playerListUpdate', Object.values(rooms[roomCode].players).map(p => p.name));

            callback({ success: true, roomCode });
        } else {
            console.log(`Joining room: ${roomCode} with playerId: ${playerId} and username: ${username}`);

            if (!rooms[roomCode]) return callback({ success: false, message: "Room not found." });
            if (rooms[roomCode].gameStarted) return callback({ success: false, message: "Game already started." });

            rooms[roomCode].players[playerId] = { name: username, socketId: socket.id };

            socketToPlayerId[socket.id] = { playerId, roomCode };

            socket.join(roomCode);
            console.log(`${username} joined room ${roomCode}`);
            
            console.log(`Rooms object now:`, rooms);

            io.to(roomCode).emit('playerListUpdate', Object.values(rooms[roomCode].players).map(p => p.name));

            callback({ success: true, roomCode });
        }
    });

    socket.on('leaveRoom', async (roomCode, playerId, isHost) => {
        console.log(`Socket ${socket.id} leaving room ${roomCode} with playerId ${playerId} and isHost ${isHost}`);

        if (!rooms[roomCode]) return;

        if(isHost === 'true') {
            // Notify all players in the room that the game was closed
            io.to(roomCode).emit('hostLeft');

            setTimeout(async () => {
                const sockets = await io.in(roomCode).fetchSockets();
                
                for (const s of sockets) {
                    s.leave(roomCode);
                    console.log(`Socket ${s.id} left room ${roomCode}`);
                }

                delete rooms[roomCode]; // Remove room object
                console.log(`Room ${roomCode} deleted as host (${playerId})left.`);
                console.log(`Rooms object now:`, rooms);
            }, 100); // 100 ms delay

            return;
        }

        socket.leave(roomCode)
        console.log(`Socket disconnected: ${socket.id} from room ${roomCode}`);
        delete rooms[roomCode].players[playerId]; // Remove player from room
        console.log(`Rooms object now:`, rooms);
        if(rooms[roomCode].players){
            io.to(roomCode).emit('playerListUpdate', Object.values(rooms[roomCode].players).map(p => p.name));
        }
    });

    socket.on('joined', (roomCode) => {
        io.to(roomCode).emit('playerListUpdate', Object.values(rooms[roomCode].players).map(p => p.name));
    });

    socket.on('startGame', (data) => {
        const { roomCode, discussionTime, numMurderers, numDetectives, numAngels } = data;

        if (!rooms[roomCode]) return;

        rooms[roomCode].gameStarted = true;
        rooms[roomCode].discussionTime = discussionTime;
        rooms[roomCode].numMurderers = numMurderers;
        rooms[roomCode].numDetectives = numDetectives; 
        rooms[roomCode].numAngels = numAngels;
        rooms[roomCode].actions = []; // Reset actions for the new game
        rooms[roomCode].votes = {}; // Reset votes for the new game
        rooms[roomCode].night = 0; // Reset night count

        console.log(`Game started in room ${roomCode} with discussionTime: ${discussionTime}, numMurderers: ${numMurderers}, numDetectives: ${numDetectives}, numAngels: ${numAngels}`);

        for (let playerId in rooms[roomCode].players) {
            const player = rooms[roomCode].players[playerId];
            player.isAlive = true; // Reset player status
            player.hasSubmittedAction = false; // Reset action submission status
            player.role = null; // Reset role
            player.ready = false; // Reset ready status
        }

        let playerCount = Object.keys(rooms[roomCode].players).length;

        const playersObj = rooms[roomCode].players;

        const playerIds = Object.keys(playersObj); // Get all player IDs

        const shuffledIds = shuffle([...playerIds]);

        // Helper to assign a role to a number of players starting from a given index
        function assignRole(role, count, startIndex) {
            for (let i = 0; i < count; i++) {
            const playerId = shuffledIds[startIndex + i];
            playersObj[playerId].role = role;
            }
        }

        // Assign special roles
        assignRole("m", numMurderers, 0);
        assignRole("d", numDetectives, numMurderers);
        assignRole("a", numAngels, numMurderers + numDetectives);

        // Assign "villager" to the rest
        for (let i = numMurderers + numDetectives + numAngels; i < playerCount; i++) {
            const playerId = shuffledIds[i];
            playersObj[playerId].role = "c";
        }

        console.log("Updated current room:", rooms[roomCode].players);
 
        for(let i = 0; i < playerCount; i++) {
            const playerId = shuffledIds[i];
            const playerSocketId = playersObj[playerId].socketId;
            io.to(playerSocketId).emit('gameStarted', { roomCode, role: playersObj[playerId].role });
        }
    });

    socket.on('playerReady', ({ roomCode, playerId, ready, phase }) => {
        console.log(`Player ${playerId} is ${ready ? 'ready' : 'not ready'} in room ${roomCode}`);
        if (!rooms[roomCode]) return;

        // Set ready status for the player
        const room = rooms[roomCode];
        room.players[playerId].ready = ready;

        let alivePlayers = Object.values(room.players).filter(p => p.isAlive);

        const allReady = alivePlayers.every(p => p.ready);

        if (allReady) {
            // Broadcast phase change to all players in the room
            console.log(`All players are ready in room ${roomCode}. Starting ${phase} phase.`);
            startNightPhase(roomCode); // Start the night phase
            room.night++;
            room.actions = []; // Reset actions for the new night phase
            room.votes = {}; // Reset votes for the new day phase
            sendTurnToRole(roomCode, "m");

            for (let playerId in room.players) {
                const player = room.players[playerId];
                player.hasSubmittedAction = false; // Reset action submission status for the new night phase
                player.ready = false; // Reset ready status for the new night phase
            }
        }
    });

    socket.on("submitAction", ({ roomCode, target }) => {
        const player = rooms[roomCode].players[socketToPlayerId[socket.id].playerId];
        const room = rooms[roomCode];

        // Store their action
        room.actions.push({
            from: player.name,
            role: player.role,
            target
        });

        player.hasSubmittedAction = true;

        // Check if all players of this role have submitted
        if (allRolePlayersSubmitted(room, player.role)) {
            // Proceed to next role or resolve if last
            if (player.role === "m" && room.numDetectives > 0) sendTurnToRole(roomCode, "d");
            else if ((player.role === "d" || player.role ==="m") && room.numAngels > 0) sendTurnToRole(roomCode, "a");
            else resolveNightPhase(roomCode);
        }
    });

    socket.on('investigatePlayer', ({ roomCode, target }, callback) => {
        const player = rooms[roomCode].players[target];

        // Here you can send the result back to the detective
        callback({ success: true, role: player.role, name: player.name });
    });

    socket.on('submitVote', ({ roomCode, target }) => {
        const playerId = socketToPlayerId[socket.id].playerId;
        const room = rooms[roomCode];

        if (!room.votes) {
            room.votes = {};
        }

        room.votes[playerId] = target; // Store the vote

        console.log(`Player ${playerId} voted for ${target} in room ${roomCode}`);

        // Get list of alive players
        let alivePlayers = Object.entries(room.players).filter(([id, player]) => player.isAlive);

        if (Object.keys(room.votes).length === alivePlayers.length) {
            console.log(`All players have voted in room ${roomCode}. Resolving votes...`);

            // Count votes for alive players
            let voteCounts = {};
            alivePlayers.forEach(([id, player]) => {
                voteCounts[id] = 0; // Initialize with 0 votes
            });

            for (let voterId in room.votes) {
                let targetId = room.votes[voterId];
                if (voteCounts.hasOwnProperty(targetId)) {
                    voteCounts[targetId]++;
                }
            }

            // Format result as array of { name, voteCount }
            let results = alivePlayers.map(([id, player]) => ({
                name: player.name,
                voteCount: voteCounts[id]
            }));

            // Sort results by vote count in descending order
            results.sort((a, b) => b.voteCount - a.voteCount);

            console.log(`Vote results for room ${roomCode}:`, results);

            let votedOut;
            let votedOutRole;

            if(!(results[0].voteCount == results[1].voteCount)) {
                // If there's a clear winner, kill that player
                votedOut = results[0].name;
                votedOutRole = rooms[roomCode].players[Object.keys(room.players).find(id => room.players[id].name === votedOut)].role;
                room.players[Object.keys(room.players).find(id => room.players[id].name === votedOut)].isAlive = false;
                console.log(`Player ${votedOut} has been voted out.`);
            } else {
                // If there's a tie, no one is voted out
                console.log("No one was voted out due to a tie.");
            }

            let aliveMurdererCount = Object.values(room.players).filter(p => p.isAlive && p.role === "m").length;
            let alivePlayerCount = Object.values(room.players).filter(p => p.isAlive).length;

            if(alivePlayerCount <= aliveMurdererCount) {
                console.log(`${roomCode} Murderers win as last villager is voted out. Game Over.`);
                io.to(roomCode).emit('gameOver', { winner: "m", message: `${votedOut} was a ${votedOutRole}! Murderers win as last villager is voted out!` });
                return;
            }
            else if(aliveMurdererCount <= 0){
                console.log(`${roomCode} Villagers win as the last murderer is voted out. Game Over.`);
                io.to(roomCode).emit('gameOver', { winnder: "v", message: `${votedOut} was a ${votedOutRole}! Villagers win as last murderer is voted out!`});
                return;
            }
 
            io.to(roomCode).emit('voteResult', results, votedOut, votedOutRole);
        }
    });
});

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startNightPhase(roomCode) {
    const room = rooms[roomCode];
    console.log(`Starting night phase for room ${roomCode}`);

    for (let playerId in room.players) {
        const player = room.players[playerId];
        console.log(`Current playerId: ${playerId}, Player is alive: ${player.isAlive}`);
        if (!player.isAlive) continue;

        const alivePlayers = Object.entries(room.players)
        .filter(([id, p]) => p.isAlive)
        .map(([id, p]) => ({ id, name: p.name }));

        const sameRolePlayers = Object.entries(room.players)
        .filter(([id, p]) => p.role === player.role && p.isAlive)
        .map(([id, p]) => ({ id, name: p.name }));

        console.log(`Sending night phase info to player ${playerId} with socket ${player.socketId} in room ${roomCode}`);

        io.to(player.socketId).emit("nightPhaseInfo", {
            role: player.role,
            alivePlayers,
            sameRolePlayers
        });
    }
}

function sendTurnToRole(roomCode, role) {
  const room = rooms[roomCode];

  for (let playerId in room.players) {
    const player = room.players[playerId];
    if (player.role === role) {
      io.to(player.socketId).emit("yourTurn",  role );
    } else {
      io.to(player.socketId).emit("waitForTurn",  role );
    }
  }
}

function allRolePlayersSubmitted(room, role) {
  for (const playerId in room.players) {
    const player = room.players[playerId];
    if (player.role === role && !player.hasSubmittedAction) {
      return false; // Found a role player who hasn’t submitted yet
    }
  }
  return true; // All role players have submitted
}

function resolveNightPhase(roomCode) {
    const room = rooms[roomCode];
    console.log(`Resolving night phase for room ${roomCode}`);

    const actions = room.actions;

    room.actions = []; // Reset actions for next night

    const killTargets = new Set();     // All players selected to be killed
    const protectedTargets = new Set(); // All players selected to be protected

    for (const action of actions) {
        if (action.role === "m") {
            killTargets.add(action.target);
            console.log(`Murderer ${action.from} killed ${room.players[action.target].name}`);
        } else if (action.role === "a") {
            protectedTargets.add(action.target);
            console.log(`Angel ${action.from} saved ${room.players[action.target].name}`);
        } else if (action.role === "d") {
            console.log(`Detective ${action.from} checked ${room.players[action.target].name}`);
        }   
    }

    const killedPlayers = [];
    const protectedPlayers = [];

    for (let targetId of killTargets) {
        if (!protectedTargets.has(targetId)) {
            const target = room.players[targetId];
            if (target && target.isAlive) {
                target.isAlive = false;
                killedPlayers.push(target.name);
            }
        }
        else {
            console.log(`Player ${targetId} was protected by an angel.`);
            protectedPlayers.push(targetId);
        }
    }

    console.log(`Killed players: ${killedPlayers.join(', ')}`);
    console.log(`Protected players: ${protectedPlayers.join(', ')}`);

    // Notify all players about the results
    let alivePlayers = Object.entries(room.players)
        .filter(([id, p]) => p.isAlive)
        .map(([id, p]) => ({ id, name: p.name }));
    
    let message = "";

    for(let targetId of killTargets) {
        if (!protectedTargets.has(targetId)) {
            message += `${room.players[targetId].name} was killed!\n`;
        } else {
            message += `${room.players[targetId].name} was killed but an angel saved them!\n`;
        }
    }

    let alivePlayerCount = Object.values(room.players).filter(p => p.isAlive).length;
    let aliveMurdererCount = Object.values(room.players).filter(p => p.isAlive && p.role === "m").length;

    if(alivePlayerCount <= aliveMurdererCount) {
        console.log(`The murderers have killed the last villager. Game over.`);
        io.to(roomCode).emit('gameOver', { winner: "m", message: `The murderers have killed the last villagers! Game over!` });
        return;
    }

    for(let player of Object.values(room.players)){
        if (player.isAlive) {
            io.to(player.socketId).emit("dayPhaseInfo", {
                message: message || "No players were killed last night.",
                discussionTime: room.discussionTime,
                alivePlayers,
                isAlive: player.isAlive
            });
        } else {
            io.to(player.socketId).emit("dayPhaseInfo", {
                message: message || "No players were killed last night.",
                discussionTime: room.discussionTime,
                alivePlayers,
                isAlive: player.isAlive
            });
        }
    }
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});