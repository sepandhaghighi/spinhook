const SPINHOOK_VERSION = "v0.2";
let currentScore = 0;
let currentUsername = "";
let playStartTime = null;

const DOM = {
    playButton: document.getElementById("play-btn"),
    retryButton: document.getElementById("retry-btn"),
    leaderboardButton: document.getElementById("leaderboard-btn"),
    closeLeaderboardButton: document.getElementById("close-leaderboard"),
    username: document.getElementById("username-input"),
    hudScore: document.getElementById("hud-score"),
    hudHighScore: document.getElementById("hud-high-score"),
    hudPlayer: document.getElementById("hud-player"),
    finalScore: document.getElementById("final-score"),
    recordScore: document.getElementById("record-score"),
    leaderboard: document.getElementById("leaderboard-list"),
    gameVersion: document.getElementById("game-version"),
    leaderboardOverlay: document.getElementById("leaderboard-overlay"),
    gameoverOverlay: document.getElementById("gameover-overlay"),
    menuOverlay: document.getElementById("menu-overlay"),
    hudOverlay: document.getElementById("hud-overlay"),
};

const Leaderboard = {

    STORAGE_KEY: "spinhookLeaderboard",


    getAll() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    },


    save(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },


    sanitizeUsername(username) {
        return username.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
    },


    getPlayer(username) {
        return this.getAll().find(player => player.username === username);
    },


    startSession(username) {
        let players = this.getAll();

        let player =
            players.find(p => p.username === username);

        if (!player) {
            player = {

                username: username,

                numberOfPlays: 0,

                bestRecord: 0,

                totalPlayTime: 0,

                bestRecordDate: null
            };

            players.push(player);

        }

        player.numberOfPlays++;

        this.save(players);

        return Date.now();

    },


    finishSession(
        username,
        score,
        startTime
    ) {

        let players = this.getAll();
        let player =
            players.find(p => p.username === username);

        if (!player)
            return;

        const sessionTime =Math.floor((Date.now() - startTime) / 1000);

        player.totalPlayTime += sessionTime;

        if (score > player.bestRecord) {
            player.bestRecord = score;
            player.bestRecordDate =
                new Date().toISOString();
        }
        this.save(players);
    },


    getRanking() {
        return this.getAll().sort((a, b) => b.bestRecord - a.bestRecord);
    }

};

const UI = {
    updateScores: (score) => {
        currentScore = score;
        DOM.hudScore.innerText = score;
        const player = Leaderboard.getPlayer(currentUsername);
        DOM.hudHighScore.innerText = player ? player.bestRecord : 0;
    },
    showScreen: (screenId) => {
        ['menu-overlay', 'gameover-overlay', 'hud-overlay'].forEach(id => {
            const el = document.getElementById(id);
            el.classList.add('hidden');
            el.classList.remove('flex');
        });

        if (screenId === 'hud-overlay') {
            DOM.hudOverlay.classList.remove('hidden');
        } else if (screenId === 'menu-overlay') {
            DOM.menuOverlay.classList.remove('hidden');
            DOM.menuOverlay.classList.add('flex');
        } else if (screenId === 'gameover-overlay') {
            DOM.finalScore.innerText = currentScore;
            const player = Leaderboard.getPlayer(currentUsername);
            DOM.recordScore.innerText = player ? player.bestRecord : 0;
            const goOverlay = DOM.gameoverOverlay;
            goOverlay.classList.remove('hidden');
            goOverlay.classList.add('flex');
        }
    }
};

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.load.audio('attach', 'assets/sounds/attach.wav');
        this.load.audio('death', 'assets/sounds/death.wav');
    }

    create() {
        this.generateProceduralAssets();
        this.scene.start('GameScene');
    }

    generateProceduralAssets() {
        
        const dotCanvas = this.textures.createCanvas('dot-texture', 16, 16);
        if (dotCanvas) {
            const ctx = dotCanvas.context;
            const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.3, 'rgba(0, 255, 204, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 255, 204, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 16, 16);
            dotCanvas.refresh();
        }

        const ballCanvas = this.textures.createCanvas('probe-ball', 32, 32);
        if (ballCanvas) {
            const ctx = ballCanvas.context;
            const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#00ffcc');
            gradient.addColorStop(0.7, 'rgba(0, 255, 204, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 255, 204, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 32, 32);
            ballCanvas.refresh();
        }
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {

        this.orbitGraphics = this.add.graphics();
        
        this.setupParticleEngines();

        
        this.player = this.physics.add.image(0, 0, 'probe-ball');
        this.player.setCircle(10, 6, 6);

        
        this.trailEmitter.startFollow(this.player);

        
        this.input.on('pointerdown', this.handleUserAction, this);

        
        UI.showScreen('menu-overlay');
        this.prepareGameEntities();
        this.scale.on('resize', this.handleResize, this);
    }

    setupParticleEngines() {
        this.trailEmitter = this.add.particles(0, 0, 'dot-texture', {
            speed: 15,
            scale: { start: 1.6, end: 0 },
            alpha: { start: 0.6, end: 0 },
            blendMode: 'ADD',
            lifespan: 200,
            frequency: 8,
            tint: 0x00ffcc
        });
        this.trailEmitter.stop();
        this.burstEmitter = this.add.particles(0, 0, 'dot-texture', {
            speed: { min: 100, max: 300 },
            angle: { min: 0, max: 360 },
            scale: { start: 2.0, end: 0 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: { min: 300, max: 600 },
            gravityY: 150,
            tint: { pick: [0x00ffcc, 0xff00ff, 0xffffff] }
        });
        this.burstEmitter.stop();
    }

    prepareGameEntities() {
        const { width, height } = this.scale;

        this.score = 0;
        UI.updateScores(0);
        this.playerState = PlayerState.ORBITING;
        this.playerAngle = 0;
        this.launchVelocity = new Phaser.Math.Vector2(0, 0);

        this.currentOrbit = {
            x: width / 2,
            y: height - 150,
            radius: 65,
            rotationSpeed: 3.2
        };

        this.nextOrbit = {
            x: width / 2,
            y: height / 2,
            radius: 80,
            rotationSpeed: -3.2
        };

        this.cameras.main.scrollY = 0;
        this.drawActivePathGuides();
    }

    update(time, delta) {
        const dt = delta / 1000;

        if (this.playerState === PlayerState.ORBITING) {
            this.orbitLoop(dt);
        } else if (this.playerState === PlayerState.FLYING) {
            this.flightLoop(dt);
        }
    }

    orbitLoop(dt) {
        this.playerAngle += this.currentOrbit.rotationSpeed * dt;
        this.playerAngle = Phaser.Math.Angle.Normalize(this.playerAngle);

        const px = this.currentOrbit.x + this.currentOrbit.radius * Math.cos(this.playerAngle);
        const py = this.currentOrbit.y + this.currentOrbit.radius * Math.sin(this.playerAngle);

        this.player.setPosition(px, py);
    }

    flightLoop(dt) {
        this.player.setVelocity(this.launchVelocity.x, this.launchVelocity.y);

        const distanceToTarget = Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            this.nextOrbit.x,
            this.nextOrbit.y
        );
        if (Math.abs(distanceToTarget - this.nextOrbit.radius) < 8) {
            this.attachToOrbit();
        }
        const camMinY = this.cameras.main.scrollY;
        const camMaxY = camMinY + this.scale.height;

        if (
            this.player.y < camMinY - 100 ||
            this.player.y > camMaxY + 100 ||
            this.player.x < -100 ||
            this.player.x > this.scale.width + 100
        ) {
            this.gameOver();
        }
    }

    handleUserAction() {
        if (this.playerState === PlayerState.ORBITING) {
            const tx = -Math.sin(this.playerAngle);
            const ty = Math.cos(this.playerAngle);
            const dirMultiplier = Math.sign(this.currentOrbit.rotationSpeed);

            const speed = 700;
            this.launchVelocity.set(
                tx * speed * dirMultiplier,
                ty * speed * dirMultiplier
            );

            this.playerState = PlayerState.FLYING;
            this.trailEmitter.start();
        }
    }

    generateNextOrbit() {

        const difficultyRatio = Math.min(this.score / 25, 1);

        return {

            x: Phaser.Math.Between(150, this.scale.width - 150),

            y: this.currentOrbit.y - Phaser.Math.Between(180, 270),

            radius: Phaser.Math.Between(45, 90 - (35 * difficultyRatio)),

            rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (3.2 + (2.8 * difficultyRatio))
        };
    }

    attachToOrbit() {
        this.sound.play('attach', {volume: 0.4});
        this.player.setVelocity(0, 0);
        this.trailEmitter.stop();
        this.burstEmitter.explode(35, this.player.x, this.player.y);
        this.cameras.main.shake(70, 0.007);
        this.score++;
        UI.updateScores(this.score);

        this.currentOrbit = this.nextOrbit;
        this.playerAngle = Phaser.Math.Angle.Between(
            this.currentOrbit.x,
            this.currentOrbit.y,
            this.player.x,
            this.player.y
        );

        
        this.nextOrbit = this.generateNextOrbit();

        this.playerState = PlayerState.ORBITING;
        this.drawActivePathGuides();

        
        this.cameras.main.pan(
            this.scale.width / 2,
            this.currentOrbit.y - 120,
            450,
            'Cubic.easeOut'
        );
    }

    drawActivePathGuides() {
        this.orbitGraphics.clear();
        this.orbitGraphics.lineStyle(2, 0x1d1d40, 0.6);
        this.orbitGraphics.strokeCircle(this.currentOrbit.x, this.currentOrbit.y, this.currentOrbit.radius);
        this.orbitGraphics.lineStyle(3, 0x00ffcc, 0.85);
        this.orbitGraphics.strokeCircle(this.nextOrbit.x, this.nextOrbit.y, this.nextOrbit.radius);
    }

    gameOver() {
        this.sound.play('death', {volume: 0.5});
        Leaderboard.finishSession(currentUsername, this.score, playStartTime);
        this.playerState = PlayerState.DEAD;
        this.player.setVelocity(0, 0);
        this.trailEmitter.stop();
        this.cameras.main.shake(350, 0.02);
        this.burstEmitter.explode(50, this.player.x, this.player.y);
        UI.showScreen('gameover-overlay');
    }

    handleResize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.cameras.main.setViewport(0, 0, width, height);
        if (this.playerState === PlayerState.ORBITING && this.currentOrbit) {
            this.drawActivePathGuides();
        }
    }
}


const PlayerState = {
    ORBITING: 0,
    FLYING: 1,
    DEAD: 2
};


const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#050510',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [BootScene, GameScene]
};

const game = new Phaser.Game(config);


DOM.playButton.addEventListener('click', ()=>{
    let username = DOM.username.value.trim();

    username = Leaderboard.sanitizeUsername(username);

    if(!username){
        alert("Please enter username");
        return;
    }

    currentUsername = username;
    DOM.hudPlayer.innerText = currentUsername;
    playStartTime = Leaderboard.startSession(username);

    UI.updateScores(0);

    UI.showScreen('hud-overlay');
});

DOM.retryButton.addEventListener('click', () => {
    UI.showScreen('hud-overlay');
    const activeScene = game.scene.getScene('GameScene');
    if (activeScene) {
        activeScene.scene.restart();
    }
});

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});

function renderLeaderboard() {

    const list = DOM.leaderboard;

    const ranking = Leaderboard.getRanking();

    if (ranking.length === 0) {
        list.innerHTML = `
            <div class="text-center text-white/50 arcade-font py-8">
                NO RECORDS YET
            </div>
        `;
        return;
    }

    list.innerHTML = `

        <div class="grid grid-cols-5 gap-2 pb-3 mb-3 border-b border-[#1a1a3a] text-[#00ffcc] font-bold arcade-font text-xs uppercase sticky top-0 bg-[#080816]/95 backdrop-blur">

            <div>Rank</div>
            <div>Player</div>
            <div class="text-center">Best</div>
            <div class="text-center">Plays</div>
            <div class="text-center">Time</div>

        </div>

        ${ranking.map((player, index) => {

            const hours = Math.floor(player.totalPlayTime / 3600);

            const minutes =Math.floor((player.totalPlayTime % 3600) / 60);

            const rank =
                index === 0 ? "🥇" :
                index === 1 ? "🥈" :
                index === 2 ? "🥉" :
                `#${index + 1}`;

            return `

                <div class="grid grid-cols-5 gap-2 py-2 border-b border-[#1a1a3a]/50 items-center arcade-font text-sm">

                    <div class="truncate text-white/70 font-bold">${rank}</div>

                    <div class="truncate text-white/70 font-bold">
                        ${player.username}
                    </div>

                    <div class="text-center text-white/70 font-bold">
                        ${player.bestRecord}
                    </div>

                    <div class="text-center text-white/70 font-bold">
                        ${player.numberOfPlays}
                    </div>

                    <div class="text-center text-white/70">
                        ${hours}h ${minutes}m
                    </div>

                </div>

            `;

        }).join("")}
    `;
}

DOM.leaderboardButton.addEventListener("click", ()=>{
    renderLeaderboard();
    const overlay = DOM.leaderboardOverlay;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
});

DOM.closeLeaderboardButton.addEventListener("click",()=>{
    const overlay = DOM.leaderboardOverlay;
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
});

DOM.gameVersion.innerText = SPINHOOK_VERSION;
