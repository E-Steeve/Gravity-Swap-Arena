// --- CONFIGURATION ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY_FORCE = 0.5;
const JUMP_FORCE = 12;
const SPEED = 5;
const SWAP_COOLDOWN = 90; // frames (approx 1.5 sec)
const ATTACK_COOLDOWN = 30;
const ATTACK_DURATION = 10;
const KNOCKBACK = 10;

// --- GAME STATES ---
let gameOver = false;

const keys = {};

// --- PLAYERS ---
class Player {
    constructor(id, x, color, controls) {
        this.id = id;
        this.x = x;
        this.y = 300;
        this.w = 30;
        this.h = 30;
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.lives = 3;
        
        this.gravityDir = 1; // 1 = down, -1 = up
        this.swapTimer = 0;
        
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldownTimer = 0;
        this.facing = 1; // 1 right, -1 left
        
        this.stunned = 0;
        
        this.ctrl = controls; // mapping touches
    }

    update() {
        if (this.lives <= 0) return;
        
        // Cooldowns
        if (this.swapTimer > 0) this.swapTimer--;
        if (this.attackCooldownTimer > 0) this.attackCooldownTimer--;
        if (this.stunned > 0) {
            this.stunned--;
            this.applyPhysics();
            return; // No control if stunned
        }

        // --- CONTROLS ---
        // L/R Moves
        if (keys[this.ctrl.left]) {
            this.vx = -SPEED;
            this.facing = -1;
        } else if (keys[this.ctrl.right]) {
            this.vx = SPEED;
            this.facing = 1;
        } else {
            this.vx = 0;
        }

        // Jump (according to gravity)
        let onGround = false;
        if (this.gravityDir === 1 && this.y + this.h >= platforms[0].y && 
            this.y <= platforms[0].y + platforms[0].h && this.x + this.w > platforms[0].x && 
            this.x < platforms[0].x + platforms[0].w) {
             // Normal gravity on central platform
             onGround = true;
        } else if (this.gravityDir === -1 && this.y <= platforms[0].y + platforms[0].h &&
             this.y + this.h >= platforms[0].y && this.x + this.w > platforms[0].x && 
             this.x < platforms[0].x + platforms[0].w) {
             // Reversed gravity on central platform
             onGround = true;
        }
        
        // Check small platforms
        for(let i=1; i<platforms.length; i++) {
            let p = platforms[i];
            if (this.x + this.w > p.x && this.x < p.x + p.w) {
                if (this.gravityDir === 1 && Math.abs((this.y + this.h) - p.y) < 10) onGround = true;
                if (this.gravityDir === -1 && Math.abs(this.y - (p.y + p.h)) < 10) onGround = true;
            }
        }

        if (keys[this.ctrl.jump] && onGround) {
            this.vy = -JUMP_FORCE * this.gravityDir;
        }

        // Gravity Swap
        if (keys[this.ctrl.swap] && this.swapTimer === 0) {
            this.gravityDir *= -1;
            this.swapTimer = SWAP_COOLDOWN;
            this.vy = 0; // Stop vertical momentum
        }

        // Attaque
        if (keys[this.ctrl.atk] && this.attackCooldownTimer === 0) {
            this.isAttacking = true;
            this.attackTimer = ATTACK_DURATION;
            this.attackCooldownTimer = ATTACK_COOLDOWN;
        }

        if (this.isAttacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) this.isAttacking = false;
        }

        this.applyPhysics();
        this.checkSpikes();
    }

    applyPhysics() {
        this.vy += GRAVITY_FORCE * this.gravityDir;
        this.x += this.vx;
        this.y += this.vy;

        // Simple collisions
        platforms.forEach(p => {
            // Basic collision AABB
            if (this.x < p.x + p.w && this.x + this.w > p.x &&
                this.y < p.y + p.h && this.y + this.h > p.y) {
                
                // Simple solution (push vertically)
                if (this.vy > 0 && this.gravityDir === 1 && this.y + this.h < p.y + p.h) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                }
                else if (this.vy < 0 && this.gravityDir === -1 && this.y > p.y) {
                    this.y = p.y + p.h;
                    this.vy = 0;
                }
            }
        });

        // Screen limits
        if (this.x < 0) this.x = 0;
        if (this.x + this.w > canvas.width) this.x = canvas.width - this.w;
    }

    checkSpikes() {
        // Spikes UP and DOWN
        if (this.y < 20 || this.y + this.h > canvas.height - 20) {
            this.die();
        }
    }

    die() {
        this.lives--;
        updateUI();
        if (this.lives <= 0) {
            endGame(this.id === 1 ? 2 : 1);
        } else {
            this.respawn();
        }
    }

    respawn() {
        this.vx = 0;
        this.vy = 0;
        this.gravityDir = 1;
        this.stunned = 0;
        if (this.id === 1) {
            this.x = 100; this.y = 300;
        } else {
            this.x = 670; this.y = 300;
        }
    }

    draw() {
        if (this.lives <= 0) return;

        ctx.save();
        
        // Gravity indicator (head upside down)
        if (this.gravityDir === -1) {
            ctx.translate(this.x + this.w/2, this.y + this.h/2);
            ctx.scale(1, -1);
            ctx.translate(-(this.x + this.w/2), -(this.y + this.h/2));
        }

        // Body
        ctx.fillStyle = this.stunned > 0 ? "white" : this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        
        // Eyes (to see the direction)
        ctx.fillStyle = "black";
        let eyeOffset = this.facing === 1 ? 20 : 5;
        ctx.fillRect(this.x + eyeOffset, this.y + 5, 5, 5);

        // Attack (Sword)
        if (this.isAttacking) {
            ctx.fillStyle = "yellow";
            let atkX = this.facing === 1 ? this.x + this.w : this.x - 40;
            ctx.fillRect(atkX, this.y + 10, 40, 10);
        }

        // Swap bar
        if (this.swapTimer > 0) {
            ctx.fillStyle = "gray";
            ctx.fillRect(this.x, this.y - 10, 30, 5);
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(this.x, this.y - 10, 30 * (1 - this.swapTimer/SWAP_COOLDOWN), 5);
        }

        ctx.restore();
    }
}

// --- PLATFORMS ---
const platforms = [
    {x: 250, y: 280, w: 600, h: 40}, // Center
    {x: 50, y: 400, w: 100, h: 20},  // Lower left
    {x: 950, y: 400, w: 100, h: 20}, // Lower right
    {x: 50, y: 180, w: 100, h: 20},  // Higher left
    {x: 950, y: 180, w: 100, h: 20}  // Higher right
];

// --- INITIALIZATION ---
const p1 = new Player(1, 100, "#44aaff", {left: "a", right: "d", jump: "w", swap: "s", atk: "q"});
const p2 = new Player(2, 970, "#ffaa44", {left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", swap: "ArrowDown", atk: "k"});

// --- GAME LOOP ---
function update() {
    if (gameOver) return;

    p1.update();
    p2.update();

    // Check attacks between players
    checkCombat(p1, p2);
    checkCombat(p2, p1);

    draw();
    requestAnimationFrame(update);
}

function checkCombat(attacker, defender) {
    if (attacker.isAttacking && attacker.attackTimer > 0 && defender.stunned === 0) {
        // Hitbox simple check
        let atkX = attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - 40;
        let atkW = 40;
        
        if (atkX < defender.x + defender.w && atkX + atkW > defender.x &&
            attacker.y < defender.y + defender.h && attacker.y + 10 > defender.y) {
            
            // TOUCHED !
            defender.stunned = 20; // Stun frames
            defender.vx = attacker.facing * KNOCKBACK; 
            defender.vy = -5 * defender.gravityDir;
        }
    }
}

function draw() {
    // Font
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Spikes (Death zone)
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(0, 0, canvas.width, 20); // Haut
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20); // Bas
    
    // Spikes visual
    ctx.fillStyle = "#aa0000";
    for(let i=0; i<canvas.width; i+=40) {
        ctx.beginPath();
        ctx.moveTo(i, 20); ctx.lineTo(i+20, 50); ctx.lineTo(i+40, 20);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(i, canvas.height-20); ctx.lineTo(i+20, canvas.height-50); ctx.lineTo(i+40, canvas.height-20);
        ctx.fill();
    }

    // Platforms
    ctx.fillStyle = "#666";
    platforms.forEach(p => {
        ctx.fillRect(p.x, p.y, p.w, p.h);
    
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    // Players
    p1.draw();
    p2.draw();
}

function updateUI() {
    document.getElementById('p1Score').innerText = "P1 Vies: " + p1.lives;
    document.getElementById('p2Score').innerText = "P2 Vies: " + p2.lives;
}

function endGame(winnerId) {
    gameOver = true;
    const msg = document.getElementById('winnerMsg');
    msg.innerText = "VICTOIRE JOUEUR " + winnerId + " !";
    msg.style.display = "block";
    msg.style.color = winnerId === 1 ? "#44aaff" : "#ffaa44";

    setTimeout(() => {
        location.reload();
    }, 3000);
}

// --- INPUTS ---
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// Start
update();