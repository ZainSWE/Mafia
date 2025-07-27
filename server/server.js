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
});

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});