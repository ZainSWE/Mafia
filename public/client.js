const roomCode = localStorage.getItem('roomCode') || '';
const isHost = localStorage.getItem('isHost');

let playerCount = 0;
let isReady = false;
let nightNumber = 1;


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

    if(playerCount < 3) {
        alert("You need at least 3 players to start the game.");
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

socket.on('startFirstNight', () => {
    console.log(`Night number ${nightNumber} started`);

    document.getElementById("cardView").style.display = "none";
    document.getElementById("night").style.display = "block";
})

socket.on('yourTurn', ( role ) => {
    console.log("Its your turn with role:", role);
    showActionUI(role);
});

socket.on('waitForTurn', ( role ) => {
    showActionUI('c');

    switch(role){
        case 'm':
            document.getElementById("currentTurn").innerText = 'It is the murderers turn';
            break;
        case 'd':
            document.getElementById("currentTurn").innerText = 'It is the detectives turn';
            break;
        case 'a':
            document.getElementById("currentTurn").innerText = 'It is the angels turn';
            break;
    }
});

let selectedPlayerId = null;

socket.on("nightPhaseInfo", ({ role, alivePlayers, sameRolePlayers }) => {
    console.log("Alive players:", alivePlayers);
    console.log("Same role players:", sameRolePlayers);
    console.log("My playerId:", playerId);

    document.getElementById("roleInfo").innerText =
        `You are working with: ` +
        sameRolePlayers.map(p => p.name).join(", ");

    const playerListDiv = document.getElementById("playerList2");
    playerListDiv.innerHTML = ""; // clear previous entries
    console.log("playerListDiv:", playerListDiv);

    alivePlayers.forEach(player => {
        // Skip showing self
        if (player.id === playerId) return;

        // Skip showing players with the same role 
        const isSameRole = sameRolePlayers.some(p => p.id === player.id);
        if (isSameRole) return;
        
        const btn = document.createElement("button");
        btn.innerText = player.name;
        btn.onclick = () => {
            try {
                selectedPlayerId = player.id;
                highlightSelection(player.id);
                console.log(`Selected player: ${player.name} (ID: ${player.id})`);
            } catch (err) {
                console.error("Error during button click assignment:", err);
            }
        };
        console.log(`Adding player button for: ${player.name} (ID: ${player.id})`);
        playerListDiv.appendChild(btn);
    });
});

document.getElementById("submitAction").onclick = () => {
    if (!selectedPlayerId) {
        alert("Choose a player first!");
        return;
    }

    socket.emit("submitAction", { roomCode, target: selectedPlayerId });
};

function showActionUI(role){
    console.log("Action shown for:", role)
    switch(role){
        case 'm':
            document.getElementById("roleAction").innerText = 'You are a murderer! Choose someone to kill!'
            document.getElementById("currentTurn").style.display = "none";
            document.getElementById("roleDisplay").style.display = "block";
            break;
        case 'd':
            document.getElementById("roleAction").innerText = 'You are a detective! Choose someone to investigate!'
            document.getElementById("currentTurn").style.display = "none";
            document.getElementById("roleDisplay").style.display = "block";
            break;
        case 'a':
            document.getElementById("roleAction").innerText = 'You are an angel! Choose someone to protect!'
            document.getElementById("currentTurn").style.display = "none";
            document.getElementById("roleDisplay").style.display = "block";
            break;
        case 'c':
            document.getElementById("roleDisplay").style.display = "none";
            document.getElementById("currentTurn").style.display = "block";
            break;
    }
}

function highlightSelection(selectedId) {
  const buttons = document.querySelectorAll("#playerList button");

  buttons.forEach(btn => {
    // Remove previous highlights
    btn.classList.remove("selected");

    // Highlight only the selected one
    if (btn.dataset.playerId === selectedId) {
      btn.classList.add("selected");
    }
  });
}

window.addEventListener("beforeunload", function (e) {
    // Standard message is ignored by most modern browsers,
    // but returning a string triggers a confirmation dialog.
    e.preventDefault(); // Some browsers require this for the alert to work
    e.returnValue = ''; // Required for Chrome and some others
});


const readyButton = document.getElementById("readyButton");
const statusText = document.getElementById("statusText");

readyButton.addEventListener("click", () => {
    isReady = !isReady;

    // Toggle visual class
    readyButton.classList.toggle("ready", isReady);

    // Update button text
    readyButton.textContent = isReady ? "Ready ✅" : "Ready Up";

    // Send ready status to server
    socket.emit("playerReady", { roomCode, playerId, ready: isReady, phase: "night" });
});