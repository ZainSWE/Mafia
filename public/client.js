const roomCode = localStorage.getItem('roomCode') || '';
const isHost = localStorage.getItem('isHost');


let playerId = localStorage.getItem('playerId');
if (!playerId) {
    playerId = crypto.randomUUID(); // or make your own random ID
    localStorage.setItem('playerId', playerId);
}

document.getElementById('roomInfo').innerText = `Room: ${roomCode}`;

if(roomCode) {
    //socket already connected in app.js
    console.log(`Connecting to room: ${roomCode}`);


    if (isHost === 'true') {
        document.getElementById('hostOptions').style.display = 'block';
        console.log('You are the host of this room.');
    }
    else{
        document.getElementById('hostOptions').style.display = 'none';
        console.log('You are a player in this room.');
    }
}

socket.emit('joined', roomCode);

socket.on('room-error', (message) => {
    alert(message);
    window.location.href = 'index.html';
});

window.leaveRoom = function() {
    socket.emit('leaveRoom', roomCode, playerId, isHost);
    console.log(`Leaving room: ${roomCode}`);

    localStorage.removeItem('roomCode');
    localStorage.removeItem('playerId');
    localStorage.removeItem('isHost');

    window.location.href = 'play.html';
}

socket.on('hostLeft', () => {
    alert('The host has left the room. You will be redirected to the main menu.');
    window.location.href = 'play.html';
});

socket.on('playerListUpdate', (players) => {
    console.log('Updating player list:', players);

    const playerList = document.getElementById('playerList');

    playerList.innerHTML = ''; // Clear existing list

    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);
    });
});