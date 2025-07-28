const roomCode = localStorage.getItem('roomCode') || '';
const isHost = localStorage.getItem('isHost');

let playerCount = 0;


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

window.startGame = function() {
    const discussionTime = parseInt(document.getElementById('discussionTime').value, 10);
    const numMurderers = parseInt(document.getElementById('numMurderers').value, 10);
    const numDetectives = parseInt(document.getElementById('numDetectives').value, 10);
    const numAngels = parseInt(document.getElementById('numAngels').value, 10);

    if( isNaN(discussionTime) || isNaN(numMurderers) || isNaN(numDetectives) || isNaN(numAngels)) {
        alert("Please enter valid numbers for discussion time and player counts.");
        return;
    }

    if(numMurderers + numDetectives + numAngels > playerCount) {
        alert("The total number of special roles cannot exceed the number of players in the room.");
        return;
    }

    socket.emit('startGame', {roomCode, discussionTime, numMurderers, numDetectives, numAngels});
}

socket.on('hostLeft', () => {
    alert('The host has left the room. You will be redirected to the main menu.');
    window.location.href = 'play.html';
});

socket.on('playerListUpdate', (players) => {
    console.log('Updating player list:', players);

    const playerList = document.getElementById('playerList');

    playerCount = players.length;

    playerList.innerHTML = ''; // Clear existing list

    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);
    });
});

socket.on('gameStarted', (data) => {
    const { roomCode, role } = data;
    console.log(`Game started in room ${roomCode} with role: ${role}`);
    localStorage.setItem('role', role);

    document.getElementById('lobby').style.display = 'none';
    document.getElementById('cardView').style.display = 'block';
    switch (role) {
        case 'm':
            document.getElementById('role').innerText = 'You are a Murderer!';
            break;

        case 'd':
            document.getElementById('role').innerText = 'You are a Detective!';
            break;

        case 'a':
            document.getElementById('role').innerText = 'You are an Angel!';
            break;

        case 'c':
            document.getElementById('role').innerText = 'You are a Civillian!';
            break;
    }
});


window.addEventListener("beforeunload", function (e) {
    // Standard message is ignored by most modern browsers,
    // but returning a string triggers a confirmation dialog.
    e.preventDefault(); // Some browsers require this for the alert to work
    e.returnValue = ''; // Required for Chrome and some others
  });