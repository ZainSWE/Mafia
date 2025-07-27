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

// Serve index.html and static files manually
const server = createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;  // This strips the query string

    const filePath = pathname === "/" ? "/index.html" : pathname;
    const fullPath = path.join(__dirname, '../public', filePath);

    console.log('Serving file:', fullPath);

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
    cors: { origin: "*" }
});

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', (roomCode, username, isHost, callback) => {
        if(isHost){
            const roomCode = generateRoomCode();
            rooms[roomCode] = {
                host: socket.id,
                players: {},
                gameStarted: false
            };
            rooms[roomCode].players[socket.id] = { name: username };
            socket.join(roomCode);
            console.log(`${username} hosted room ${roomCode}`);
            callback({ success: true, roomCode });
        }   
        else{
            const room = rooms[roomCode];
            if (!room) return callback({ success: false, message: "Room not found." });
            if (room.gameStarted) return callback({ success: false, message: "Game already started." });

            room.players[socket.id] = { name: username };
            socket.join(roomCode);
            console.log(`${username} joined room ${roomCode}`);
            io.to(roomCode).emit('playerListUpdate', Object.values(room.players).map(p => p.name));
            callback({ success: true, roomCode });
        }
    });

    socket.on('hostGame', (username, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            host: socket.id,
            players: {},
            gameStarted: false
        };
        rooms[roomCode].players[socket.id] = { name: username };
        socket.join(roomCode);
        console.log(`${username} hosted room ${roomCode}`);
        callback({ success: true, roomCode });
    });

    socket.on('joinGame', (roomCode, username, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, message: "Room not found." });
        if (room.gameStarted) return callback({ success: false, message: "Game already started." });

        room.players[socket.id] = { name: username };
        socket.join(roomCode);
        console.log(`${username} joined room ${roomCode}`);
        io.to(roomCode).emit('playerListUpdate', Object.values(room.players).map(p => p.name));
        callback({ success: true });
    });
});

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});