function animateHand() {
  const container = document.getElementById("animateHandImage");
  container.innerHTML = '<img src="assets/demoHand.png" alt="hand" />';

  const img = container.querySelector("img");
  const audio = new Audio('audio/animateHandSFX01.mp3');
  audio.play();

  setTimeout(() => {
    img.classList.add("animate");
  }, 20);
}



const socket = io()

socket.on('connect', () => {
    console.log(socket.id)
})

function hostGame(){
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = crypto.randomUUID(); // or make your own random ID
        localStorage.setItem('playerId', playerId);
    }

    const username = document.getElementById("playerNameHost").value;
    localStorage.setItem('username', username);
    const isHost = true;
    const roomCode = null;

    socket.emit('join-room', { roomCode, playerId, username, isHost }, (response) => {
        if (response.success) {
            console.log(`Hosted room: ${response.roomCode}`);
            localStorage.setItem('isHost', isHost);
            localStorage.setItem('roomCode', response.roomCode);
            // You can redirect to a lobby screen or update the UI here
            document.getElementById('joinHost').style.display = 'none';
            document.getElementById('lobby').style.display = 'block';

            loadClientScript(); // Load client.js after joining the room
        } else {
            alert(response.message); // Show error message from server
        }
    });
}

function joinGame() {
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = crypto.randomUUID(); // or make your own random ID
        localStorage.setItem('playerId', playerId);
    }

    const roomCode = document.getElementById("roomCode").value;
    const username = document.getElementById("playerNameJoin").value;
    localStorage.setItem('username', username);

    const isHost = false;

    if (!roomCode) {
        alert("Please enter a room code.");
        return;
    }
    else{
      console.log(`Joining room: ${roomCode}`);
    }

    socket.emit('join-room', { roomCode: document.getElementById("roomCode").value.trim().toUpperCase(), playerId, username, isHost }, (response) => {
        if (response.success) {
            console.log(`Joined room: ${response.roomCode}`);
            localStorage.setItem('isHost', isHost);
            localStorage.setItem('roomCode', response.roomCode);
            // You can redirect to a lobby screen or update the UI here
            document.getElementById('joinHost').style.display = 'none';
            document.getElementById('lobby').style.display = 'block';

            loadClientScript(); // Load client.js after joining the room
        } else {
            alert(response.message); // Show error message from server
        }
    });
}


function loadClientScript() {
    const script = document.createElement('script');
    script.src = 'client.js';
    script.type = 'module'; // optional if using ES6 imports in client.js
    document.body.appendChild(script);
}


