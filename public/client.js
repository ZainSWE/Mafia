const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const isHost = urlParams.get('isHost');

if (!roomCode) {
    alert('No room code found in URL!');
    window.location.href = 'index.html';
}

document.getElementById('roomInfo').innerText = `Room: ${roomCode}`;


const socket = io(); 
console.log(`Connecting to room: ${roomCode}`);


if (isHost === 'true') {
    document.getElementById('hostOptions').style.display = 'block';
    console.log('You are the host of this room.');
}
else{
    document.getElementById('hostOptions').style.display = 'none';
    console.log('You are a player in this room.');
}


// socket.on('joined-room', (data) => {
//     console.log('Joined:', data.room);
//     isHost = data.isHost;

//     console.log(`Is Host: ${isHost}`);

//     // Show host-only options if you're the host
//     if (isHost) {
//         const hostOptions = document.getElementById('hostOptions');
//         if (hostOptions) {
//         hostOptions.style.display = 'block';
//         }
//     }   
// });

socket.on('room-error', (message) => {
    alert(message);
    window.location.href = 'index.html';
});