(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_HEIGHT = 70;

  const bird = { x: WIDTH * 0.25, y: HEIGHT * 0.5, r: 12, v: 0 };
  let pipes = [];
  let score = 0;
  let highScore = Number(localStorage.getItem('flappyHighScore') || 0);
  let lastSpawn = 0;
  let lastTime = 0;
  let started = false;
  let isGameOver = false;

  const config = {
    gravity: 1800, // px/s^2
    jumpVelocity: -520, // px/s
    pipeWidth: 70,
    baseGap: 170,
    minGap: 120,
    spawnInterval: 1.5, // seconds
    baseSpeed: 170, // px/s
    speedPerPoint: 6,
  };

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioContext ? new AudioContext() : null;
  const masterGain = audioCtx ? audioCtx.createGain() : null;
  if (masterGain) {
    masterGain.gain.value = 0.25;
    masterGain.connect(audioCtx.destination);
  }

  function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(type, frequency, duration, volume, detune = 0) {
    if (!audioCtx || !masterGain) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(masterGain);
    const now = audioCtx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.stop(now + duration);
  }

  function playJumpSound() {
    playTone('square', 640, 0.12, 0.4);
  }

  function playScoreSound() {
    playTone('triangle', 880, 0.14, 0.32, 30);
  }

  function playGameOverSound() {
    playTone('sawtooth', 180, 0.25, 0.35, -200);
  }

  function currentGap() {
    const shrink = Math.min(score * 2, config.baseGap - config.minGap);
    return config.baseGap - shrink;
  }

  function currentSpeed() {
    return config.baseSpeed + score * config.speedPerPoint;
  }

  function spawnPipe(xPosition) {
    const gap = currentGap();
    const margin = 50;
    const maxTop = HEIGHT - GROUND_HEIGHT - gap - margin;
    const gapY = margin + Math.random() * Math.max(maxTop - margin, 1);
    const x = typeof xPosition === 'number' ? xPosition : WIDTH + config.pipeWidth + 40;
    pipes.push({ x, gapY, gap, scored: false });
  }

  function resetGame() {
    pipes = [];
    score = 0;
    bird.y = HEIGHT * 0.5;
    bird.v = 0;
    lastSpawn = 0;
    lastTime = 0;
    started = false;
    isGameOver = false;
    spawnPipe(WIDTH + 220);
    spawnPipe(WIDTH + 520);
  }

  function flap() {
    bird.v = config.jumpVelocity;
    playJumpSound();
  }

  function handleInput() {
    resumeAudio();
    if (isGameOver) {
      resetGame();
      started = true;
      flap();
      return;
    }
    started = true;
    flap();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      handleInput();
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleInput();
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function setHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('flappyHighScore', String(highScore));
    }
  }

  function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    playGameOverSound();
  }

  function update(delta) {
    if (!started || isGameOver) {
      return;
    }

    bird.v += config.gravity * delta;
    bird.y += bird.v * delta;

    lastSpawn += delta;
    if (lastSpawn >= config.spawnInterval) {
      spawnPipe();
      lastSpawn = 0;
    }

    const speed = currentSpeed();
    for (const pipe of pipes) {
      pipe.x -= speed * delta;
    }

    const birdTop = bird.y - bird.r;
    const birdBottom = bird.y + bird.r;

    if (birdTop <= 0) {
      bird.y = bird.r;
      gameOver();
    }

    if (birdBottom >= HEIGHT - GROUND_HEIGHT) {
      bird.y = HEIGHT - GROUND_HEIGHT - bird.r;
      gameOver();
    }

    for (const pipe of pipes) {
      const withinPipeX =
        bird.x + bird.r > pipe.x && bird.x - bird.r < pipe.x + config.pipeWidth;

      if (withinPipeX) {
        if (birdTop < pipe.gapY || birdBottom > pipe.gapY + pipe.gap) {
          gameOver();
        }
      }

      if (!pipe.scored && pipe.x + config.pipeWidth < bird.x - bird.r) {
        pipe.scored = true;
        score += 1;
        setHighScore();
        playScoreSound();
      }
    }

    pipes = pipes.filter((p) => p.x + config.pipeWidth > -20);
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#5dd0ff');
    gradient.addColorStop(1, '#b6f1ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawGround() {
    ctx.fillStyle = '#d9c07a';
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
    ctx.fillStyle = '#c0a85f';
    for (let x = 0; x < WIDTH; x += 24) {
      ctx.fillRect(x, HEIGHT - GROUND_HEIGHT, 16, 12);
    }
  }

  function drawPipes() {
    ctx.fillStyle = '#2ecc71';
    ctx.strokeStyle = '#1b9b55';
    ctx.lineWidth = 3;
    for (const pipe of pipes) {
      ctx.beginPath();
      ctx.rect(pipe.x, 0, config.pipeWidth, pipe.gapY);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(pipe.x, pipe.gapY + pipe.gap, config.pipeWidth, HEIGHT - GROUND_HEIGHT - (pipe.gapY + pipe.gap));
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#3ddf82';
      ctx.fillRect(pipe.x - 2, pipe.gapY - 12, config.pipeWidth + 4, 14);
      ctx.fillRect(pipe.x - 2, pipe.gapY + pipe.gap - 2, config.pipeWidth + 4, 14);
      ctx.fillStyle = '#2ecc71';
    }
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    const angle = Math.max(-0.4, Math.min(0.8, bird.v / 800));
    ctx.rotate(angle);
    ctx.fillStyle = '#ffdd55';
    ctx.strokeStyle = '#e6b800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff914d';
    ctx.beginPath();
    ctx.ellipse(bird.r + 2, 0, 8, 6, 0, -0.6, 0.6);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(5, -4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, WIDTH, 56);

    ctx.fillStyle = '#fff';
    ctx.font = '20px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 14, 32);
    ctx.textAlign = 'right';
    ctx.fillText(`Best: ${highScore}`, WIDTH - 14, 32);

    if (!started && !isGameOver) {
      ctx.fillStyle = '#0a3a4f';
      ctx.font = '24px "Segoe UI", Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap or press Space to start', WIDTH / 2, HEIGHT / 2 - 20);
      ctx.font = '18px "Segoe UI", Tahoma, sans-serif';
      ctx.fillText('Stay airborne and pass the pipes', WIDTH / 2, HEIGHT / 2 + 8);
    }

    if (isGameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = '30px "Segoe UI", Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 10);
      ctx.font = '18px "Segoe UI", Tahoma, sans-serif';
      ctx.fillText('Tap or press Space to restart', WIDTH / 2, HEIGHT / 2 + 22);
    }
  }

  function draw() {
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();
    drawHUD();
  }

  function loop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }
    const delta = Math.min((timestamp - lastTime) / 1000, 0.03);
    lastTime = timestamp;
    update(delta);
    draw();
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
})();
