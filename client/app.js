console.log("app js connected.");

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

