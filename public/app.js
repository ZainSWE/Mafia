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
    const username = document.getElementById("playerNameHost").value;
    const isHost = true;

    socket.emit('join-room', roomCode, username, isHost, (response) => {
        if (response.success) {
            console.log(`Hosted room: ${response.roomCode}`);
            // You can redirect to a lobby screen or update the UI here
             window.location.href = `game.html?room=${response.roomCode}&isHost=${isHost}`;
        } else {
            alert(response.message); // Show error message from server
        }
    });
}

function joinGame() {
    const code = document.getElementById("roomCode").value;
    const username = document.getElementById("playerNameJoin").value;

    const isHost = false;

    if (!code) {
        alert("Please enter a room code.");
        return;
    }
    else{
      console.log(`Joining room: ${code}`);
    }

    socket.emit('join-room', code, username, isHost, (response) => {
        if (response.success) {
            console.log(`Joined room: ${response.roomCode}`);
            // You can redirect to a lobby screen or update the UI here
             window.location.href = `game.html?room=${response.roomCode}&isHost=${isHost}`;
        } else {
            alert(response.message); // Show error message from server
        }
    });

    // socket.emit("joinGame", code, username, (response) => {
    //     if (response.success) {
    //         console.log(`Joined room: ${code}`);
    //         // You can redirect to a lobby screen or update the UI here
    //     } else {
    //         alert(response.message); // Show error message from server
    //     }
    // });
}