const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nCtx = nextCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const startBtn = document.getElementById('start-button');

// --- SISTEMA DE SOM INFALÍVEL (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration) {
    if (audioCtx.state === 'suspended') return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

const soundMove = () => playTone(150, 'square', 0.1);
const soundClear = () => { playTone(400, 'sine', 0.2); playTone(600, 'sine', 0.3); };
const soundGameOver = () => playTone(100, 'sawtooth', 0.5);

// Configurações do Jogo
const ROW = 20;
const COL = 10;
const SQ = 24; 
const VACANT = "black"; 
let gameRunning = false;
let score = 0;
let level = 1;
let speed = 600;

function drawSquare(x, y, color, ctxRef = context, size = SQ) {
    ctxRef.fillStyle = color;
    ctxRef.fillRect(x * size, y * size, size, size);
    ctxRef.strokeStyle = "#111";
    ctxRef.strokeRect(x * size, y * size, size, size);
}

let board = Array.from({ length: ROW }, () => Array(COL).fill(VACANT));

function drawBoard() {
    board.forEach((row, r) => row.forEach((color, c) => drawSquare(c, r, color)));
}

const PIECES = [
    [ [[0,1,1],[1,1,0],[0,0,0]], "#ff0055" ], // S
    [ [[1,1,0],[0,1,1],[0,0,0]], "#00ff00" ], // Z
    [ [[0,1,0],[0,1,0],[0,1,1]], "#ffa500" ], // L
    [ [[0,1,0],[0,1,0],[1,1,0]], "#a020f0" ], // J
    [ [[1,1],[1,1]], "#ffff00" ],             // O
    [ [[1,1,1,1],[0,0,0,0],[0,0,0,0],[0,0,0,0]], "#00f2fe" ], // I
    [ [[1,1,1],[0,1,0],[0,0,0]], "#ff0000" ]  // T
];

class Piece {
    constructor(matrix, color) {
        this.matrix = matrix;
        this.color = color;
        this.x = 3;
        this.y = -2;
    }

    draw(color) {
        this.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) drawSquare(this.x + x, this.y + y, color);
            });
        });
    }

    moveDown() {
        if (!this.collision(0, 1)) {
            this.draw(VACANT);
            this.y++;
            this.draw(this.color);
        } else {
            this.lock();
            setNextActive();
        }
    }

    moveRight() {
        if (!this.collision(1, 0)) {
            this.draw(VACANT);
            this.x++;
            this.draw(this.color);
            soundMove();
        }
    }

    moveLeft() {
        if (!this.collision(-1, 0)) {
            this.draw(VACANT);
            this.x--;
            this.draw(this.color);
            soundMove();
        }
    }

    rotate() {
        let nextPattern = this.matrix[0].map((_, index) => this.matrix.map(col => col[index]).reverse());
        if (!this.collision(0, 0, nextPattern)) {
            this.draw(VACANT);
            this.matrix = nextPattern;
            this.draw(this.color);
            soundMove();
        }
    }

    collision(dx, dy, futureMatrix = this.matrix) {
        for (let r = 0; r < futureMatrix.length; r++) {
            for (let c = 0; c < futureMatrix[r].length; c++) {
                if (!futureMatrix[r][c]) continue;
                let newX = this.x + c + dx;
                let newY = this.y + r + dy;
                if (newX < 0 || newX >= COL || newY >= ROW) return true;
                if (newY < 0) continue;
                if (board[newY][newX] !== VACANT) return true;
            }
        }
        return false;
    }

    lock() {
        this.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    if (this.y + y < 0) {
                        soundGameOver();
                        alert("Game Over! Pontos: " + score);
                        location.reload(); 
                        return;
                    }
                    board[this.y + y][this.x + x] = this.color;
                }
            });
        });
        this.removeLines();
        drawBoard();
    }

    removeLines() {
        let linesCleared = 0;
        for (let r = 0; r < ROW; r++) {
            if (!board[r].includes(VACANT)) {
                board.splice(r, 1);
                board.unshift(new Array(COL).fill(VACANT));
                linesCleared++;
                score += 100;
            }
        }
        if (linesCleared > 0) {
            soundClear();
            scoreElement.innerHTML = score;
            // ATUALIZAÇÃO: Nível a cada 500 pontos
            let newLevel = Math.floor(score / 500) + 1;
            if (newLevel > level) {
                level = newLevel;
                levelElement.innerHTML = level;
                speed = Math.max(100, 600 - (level * 50)); 
            }
        }
    }
}

// --- LÓGICA DE PRÓXIMA PEÇA ---
let p;
let nextPieceData;

function getRandomPieceData() {
    let r = Math.floor(Math.random() * PIECES.length);
    return { matrix: PIECES[r][0], color: PIECES[r][1] };
}

function setNextActive() {
    p = new Piece(nextPieceData.matrix, nextPieceData.color);
    nextPieceData = getRandomPieceData();
    drawNext();
}

function drawNext() {
    nCtx.fillStyle = "black";
    nCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextPieceData.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value) {
                // Desenha a peça no centro do mini-canvas
                drawSquare(c + 1, r + 1, nextPieceData.color, nCtx, 20);
            }
        });
    });
}

document.addEventListener("keydown", (event) => {
    if (!gameRunning) return;
    if (event.keyCode == 37) p.moveLeft();
    else if (event.keyCode == 38) p.rotate();
    else if (event.keyCode == 39) p.moveRight();
    else if (event.keyCode == 40) p.moveDown();
});

let dropStart = Date.now();
function drop() {
    if (!gameRunning) return;
    let now = Date.now();
    if (now - dropStart > speed) {
        p.moveDown();
        dropStart = Date.now();
    }
    requestAnimationFrame(drop);
}

startBtn.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    gameRunning = true;
    startBtn.style.display = 'none';
    nextPieceData = getRandomPieceData();
    setNextActive();
    drawBoard();
    drop();
});

// Controles Mobile
document.getElementById('left').addEventListener('click', () => { if(gameRunning) p.moveLeft(); });
document.getElementById('right').addEventListener('click', () => { if(gameRunning) p.moveRight(); });
document.getElementById('rotate').addEventListener('click', () => { if(gameRunning) p.rotate(); });
document.getElementById('down').addEventListener('click', () => { if(gameRunning) p.moveDown(); });

drawBoard();