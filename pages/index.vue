<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createClient } from '@supabase/supabase-js';

enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  LEADERBOARD = 'LEADERBOARD',
}

interface GameScore {
  current: number;
  best: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  opacity: number;
  life: number;
}

interface LeaderboardEntry {
  id?: string;
  nickname: string;
  score: number;
  created_at?: string;
}

type LeaderboardStatus = 'ok' | 'empty' | 'error';

interface PromoReward {
  score: number;
  code: string;
  discount: number;
}

const COLORS = {
  backgroundTop: '#15252B', // Brand dark
  backgroundBottom: '#0F1B20', // Deeper shade for gradient
  primaryRed: '#FF2C00', // Brand bright
  primaryRedLight: '#FF6A4D',
  primaryRedDark: '#C81F00',
  boxMain: '#CB9F7F',
  boxLight: '#DCC0A6',
  boxDark: '#B08363',
  boxTape: '#E9D4BD',
  text: '#ffffff',
  accentGold: '#FFD700',
  success: '#4ADE80',
};

const GAME_CONFIG = {
  baseWidth: 220,
  blockHeight: 70,
  initialSpeed: 4,
  speedIncrement: 0.2,
  maxSpeed: 14.4,
  perfectTolerance: 3, // Tightened tolerance
  comboThreshold: 3, // Consecutive perfects for bonus
  widthBonus: 20, // Pixel growth on combo
};

const PERFECT_MESSAGES = [
  "ВАУ",
  "Молодец",
  "Идеально!",
  "Ровненько!",
  "Больше баллов!",
  "Удачно!",
];

const getEmojiForLevel = (level: number): string => {
  if (level >= 20) return '🕋'; // Special Gift
  if (level >= 16) return '📺'; // TV
  if (level >= 11) return '💻'; // Laptop
  if (level >= 6) return '🎧'; // Headphones
  return '📱'; // Phone
};

const PROMO_REWARDS = [
  { score: 10, code: 'RMLD', discount: 500 },
  { score: 20, code: 'HJKL', discount: 1000 },
  { score: 30, code: 'KLSD', discount: 1500 },
];


interface Block {
  x: number;
  y: number;
  width: number;
  color: string;
  emoji: string;
  isDebris?: boolean;
  vy?: number;
  r?: number;
  variant?: 'full' | 'cut';
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  isCrescent?: boolean;
}

type BoxStyle = 'legacy' | 'v2';

interface BoxTemplate {
  frontHeight: number;
  frontY: number;
  frontWidth: number;
  contentWidth: number;
  contentHeight: number;
  topFace: Array<{ x: number; y: number }>;
  sideFace: Array<{ x: number; y: number }>;
  outerTopStrip: { x: number; y: number; w: number; h: number };
  outerBottomStrip: { x: number; y: number; w: number; h: number };
  innerTopStrip: { x: number; y: number; w: number; h: number };
  innerBottomStrip: { x: number; y: number; w: number; h: number };
  panelXs: number[];
  panelYs: number[];
  panelW: number;
  panelH: number;
}

class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private blocks: Block[] = [];
  private debris: Block[] = [];
  private stars: Star[] = [];
  private floatingTexts: FloatingText[] = [];
  
  private currentBlock: Block | null = null;
  private direction: number = 1; 
  private speed: number = GAME_CONFIG.initialSpeed;
  private score: number = 0;
  private cameraY: number = 0;
  private state: GameState = GameState.START;
  private perfectStreak: number = 0;
  private lastPlacement: { x: number; y: number; time: number } | null = null;
  private lastFrameTime: number = performance.now();
  
  private onScoreUpdate: (score: number) => void;
  private onGameOver: (score: number) => void;
  private animationId: number = 0;
  private boxStyle: BoxStyle = 'legacy';

  constructor(
    canvas: HTMLCanvasElement, 
    callbacks: { 
      onScoreUpdate: (s: number) => void; 
      onGameOver: (s: number) => void;
    },
    options?: { boxStyle?: BoxStyle }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onScoreUpdate = callbacks.onScoreUpdate;
    this.onGameOver = callbacks.onGameOver;
    this.boxStyle = options?.boxStyle ?? 'legacy';

    this.initStars();
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
    
    // Start loop immediately for background animation
    this.loop();
  }

  private resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initStars() {
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random(),
        speed: Math.random() * 0.05 + 0.01,
      });
    }

    // Add Ramadan crescents in place of some stars
    const crescentCount = 7;
    for (let i = 0; i < crescentCount; i++) {
      const idx = Math.floor(Math.random() * this.stars.length);
      this.stars[idx] = {
        ...this.stars[idx],
        isCrescent: true,
        size: (Math.random() * 3 + 3.5) * 1.4,
        opacity: Math.random() * 0.4 + 0.6,
        speed: Math.random() * 0.015 + 0.004,
      };
    }
  }

  public start() {
    this.blocks = [];
    this.debris = [];
    this.floatingTexts = [];
    this.score = 0;
    this.perfectStreak = 0;
    this.speed = GAME_CONFIG.initialSpeed;
    this.state = GameState.PLAYING;
    this.cameraY = 0;
    this.onScoreUpdate(0);

    // Initial Base Block
    const baseBlock: Block = {
      x: (this.canvas.width - GAME_CONFIG.baseWidth) / 2,
      y: this.canvas.height - 150,
      width: GAME_CONFIG.baseWidth,
      color: COLORS.boxMain,
      emoji: '',
      variant: 'full',
    };
    this.blocks.push(baseBlock);

    this.spawnNextBlock();
  }

  private spawnNextBlock() {
    const prevBlock = this.blocks[this.blocks.length - 1];
    const stackStep = this.getStackStep();
    // Next emoji depends on the *next* level (current score + 1)
    const nextEmoji = getEmojiForLevel(this.score + 1);
    
    this.currentBlock = {
      x: -prevBlock.width,
      y: prevBlock.y - stackStep,
      width: prevBlock.width,
      color: COLORS.boxMain,
      emoji: nextEmoji,
      variant: 'full',
    };
    
    // Randomize start side
    this.direction = Math.random() > 0.5 ? 1 : -1;
    if (this.direction === 1) {
        this.currentBlock.x = -this.currentBlock.width;
    } else {
        this.currentBlock.x = this.canvas.width;
    }
  }

  public handleInput() {
    if (this.state !== GameState.PLAYING || !this.currentBlock) return;

    const prevBlock = this.blocks[this.blocks.length - 1];
    const current = this.currentBlock;

    const dist = current.x - prevBlock.x;
    const absDist = Math.abs(dist);

    // 1. Check Miss
    if (absDist >= current.width) {
      this.gameOver();
      return;
    }

    // 2. Check Perfect or Cut
    let newWidth = current.width;
    let newX = current.x;
    let newVariant: Block['variant'] = 'full';

    if (absDist <= GAME_CONFIG.perfectTolerance) {
      // Perfect Snap
      newX = prevBlock.x;
      newWidth = prevBlock.width; 
      newVariant = 'full';
      
      this.handlePerfectMatch(newX, current.y);
      
      // Recovery Mechanic: Grow block on streak
      if (this.perfectStreak > 0 && this.perfectStreak % GAME_CONFIG.comboThreshold === 0) {
        newWidth = Math.min(newWidth + GAME_CONFIG.widthBonus, GAME_CONFIG.baseWidth * 1.5);
        // Center the growth
        newX = prevBlock.x - (GAME_CONFIG.widthBonus / 2);
        this.addFloatingText(`Больше баллов!`, this.canvas.width / 2, this.canvas.height / 2 - 100, '#4ADE80');
      }

    } else {
      // Cut
      this.perfectStreak = 0; // Reset streak
      newWidth = current.width - absDist;
      newVariant = 'cut';
      
      let debrisX, debrisWidth;
      if (dist > 0) {
        // Block to right, cut right excess
        newX = current.x; 
        debrisX = prevBlock.x + prevBlock.width;
        debrisWidth = absDist;
      } else {
        // Block to left, cut left excess
        newX = prevBlock.x;
        debrisX = current.x;
        debrisWidth = absDist;
      }

      this.debris.push({
        x: debrisX,
        y: current.y,
        width: debrisWidth,
        color: COLORS.boxDark,
        emoji: '', 
        isDebris: true,
        vy: 2,
        r: 0
      });
    }

    // Commit Block
    this.blocks.push({
      ...current,
      x: newX,
      width: newWidth,
      variant: newVariant,
    });

    this.lastPlacement = {
      x: newX + newWidth / 2,
      y: current.y + GAME_CONFIG.blockHeight / 2,
      time: Date.now(),
    };

    this.score++;
    this.onScoreUpdate(this.score);

    // Increase Speed
    this.speed = Math.min(GAME_CONFIG.maxSpeed, GAME_CONFIG.initialSpeed + (this.score * GAME_CONFIG.speedIncrement));

    this.spawnNextBlock();
  }

  private handlePerfectMatch(x: number, y: number) {
    this.perfectStreak++;
    
    // Flash effect (handled in draw via globalAlpha or overlay)
    
    // Floating Text
    const msg = PERFECT_MESSAGES[Math.floor(Math.random() * PERFECT_MESSAGES.length)];
    this.addFloatingText(msg, x + Math.random() * 50, y);
    
    // Add sparkles/particles? (Simplified to just text for now to keep code clean)
  }

  private addFloatingText(text: string, x: number, y: number, color?: string) {
    this.floatingTexts.push({
      id: Date.now() + Math.random(),
      x,
      y,
      text,
      opacity: 1,
      life: 60,
    });
  }

  private gameOver() {
    this.state = GameState.GAME_OVER;
    
    if (this.currentBlock) {
      this.debris.push({
        ...this.currentBlock,
        isDebris: true,
        vy: 5,
        r: 0
      });
    }
    
    this.currentBlock = null;
    this.onGameOver(this.score);
  }

  private update(delta: number) {
    // Always update stars
    // But gameplay logic only when playing/gameover debris
    
    if (this.state === GameState.PLAYING && this.currentBlock) {
      this.currentBlock.x += this.speed * this.direction * delta;
      
      if (this.currentBlock.x + this.currentBlock.width > this.canvas.width) {
        this.direction = -1;
      } else if (this.currentBlock.x < 0) {
        this.direction = 1;
      }
    }

    // Update Debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.y += (d.vy || 0) * delta;
      d.vy = (d.vy || 0) + 0.5 * delta;
      d.r = (d.r || 0) + 0.1 * delta;
      
      if (d.y > this.canvas.height + 100) {
        this.debris.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1 * delta;
      ft.life -= delta;
      ft.opacity = ft.life / 30; // Fade out
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Camera Logic
    // Keep the top of the stack below HUD. The new design on mobile has extra top inset.
    const isMobileViewport = this.canvas.width <= 768;
    const hudGapOffset = this.boxStyle === 'v2' ? (isMobileViewport ? 30 : 15) : 0;
    const targetY = (this.blocks.length * this.getStackStep()) - (this.canvas.height / 2) + hudGapOffset;
    const safeTargetY = Math.max(0, targetY);
    if (safeTargetY > this.cameraY) {
       this.cameraY += (safeTargetY - this.cameraY) * 0.1 * delta;
    }
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, COLORS.backgroundTop);
    grad.addColorStop(1, COLORS.backgroundBottom);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Stars + crescents
    this.ctx.fillStyle = '#FFF';
    this.stars.forEach(star => {
      const alpha = star.isCrescent
        ? (0.75 + 0.25 * Math.sin(Date.now() * star.speed)) * star.opacity
        : Math.abs(Math.sin(Date.now() * star.speed)) * star.opacity;
      this.ctx.globalAlpha = alpha;
      if (star.isCrescent) {
        this.drawCrescent(star.x, star.y, star.size);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
    this.ctx.globalAlpha = 1.0;

    this.ctx.save();
    // Camera Transform
    // Shift world DOWN based on cameraY
    this.ctx.translate(0, this.cameraY);

    // Draw Blocks
    this.blocks.forEach(b => this.drawBlock(b));
    this.debris.forEach(d => this.drawBlock(d, true));

    if (this.currentBlock) {
      this.drawBlock(this.currentBlock);
    }

    // Placement ring animation
    if (this.lastPlacement) {
      const elapsed = Date.now() - this.lastPlacement.time;
      const t = Math.min(1, elapsed / 300);
      if (t >= 1) {
        this.lastPlacement = null;
      } else {
        const radius = 10 + t * 26;
        this.ctx.save();
        this.ctx.globalAlpha = 1 - t;
        this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.lastPlacement.x, this.lastPlacement.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // Floating Texts (Rendered in world space or screen space? Better screen space usually, but here they are attached to blocks)
    // Actually let's render them in world space so they move with camera
    this.floatingTexts.forEach(ft => {
        this.ctx.globalAlpha = Math.max(0, Math.min(1, ft.opacity));
        this.ctx.fillStyle = COLORS.accentGold;
        this.ctx.font = 'bold 24px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'black';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(ft.text, ft.x + (this.currentBlock?.width || 100)/2, ft.y);
        this.ctx.shadowBlur = 0;
    });
    this.ctx.globalAlpha = 1.0;

    this.ctx.restore();
  }

  private drawBlock(b: Block, isDebris = false) {
    if (isDebris) {
        this.ctx.save();
        this.ctx.translate(b.x + b.width/2, b.y + GAME_CONFIG.blockHeight/2);
        this.ctx.rotate(b.r || 0);
        this.ctx.translate(-b.width/2, -GAME_CONFIG.blockHeight/2);
        this.drawBlockShape(0, 0, b.width, GAME_CONFIG.blockHeight, b.color, b.emoji, 'debris');
        this.ctx.restore();
    } else {
        const variant = b.variant === 'cut' ? 'cut' : 'full';
        this.drawBlockShape(b.x, b.y, b.width, GAME_CONFIG.blockHeight, b.color, b.emoji, variant);
    }
  }

  private drawBlockShape(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    emoji: string,
    variant: 'full' | 'cut' | 'debris'
  ) {
    if (this.boxStyle === 'v2') {
      this.drawBlockShapeV2(x, y, w, h, variant);
      return;
    }
    const depth = 12; // Deeper 3D effect
    
    // Main Face
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0,0,0,0.25)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetY = 4;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.restore();
    
    // Top Face (Light)
      this.ctx.fillStyle = COLORS.boxLight;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + depth, y - depth);
    this.ctx.lineTo(x + w + depth, y - depth);
    this.ctx.lineTo(x + w, y);
    this.ctx.closePath();
    this.ctx.fill();

    // Side Face (Dark)
    this.ctx.fillStyle = COLORS.boxDark;
    this.ctx.beginPath();
    this.ctx.moveTo(x + w, y);
    this.ctx.lineTo(x + w + depth, y - depth);
    this.ctx.lineTo(x + w + depth, y + h - depth);
    this.ctx.lineTo(x + w, y + h);
    this.ctx.closePath();
    this.ctx.fill();

    // Tape strip (front face)
    this.ctx.fillStyle = COLORS.boxTape;
    const tapeW = Math.max(10, Math.min(26, w * 0.18));
    this.ctx.fillRect(x + w / 2 - tapeW / 2, y, tapeW, h);

    // Tape strip (top face)
    this.ctx.fillStyle = 'rgba(255,255,255,0.35)';
    this.ctx.beginPath();
    this.ctx.moveTo(x + w / 2 - tapeW / 2, y);
    this.ctx.lineTo(x + w / 2 - tapeW / 2 + depth, y - depth);
    this.ctx.lineTo(x + w / 2 + tapeW / 2 + depth, y - depth);
    this.ctx.lineTo(x + w / 2 + tapeW / 2, y);
    this.ctx.closePath();
    this.ctx.fill();

    // Subtle corrugation lines
    this.ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    this.ctx.lineWidth = 1;
    const lineCount = Math.max(3, Math.floor(w / 40));
    for (let i = 1; i <= lineCount; i++) {
      const lx = x + (w * i) / (lineCount + 1);
      this.ctx.beginPath();
      this.ctx.moveTo(lx, y);
      this.ctx.lineTo(lx, y + h);
      this.ctx.stroke();
    }

    // Edge Highlighting for polish
    this.ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
  }

  private drawBlockShapeV2(x: number, y: number, w: number, h: number, variant: 'full' | 'cut' | 'debris') {
    const template = this.getBoxTemplate(variant);
    const sx = w / template.frontWidth;
    const sy = h / template.frontHeight;
    const mapX = (vx: number) => x + vx * sx;
    const mapY = (vy: number) => y + (vy - template.frontY) * sy;

    // Base face
    this.ctx.fillStyle = '#EDD098';
    this.ctx.fillRect(x, y, w, h);

    // Panel lines exactly as in the design component
    for (const py of template.panelYs) {
      for (const px of template.panelXs) {
        const rx = mapX(px);
        const ry = mapY(py);
        const rw = template.panelW * sx;
        const rh = template.panelH * sy;
        const grad = this.ctx.createLinearGradient(0, ry, 0, ry + Math.max(3 * sy, 1));
        grad.addColorStop(0, '#FFFAF1');
        grad.addColorStop(1, '#FFE5B8');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(rx, ry, rw, rh);
      }
    }

    // Bottom strip
    this.ctx.fillStyle = '#E9E9E9';
    this.ctx.fillRect(
      mapX(template.outerBottomStrip.x),
      mapY(template.outerBottomStrip.y),
      template.outerBottomStrip.w * sx,
      template.outerBottomStrip.h * sy,
    );

    // Right side face
    this.ctx.fillStyle = '#CACACA';
    this.drawBoxPolygon(template.sideFace, mapX, mapY);

    // Top strip + top face
    this.ctx.fillStyle = '#E9E9E9';
    this.ctx.fillRect(
      mapX(template.outerTopStrip.x),
      mapY(template.outerTopStrip.y),
      template.outerTopStrip.w * sx,
      template.outerTopStrip.h * sy,
    );

    this.ctx.fillStyle = '#F5F5F5';
    this.drawBoxPolygon(template.topFace, mapX, mapY);

    // Thin strips with stroke
    this.ctx.fillStyle = '#E9E9E9';
    this.ctx.strokeStyle = '#D2D2D2';
    this.ctx.lineWidth = Math.max(1, Math.min(sx, sy));

    this.ctx.fillRect(
      mapX(template.innerBottomStrip.x),
      mapY(template.innerBottomStrip.y),
      template.innerBottomStrip.w * sx,
      template.innerBottomStrip.h * sy,
    );
    this.ctx.strokeRect(
      mapX(template.innerBottomStrip.x),
      mapY(template.innerBottomStrip.y),
      template.innerBottomStrip.w * sx,
      template.innerBottomStrip.h * sy,
    );

    this.ctx.fillRect(
      mapX(template.innerTopStrip.x),
      mapY(template.innerTopStrip.y),
      template.innerTopStrip.w * sx,
      template.innerTopStrip.h * sy,
    );
    this.ctx.strokeRect(
      mapX(template.innerTopStrip.x),
      mapY(template.innerTopStrip.y),
      template.innerTopStrip.w * sx,
      template.innerTopStrip.h * sy,
    );
  }

  private drawBoxPolygon(
    points: Array<{ x: number; y: number }>,
    mapX: (x: number) => number,
    mapY: (y: number) => number,
  ) {
    if (points.length === 0) return;
    this.ctx.beginPath();
    this.ctx.moveTo(mapX(points[0].x), mapY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(mapX(points[i].x), mapY(points[i].y));
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  private getStackStep() {
    if (this.boxStyle !== 'v2') {
      return GAME_CONFIG.blockHeight;
    }
    // V2 template has extra top/bottom elements outside the front face.
    // Match vertical stacking to the full visual block height to avoid overlap.
    return GAME_CONFIG.blockHeight * (70 / 64);
  }

  private getBoxTemplate(variant: 'full' | 'cut' | 'debris'): BoxTemplate {
    if (variant === 'debris') {
      return {
        frontHeight: 64,
        frontY: 19.5,
        frontWidth: 49,
        contentWidth: 65.5,
        contentHeight: 89.5,
        topFace: [
          { x: 21.6251, y: 0 },
          { x: 65.5, y: 0 },
          { x: 49, y: 13.5 },
          { x: 0.046, y: 13.5987 },
        ],
        sideFace: [
          { x: 49, y: 13.5 },
          { x: 65.5, y: 0 },
          { x: 65.5, y: 76 },
          { x: 49, y: 89.5 },
        ],
        outerTopStrip: { x: 0, y: 13.5, w: 49, h: 6 },
        outerBottomStrip: { x: 0, y: 83.5, w: 49, h: 6 },
        innerTopStrip: { x: 0.5, y: 15, w: 48, h: 3 },
        innerBottomStrip: { x: 0.5, y: 85, w: 48, h: 3 },
        panelXs: [0],
        panelYs: [20.5, 41.5, 62.5],
        panelW: 49,
        panelH: 20,
      };
    }

    if (variant === 'cut') {
      return {
        frontHeight: 64,
        frontY: 19.5,
        frontWidth: 149,
        contentWidth: 165.5,
        contentHeight: 89.5,
        topFace: [
          // Keep the same left bevel geometry as the full block so the corner
          // does not visually "jump" when a flying block becomes a cut block.
          { x: 21.5, y: 0 },
          { x: 165.5, y: 0 },
          { x: 149, y: 13.5 },
          { x: 0, y: 13.5 },
        ],
        sideFace: [
          { x: 149, y: 13.5 },
          { x: 165.5, y: 0 },
          { x: 165.5, y: 76 },
          { x: 149, y: 89.5 },
        ],
        outerTopStrip: { x: 0, y: 13.5, w: 149, h: 6 },
        outerBottomStrip: { x: 0, y: 83.5, w: 149, h: 6 },
        innerTopStrip: { x: 1.5, y: 15, w: 146, h: 3 },
        innerBottomStrip: { x: 1.5, y: 85, w: 146, h: 3 },
        panelXs: [0, 50, 100],
        panelYs: [20.5, 41.5, 62.5],
        panelW: 49,
        panelH: 20,
      };
    }

    return {
      frontHeight: 64,
      frontY: 19.5,
      frontWidth: 199,
      contentWidth: 215.5,
      contentHeight: 89.5,
      topFace: [
        { x: 21.5, y: 0 },
        { x: 215.5, y: 0 },
        { x: 199, y: 13.5 },
        { x: 0, y: 13.5 },
      ],
      sideFace: [
        { x: 199, y: 13.5 },
        { x: 215.5, y: 0 },
        { x: 215.5, y: 76 },
        { x: 199, y: 89.5 },
      ],
      outerTopStrip: { x: 0, y: 13.5, w: 199, h: 6 },
      outerBottomStrip: { x: 0, y: 83.5, w: 199, h: 6 },
      innerTopStrip: { x: 2.5, y: 15, w: 194, h: 3 },
      innerBottomStrip: { x: 2.5, y: 85, w: 194, h: 3 },
      panelXs: [0, 50, 100, 150],
      panelYs: [20.5, 41.5, 62.5],
      panelW: 49,
      panelH: 20,
    };
  }

  private drawCrescent(x: number, y: number, r: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(Math.PI / 2);

    const outerR = r;
    const innerR = r * 0.6;
    const offset = r * 0.35;

    this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, outerR, -1.15, 1.15);
    this.ctx.arc(offset, 0, innerR, 1.15, -1.15, true);
    this.ctx.closePath();
    this.ctx.fill();

    // Feathered tips: fade out to create tapering ends
    const grad = this.ctx.createRadialGradient(0, 0, innerR * 0.6, 0, 0, outerR * 1.05);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0.0)');
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(0, -outerR * 0.92, outerR * 0.7, 0, Math.PI * 2);
    this.ctx.arc(0, outerR * 0.92, outerR * 0.7, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  }

  private loop = () => {
    const now = performance.now();
    const deltaMs = Math.min(50, now - this.lastFrameTime);
    this.lastFrameTime = now;
    const delta = deltaMs / 16.6667;
    this.update(delta);
    this.draw();
    this.animationId = requestAnimationFrame(this.loop);
  };

  public cleanup() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
  }
}

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;


const NICKNAME_KEY = '05ru_tower_nickname';
const MAX_NICKNAME_ATTEMPTS = 25;

const ADJECTIVES = [
  'Быстрый', 'Смелый', 'Ловкий', 'Умный', 'Яркий', 'Тихий', 'Грозный', 'Ночной',
  'Шустрый', 'Добрый', 'Северный', 'Солнечный', 'Звёздный', 'Сильный', 'Гибкий',
  'Мудрый', 'Внимательный', 'Стальной', 'Лёгкий', 'Тёплый', 'Сияющий', 'Скрытный',
  'Отважный', 'Верный', 'Дикий', 'Скоростной', 'Спокойный', 'Искристый',
  'Гордый', 'Решительный', 'Снежный', 'Песочный', 'Небесный', 'Туманный',
  'Бархатный', 'Громкий', 'Сдержанный', 'Молниеносный', 'Храбрый', 'Честный',
  'Дальневидный', 'Острый', 'Лесной', 'Береговой', 'Горный', 'Речной',
  'Стремительный', 'Лунный', 'Рассветный', 'Сумеречный', 'Кедровый',
  'Янтарный', 'Коралловый', 'Алый', 'Серебряный', 'Золотой', 'Кристальный',
  'Штормовой', 'Ветреный', 'Пылающий', 'Игривый', 'Надёжный', 'Тихомирный',
  'Бывалый', 'Стройный', 'Гладкий', 'Лихой', 'Суровый', 'Сверкающий',
  'Пронырливый', 'Мягкий', 'Упрямый', 'Смышленый', 'Ритмичный', 'Искренний',
  'Уверенный', 'Проворный', 'Собранный', 'Свободный', 'Широкий', 'Ловчий',
  'Заряженный', 'Живой', 'Скромный', 'Молчаливый', 'Морской', 'Полевой',
  'Тропический', 'Скалистый', 'Пушистый', 'Пламенный', 'Сияющий', 'Степной',
  'Каменный', 'Солнечный', 'Непокорный', 'Седой', 'Лёдный', 'Песчаный',
  'Рассудительный', 'Вольный', 'Изумрудный', 'Лазурный', 'Мглистый',
  'Кедровый', 'Тенистый', 'Охотничий', 'Песочный', 'Куражный',
  'Железный', 'Страждущий', 'Турбулентный', 'Снежный',
];

const ANIMALS = [
  'Лис', 'Волк', 'Рысь', 'Сокол', 'Барс', 'Кит', 'Олень', 'Панда', 'Орёл',
  'Тигр', 'Дельфин', 'Медведь', 'Кролик', 'Енот', 'Сова', 'Леопард', 'Гепард',
  'Ястреб', 'Филин', 'Бобр', 'Выдра', 'Косатка', 'Лось', 'Лань', 'Журавль',
  'Кабан', 'Бизон', 'Антилопа', 'Фенек', 'Куница', 'Барсук', 'Тюлень',
  'Морж', 'Росомаха', 'Белка', 'Манул', 'Ирбис', 'Пеликан', 'Пума',
  'Кондор', 'Чайка', 'Стерх', 'Козерог', 'Муфлон', 'Ягуар', 'Оцелот',
  'Саламандра', 'Игуана', 'Лемур', 'Сурикат', 'Касатка', 'Аист',
  'Павлин', 'Фламинго', 'Скунс', 'Еж', 'Котик', 'Каракал', 'Стриж',
  'Жаворонок', 'Кулик', 'Сайгак', 'Кобра', 'Пингвин',
  'Жираф', 'Носорог', 'Горилла', 'Гепард', 'Лемминг', 'Лисица', 'Кенгуру',
  'Коала', 'Сурок', 'Суслик', 'Хорёк', 'Лягушка', 'Скат', 'Селёдка',
  'Щука', 'Окунь', 'Карась', 'Воробей', 'Синица', 'Скворец', 'Дрозд',
  'Коршун', 'Сыч', 'Глухарь', 'Тетерев', 'Перепёлка', 'Чибис',
  'Лебедь', 'Цапля', 'Иволга', 'Сокол', 'Сапсан', 'Тукан',
  'Варан', 'Черепаха', 'Ящерица', 'Крокодил', 'Бегемот',
  'Муравьед', 'Капибара', 'Омар', 'Краб', 'Мангуст',
  'Серна', 'Верблюд', 'Овцебык', 'Тапир', 'Лиса',
  'Ласка', 'Выдра', 'Цивета', 'Орангутан',
  'Шимпанзе', 'Слон', 'Пума', 'Леопард',
  'Утка', 'Фазан', 'Тритон', 'Сом',
  'Сурикат', 'Бурундук', 'Кабан', 'Антилопа', 'Какаду', 'Альбатрос',
];

const generateNickname = () => {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective} ${animal}`;
};

const isNicknameTaken = async (nickname: string) => {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('id')
    .eq('nickname', nickname)
    .limit(1);
  if (error) {
    console.error('Supabase nickname check failed', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
};

const getOrCreateNickname = async () => {
  const existing = localStorage.getItem(NICKNAME_KEY);
  if (existing) return existing;

  if (!supabase) {
    const fallback = generateNickname();
    localStorage.setItem(NICKNAME_KEY, fallback);
    return fallback;
  }

  for (let i = 0; i < MAX_NICKNAME_ATTEMPTS; i += 1) {
    const candidate = generateNickname();
    const taken = await isNicknameTaken(candidate);
    if (!taken) {
      localStorage.setItem(NICKNAME_KEY, candidate);
      return candidate;
    }
  }

  const fallback = generateNickname();
  localStorage.setItem(NICKNAME_KEY, fallback);
  return fallback;
};

const fetchLeaderboard = async (): Promise<{ entries: LeaderboardEntry[]; status: LeaderboardStatus }> => {
  if (!supabase) return { entries: [], status: 'error' };
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('id,nickname,score,created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10);

  if (error || !data) {
    console.error('Supabase leaderboard fetch failed', error);
    return { entries: [], status: 'error' };
  }

  if (data.length === 0) {
    return { entries: [], status: 'empty' };
  }

  return { entries: data as LeaderboardEntry[], status: 'ok' };
};

const submitScore = async (nickname: string, score: number) => {
  if (!supabase || score <= 0) return;
  const { data: updatedRows, error: updateError } = await supabase
    .from('leaderboard_entries')
    .update({ score })
    .eq('nickname', nickname)
    .lt('score', score)
    .select('id');

  if (updateError) {
    console.error('Supabase leaderboard update failed', updateError);
  }

  if (updatedRows && updatedRows.length > 0) return;

  const { error: insertError } = await supabase
    .from('leaderboard_entries')
    .upsert({ nickname, score }, { onConflict: 'nickname', ignoreDuplicates: true });

  if (insertError) {
    console.error('Supabase leaderboard insert failed', insertError);
  }
};

const svgPaths = {
p10a7d900: "M7.708 2.17733C7.73678 2.12507 7.77905 2.08149 7.83041 2.05114C7.88177 2.02078 7.94034 2.00477 8 2.00477C8.05966 2.00477 8.11823 2.02078 8.16959 2.05114C8.22095 2.08149 8.26323 2.12507 8.292 2.17733L10.26 5.91333C10.3069 5.99984 10.3724 6.07489 10.4518 6.13308C10.5312 6.19127 10.6224 6.23117 10.7191 6.24991C10.8157 6.26864 10.9153 6.26576 11.0106 6.24145C11.106 6.21715 11.1948 6.17203 11.2707 6.10933L14.122 3.66667C14.1767 3.62215 14.2442 3.59614 14.3146 3.5924C14.3851 3.58866 14.4549 3.60736 14.5141 3.64583C14.5732 3.6843 14.6186 3.74054 14.6438 3.80646C14.6689 3.87238 14.6725 3.94458 14.654 4.01267L12.7647 10.8433C12.7261 10.9831 12.643 11.1065 12.528 11.1948C12.413 11.2831 12.2723 11.3315 12.1273 11.3327H3.87333C3.72822 11.3317 3.58741 11.2833 3.47226 11.195C3.35712 11.1067 3.27393 10.9832 3.23533 10.8433L1.34667 4.01333C1.32817 3.94525 1.33175 3.87305 1.35689 3.80713C1.38204 3.74121 1.42745 3.68496 1.4866 3.6465C1.54575 3.60803 1.61557 3.58932 1.68603 3.59307C1.75648 3.59681 1.82393 3.62281 1.87867 3.66733L4.72933 6.11C4.8052 6.17269 4.89401 6.21781 4.98938 6.24212C5.08475 6.26642 5.18431 6.26931 5.28093 6.25057C5.37755 6.23184 5.46882 6.19194 5.54819 6.13375C5.62757 6.07555 5.69307 6.00051 5.74 5.914L7.708 2.17733Z",
p10c19f00: "M2.16667 10.2917C2.16669 9.08613 2.53239 7.90896 3.21548 6.91564C3.89856 5.92231 4.86689 5.15955 5.99258 4.7281C7.11826 4.29665 8.34834 4.21681 9.52035 4.49913C10.6924 4.78145 11.7512 5.41264 12.5569 6.30933C12.6137 6.37001 12.6823 6.41839 12.7585 6.45147C12.8347 6.48454 12.9169 6.50161 13 6.50161C13.0831 6.50161 13.1653 6.48454 13.2415 6.45147C13.3177 6.41839 13.3863 6.37001 13.4431 6.30933C14.2463 5.40681 15.3054 4.77031 16.4793 4.48457C17.6532 4.19882 18.8863 4.27737 20.0144 4.70977C21.1426 5.14217 22.1123 5.90791 22.7945 6.90506C23.4768 7.90221 23.8391 9.08349 23.8333 10.2917C23.8333 12.7725 22.2083 14.625 20.5833 16.25L14.6337 22.0057C14.4318 22.2376 14.1829 22.4238 13.9036 22.5521C13.6242 22.6803 13.3207 22.7477 13.0133 22.7496C12.7059 22.7516 12.4016 22.6881 12.1206 22.5634C11.8397 22.4387 11.5884 22.2556 11.3837 22.0263L5.41667 16.25C3.79167 14.625 2.16667 12.7833 2.16667 10.2917Z",
p11845a00: "M159 23.5L175.5 10V86L159 99.5V23.5Z",
p13824980: "M37.25 10.0001H175.5L159 23.5H10L37.25 10.0001Z",
p13e4b3c0: "M2.66667 10.6667C1.93333 10.6667 1.33333 10.0667 1.33333 9.33333V2.66667C1.33333 1.93333 1.93333 1.33333 2.66667 1.33333H9.33333C10.0667 1.33333 10.6667 1.93333 10.6667 2.66667",
p17482af0: "M2.8673 5.56673H2.1505C1.83365 5.56673 1.52979 5.44087 1.30574 5.21682C1.0817 4.99278 0.955833 4.68891 0.955833 4.37207C0.955833 4.05522 1.0817 3.75135 1.30574 3.52731C1.52979 3.30327 1.83365 3.1774 2.1505 3.1774H2.8673",
p17d743e8: "M4.77902 8.27199V9.049C4.77721 9.21273 4.73337 9.37325 4.6517 9.51517C4.57003 9.65709 4.45327 9.77564 4.31262 9.85947C4.01402 10.0806 3.77112 10.3684 3.60322 10.6999C3.43532 11.0314 3.34705 11.3974 3.34542 11.769",
p192d200: "M209 23.5L225.5 10V86L209 99.5V23.5Z",
p1c2a7b80: "M31.6251 10.0001H75.5L59 23.5L10.046 23.5987L31.6251 10.0001Z",
p1d055380: "M4.16667 4.16667C4.16658 3.87341 4.24387 3.58532 4.39074 3.33149C4.5376 3.07766 4.74884 2.86708 5.00313 2.721C5.25741 2.57492 5.54574 2.49852 5.83899 2.49952C6.13225 2.50051 6.42005 2.57887 6.67333 2.72667L16.6708 8.55833C16.9231 8.70473 17.1326 8.91479 17.2783 9.1675C17.424 9.42022 17.5008 9.70675 17.501 9.99845C17.5013 10.2901 17.425 10.5768 17.2797 10.8298C17.1345 11.0827 16.9254 11.2932 16.6733 11.44L6.67333 17.2733C6.42005 17.4211 6.13225 17.4995 5.83899 17.5005C5.54574 17.5015 5.25741 17.4251 5.00313 17.279C4.74884 17.1329 4.5376 16.9223 4.39074 16.6685C4.24387 16.4147 4.16658 16.1266 4.16667 15.8333V4.16667Z",
p20eb9d00: "M12.2241 12.979H7.77588V12.1636C10.3296 9.93213 10.9595 9.09229 10.9595 8.05225C10.9595 7.31494 10.6909 6.96338 10.0513 6.96338C9.2749 6.96338 8.93311 7.56396 9.01123 8.76514L7.84424 8.58447C7.75635 6.89502 8.50342 6.021 10.1001 6.021C11.4478 6.021 12.1802 6.66553 12.1802 7.90088C12.1802 9.16064 11.4917 10.1177 9.38721 11.9438L9.40186 12.022C9.68506 12.0024 9.96826 11.9927 10.2759 11.9927H12.2241V12.979Z",
p216f800: "M13.3333 5.33333H6.66667C5.93029 5.33333 5.33333 5.93029 5.33333 6.66667V13.3333C5.33333 14.0697 5.93029 14.6667 6.66667 14.6667H13.3333C14.0697 14.6667 14.6667 14.0697 14.6667 13.3333V6.66667C14.6667 5.93029 14.0697 5.33333 13.3333 5.33333Z",
p2491c700: "M2.95026 16.3739C3.76502 16.3739 4.42552 15.7134 4.42552 14.8987C4.42552 14.0839 3.76502 13.4234 2.95026 13.4234C2.1355 13.4234 1.475 14.0839 1.475 14.8987C1.475 15.7134 2.1355 16.3739 2.95026 16.3739Z",
p2a89eb80: "M6.69083 8.27199V9.049C6.69264 9.21273 6.73648 9.37325 6.81815 9.51517C6.89982 9.65709 7.01658 9.77564 7.15723 9.85947C7.45583 10.0806 7.69873 10.3684 7.86663 10.6999C8.03453 11.0314 8.12281 11.3974 8.12443 11.769",
p2c0cbc0: "M7 11.0833L2.91667 7L7 2.91667",
p2c9b1700: "M11.4062 12.918H10.1953V8.21094H8.59375V7.42969C10.1562 7.38086 10.3076 7.29785 10.3955 6.08203H11.4062V12.918Z",
p2cea7a00: "M10.0806 13.04C8.50342 13.04 7.65869 12.2783 7.60498 10.7451L8.8208 10.5498C8.8208 11.6289 9.23584 12.1318 10.061 12.1318C10.7544 12.1318 11.1401 11.7461 11.1401 10.9648V10.9453C11.1401 10.1348 10.7056 9.80273 10.0659 9.7832L9.4165 9.75879V8.99219L10.0415 8.97266C10.6665 8.95312 11.0327 8.61133 11.0327 7.92773V7.9082C11.0327 7.2002 10.6665 6.86328 10.0269 6.86328C9.26025 6.86328 8.87939 7.33203 8.88916 8.34277L7.73193 8.16699C7.73682 6.69238 8.53271 5.95996 10.061 5.95996C11.4575 5.95996 12.2144 6.57031 12.2144 7.7373V7.75684C12.2144 8.57715 11.8286 9.10938 11.0571 9.2998V9.39746C11.9604 9.57324 12.395 10.1494 12.395 11.0771V11.0967C12.395 12.3613 11.5845 13.04 10.0806 13.04Z",
p2f60c500: "M10.5985 2.99383C10.6381 2.92197 10.6962 2.86205 10.7668 2.82031C10.8374 2.77858 10.918 2.75656 11 2.75656C11.082 2.75656 11.1626 2.77858 11.2332 2.82031C11.3038 2.86205 11.3619 2.92197 11.4015 2.99383L14.1075 8.13083C14.172 8.24978 14.2621 8.35297 14.3712 8.43298C14.4804 8.513 14.6059 8.56786 14.7387 8.59362C14.8716 8.61938 15.0085 8.61541 15.1396 8.582C15.2707 8.54858 15.3929 8.48654 15.4972 8.40033L19.4178 5.04167C19.493 4.98045 19.5858 4.9447 19.6826 4.93955C19.7795 4.9344 19.8755 4.96013 19.9568 5.01302C20.0382 5.06591 20.1006 5.14324 20.1352 5.23388C20.1698 5.32452 20.1747 5.4238 20.1493 5.51742L17.5514 14.9096C17.4984 15.1018 17.3841 15.2714 17.226 15.3929C17.0679 15.5143 16.8745 15.5808 16.6751 15.5824H5.32583C5.12631 15.581 4.93268 15.5146 4.77436 15.3931C4.61603 15.2717 4.50165 15.1019 4.44858 14.9096L1.85167 5.51833C1.82623 5.42472 1.83115 5.32544 1.86573 5.2348C1.90031 5.14416 1.96275 5.06683 2.04408 5.01393C2.1254 4.96104 2.22141 4.93532 2.31829 4.94047C2.41516 4.94562 2.50791 4.98137 2.58317 5.04258L6.50283 8.40125C6.60715 8.48745 6.72926 8.54949 6.86039 8.58291C6.99153 8.61633 7.12843 8.6203 7.26128 8.59454C7.39413 8.56877 7.51963 8.51391 7.62877 8.4339C7.7379 8.35388 7.82797 8.2507 7.8925 8.13175L10.5985 2.99383Z",
p2fef1cf0: "M31.5 10.0001H225.5L209 23.5H10L31.5 10.0001Z",
p34d63080: "M8.6715 2.4495C8.70387 2.3907 8.75143 2.34168 8.80921 2.30753C8.86699 2.27338 8.93288 2.25537 9 2.25537C9.06712 2.25537 9.13301 2.27338 9.19079 2.30753C9.24857 2.34168 9.29613 2.3907 9.3285 2.4495L11.5425 6.6525C11.5953 6.74982 11.669 6.83425 11.7583 6.89971C11.8476 6.96518 11.9503 7.01006 12.059 7.03114C12.1676 7.05222 12.2797 7.04898 12.387 7.02163C12.4942 6.99429 12.5942 6.94353 12.6795 6.873L15.8872 4.125C15.9488 4.07492 16.0247 4.04566 16.104 4.04145C16.1832 4.03724 16.2618 4.05828 16.3283 4.10156C16.3949 4.14483 16.446 4.20811 16.4742 4.28227C16.5025 4.35643 16.5066 4.43765 16.4858 4.51425L14.3602 12.1987C14.3169 12.356 14.2234 12.4948 14.094 12.5942C13.9646 12.6935 13.8064 12.7479 13.6432 12.7493H4.3575C4.19425 12.7481 4.03583 12.6937 3.90629 12.5944C3.77676 12.495 3.68317 12.3561 3.63975 12.1987L1.515 4.515C1.49419 4.4384 1.49822 4.35718 1.52651 4.28302C1.5548 4.20886 1.60589 4.14558 1.67243 4.10231C1.73896 4.05903 1.81752 4.03799 1.89678 4.0422C1.97604 4.04641 2.05192 4.07567 2.1135 4.12575L5.3205 6.87375C5.40585 6.94428 5.50576 6.99504 5.61305 7.02238C5.72034 7.04973 5.83235 7.05297 5.94105 7.03189C6.04975 7.01082 6.15243 6.96593 6.24172 6.90046C6.33101 6.835 6.4047 6.75057 6.4575 6.65325L8.6715 2.4495Z",
p34ea2680: "M59 23.5L75.5 10V86L59 99.5V23.5Z",
p3f949880: "M8.12504 2.22375C8.15664 2.05457 8.24641 1.90177 8.37881 1.79181C8.51121 1.68185 8.67789 1.62166 8.85 1.62166C9.02211 1.62166 9.18879 1.68185 9.32119 1.79181C9.45359 1.90177 9.54336 2.05457 9.57496 2.22375L10.3501 6.32277C10.4051 6.6142 10.5467 6.88225 10.7565 7.09196C10.9662 7.30168 11.2342 7.4433 11.5257 7.49835L15.6247 8.27346C15.7939 8.30506 15.9467 8.39483 16.0566 8.52723C16.1666 8.65963 16.2268 8.82632 16.2268 8.99842C16.2268 9.17053 16.1666 9.33722 16.0566 9.46961C15.9467 9.60201 15.7939 9.69179 15.6247 9.72339L11.5257 10.4985C11.2342 10.5536 10.9662 10.6952 10.7565 10.9049C10.5467 11.1146 10.4051 11.3827 10.3501 11.6741L9.57496 15.7731C9.54336 15.9423 9.45359 16.0951 9.32119 16.205C9.18879 16.315 9.02211 16.3752 8.85 16.3752C8.67789 16.3752 8.51121 16.315 8.37881 16.205C8.24641 16.0951 8.15664 15.9423 8.12504 15.7731L7.34992 11.6741C7.29487 11.3827 7.15325 11.1146 6.94354 10.9049C6.73383 10.6952 6.46577 10.5536 6.17435 10.4985L2.07532 9.72339C1.90614 9.69179 1.75334 9.60201 1.64338 9.46961C1.53343 9.33722 1.47323 9.17053 1.47323 8.99842C1.47323 8.82632 1.53343 8.65963 1.64338 8.52723C1.75334 8.39483 1.90614 8.30506 2.07532 8.27346L6.17435 7.49835C6.46577 7.4433 6.73383 7.30168 6.94354 7.09196C7.15325 6.88225 7.29487 6.6142 7.34992 6.32277L8.12504 2.22375Z",
p54eb100: "M8.6025 5.56673H9.3193C9.63615 5.56673 9.94001 5.44087 10.1641 5.21682C10.3881 4.99278 10.514 4.68891 10.514 4.37207C10.514 4.05522 10.3881 3.75135 10.1641 3.52731C9.94001 3.30327 9.63615 3.1774 9.3193 3.1774H8.6025",
p57a9b00: "M2.8675 5.56663C2.8675 6.32706 3.16958 7.05634 3.70728 7.59405C4.24499 8.13175 4.97427 8.43383 5.7347 8.43383C6.49513 8.43383 7.22441 8.13175 7.76212 7.59405C8.29982 7.05634 8.6019 6.32706 8.6019 5.56663V2.69943C8.6019 2.57269 8.55155 2.45115 8.46194 2.36153C8.37232 2.27191 8.25077 2.22157 8.12403 2.22157H3.34537C3.21863 2.22157 3.09708 2.27191 3.00746 2.36153C2.91785 2.45115 2.8675 2.57269 2.8675 2.69943V5.56663Z",
pd0f9a00: "M17.5 10C17.5 11.4834 17.0601 12.9334 16.236 14.1668C15.4119 15.4001 14.2406 16.3614 12.8701 16.9291C11.4997 17.4968 9.99168 17.6453 8.53682 17.3559C7.08197 17.0665 5.74559 16.3522 4.6967 15.3033C3.64781 14.2544 2.9335 12.918 2.64411 11.4632C2.35472 10.0083 2.50325 8.50032 3.0709 7.12987C3.63856 5.75943 4.59985 4.58809 5.83322 3.76398C7.06659 2.93987 8.51664 2.5 10 2.5C12.1 2.5 14.1083 3.33333 15.6167 4.78333L17.5 6.66667",
}

const STORAGE_KEY = '05ru_tech_tower_best';

const gameState = ref<GameState>(GameState.START);
const leaderboardReturnState = ref<GameState>(GameState.START);
const leaderboardEntries = ref<LeaderboardEntry[]>([]);
const leaderboardStatus = ref<LeaderboardStatus>('ok');
const nickname = ref('');
const score = ref<GameScore>({
  current: 0,
  best: 0,
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const engineRef = ref<GameEngine | null>(null);

const copied = ref(false);
const onboardingStep = ref(1);
const gameOverCooldown = ref(false);
const showParticipationRules = ref(false);

const copyTimer = ref<number | null>(null);
const cooldownTimer = ref<number | null>(null);
const segmentFillRefs = ref<Array<HTMLElement | null>>([]);
const progressTrackRef = ref<HTMLElement | null>(null);

const rules = [
  '«Отпускайте» ящик, когда он окажется над башней, одним нажатием на экран.',
  'Старайтесь собирать башню ровно. Если края выйдут за границы, они будут обрезаны.',
  'Чем выше башня, тем больше баллов будет направлено на благотворительность.',
];

const participationRules = [
  'Организатор акции — магазин электроники 05.ru.',
  'Период проведения акции: с 17 февраля 2026 года по 19 марта 2026 года включительно.',
  'К участию допускаются физические лица старше 18 лет.',
  'Участник играет в «Башню доброты» и получает баллы за успешную установку блоков.',
  'Каждый балл учитывается как 1 ₽ в благотворительную копилку акции.',
  'В конце Рамадана организатор перечисляет сумму, эквивалентную сумме баллов, на благотворительные цели.',
  'Баллы не являются денежными средствами, не подлежат выводу, передаче третьим лицам и не могут использоваться для оплаты товаров.',
  'Промокоды по уровням: 10 баллов — 500 ₽, 20 баллов — 1000 ₽, 30 баллов — 1500 ₽.',
  'Все промокоды действуют до 19 марта 2026 года включительно.',
  'Скидка применяется при покупке от 25 000 ₽ и не действует на технику Apple.',
  'Организатор вправе исключать результаты, полученные с использованием ботов, автоматизации и иных недобросовестных методов участия.',
  'Организатор вправе досрочно завершить акцию и/или изменить правила, включая сроки. Актуальная редакция размещается на сайте 05.ru в разделе «Акции».',
  'Участвуя в акции, участник подтверждает согласие на обработку персональных данных в объеме, необходимом для проведения акции.',
  'Акция не является лотереей и не требует обязательной покупки.',
];

const nextReward = computed(() => {
  return PROMO_REWARDS.find((reward) => reward.score > score.value.current) || null;
});

const remainingToReward = computed(() => {
  if (!nextReward.value) {
    return 0;
  }

  return Math.max(0, nextReward.value.score - score.value.current);
});

const earnedReward = computed<PromoReward | null>(() => {
  const copy = [...PROMO_REWARDS].reverse();
  return copy.find((reward) => reward.score <= score.value.current) || null;
});

const activePromoCode = computed(() => {
  return earnedReward.value?.code || null;
});

const totalGoal = computed(() => {
  return PROMO_REWARDS[PROMO_REWARDS.length - 1]?.score || 0;
});

const overallProgress = computed(() => {
  if (!totalGoal.value) {
    return 0;
  }

  return Math.min(1, score.value.current / totalGoal.value);
});

const sortedLeaderboardEntries = computed(() => {
  return [...leaderboardEntries.value].sort((a, b) => b.score - a.score);
});

const donation = computed(() => score.value.current);

const segmentProgress = (index: number) => {
  if (!totalGoal.value || PROMO_REWARDS.length === 0) {
    return 0;
  }

  const segmentSize = totalGoal.value / PROMO_REWARDS.length;
  const segmentStart = index * segmentSize;
  const segmentEnd = segmentStart + segmentSize;

  if (score.value.current <= segmentStart) {
    return 0;
  }

  if (score.value.current >= segmentEnd) {
    return 1;
  }

  return (score.value.current - segmentStart) / segmentSize;
};

const updateSegmentFillScales = () => {
  const fallbackFillElements =
    progressTrackRef.value?.querySelectorAll<HTMLElement>('.game-page__progress-segment-fill') || [];
  const fillElements = (segmentFillRefs.value.filter(Boolean) as HTMLElement[]).length
    ? (segmentFillRefs.value.filter(Boolean) as HTMLElement[])
    : Array.from(fallbackFillElements);

  fillElements.forEach((fillElement, index) => {
    if (!fillElement) {
      return;
    }

    const segmentScale = Math.min(1, Math.max(0, segmentProgress(index)));
    fillElement.style.setProperty('--fill-scale', segmentScale.toFixed(4));
  });
};

watch(
  () => score.value.current,
  () => {
    if (!process.client) {
      return;
    }

    void nextTick(() => {
      updateSegmentFillScales();
    });
  },
  { immediate: true }
);

watch(
  () => [gameState.value, nextReward.value?.score ?? -1],
  () => {
    if (!process.client) {
      return;
    }

    void nextTick(() => {
      updateSegmentFillScales();
    });
  },
  { immediate: true }
);

const copyCode = async () => {
  if (!activePromoCode.value || typeof navigator === 'undefined') {
    return;
  }

  await navigator.clipboard.writeText(activePromoCode.value);

  copied.value = true;

  if (copyTimer.value !== null) {
    window.clearTimeout(copyTimer.value);
  }

  copyTimer.value = window.setTimeout(() => {
    copied.value = false;
  }, 2000);
};

const updateScore = (newScore: number) => {
  score.value = {
    ...score.value,
    current: newScore,
  };
};

const handleGameOver = (finalScore: number) => {
  gameState.value = GameState.GAME_OVER;

  const newBest = Math.max(score.value.best, finalScore);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(newBest));
  }

  score.value = {
    current: finalScore,
    best: newBest,
  };

  if (finalScore <= 0) {
    return;
  }

  if (nickname.value) {
    void submitScore(nickname.value, finalScore);
    return;
  }

  void getOrCreateNickname().then((created) => {
    nickname.value = created;
    void submitScore(created, finalScore);
  });
};

const openLeaderboard = async () => {
  leaderboardReturnState.value = gameState.value;
  gameState.value = GameState.LEADERBOARD;

  const { entries, status } = await fetchLeaderboard();
  leaderboardEntries.value = entries;
  leaderboardStatus.value = status;
};

const closeLeaderboard = () => {
  gameState.value = leaderboardReturnState.value;
};

const startGame = () => {
  gameState.value = GameState.PLAYING;
  engineRef.value?.start();
};

const restartGame = () => {
  gameState.value = GameState.PLAYING;
  engineRef.value?.start();
};

const handleScreenTap = () => {
  if (gameState.value === GameState.PLAYING) {
    engineRef.value?.handleInput();
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code !== 'Space') {
    return;
  }

  if (gameState.value === GameState.START) {
    startGame();
    return;
  }

  if (gameState.value === GameState.GAME_OVER) {
    restartGame();
    return;
  }

  if (gameState.value === GameState.PLAYING) {
    engineRef.value?.handleInput();
  }
};

if (process.client) {
  watch(
    gameState,
    (state) => {
      const allowScroll = state !== GameState.PLAYING;

      document.body.style.overflow = allowScroll ? 'auto' : 'hidden';
      document.body.style.touchAction = allowScroll ? 'auto' : 'none';
      document.documentElement.style.overflow = allowScroll ? 'auto' : 'hidden';
    },
    { immediate: true }
  );

  watch(
    gameState,
    (state) => {
      if (state !== GameState.START) {
        onboardingStep.value = 1;
        showParticipationRules.value = false;
      }

      if (cooldownTimer.value !== null) {
        window.clearTimeout(cooldownTimer.value);
        cooldownTimer.value = null;
      }

      if (state === GameState.GAME_OVER) {
        gameOverCooldown.value = true;
        cooldownTimer.value = window.setTimeout(() => {
          gameOverCooldown.value = false;
        }, 1200);
        return;
      }

      gameOverCooldown.value = false;
    },
    { immediate: true }
  );
}

const emitStart = () => startGame();
const emitRestart = () => restartGame();
const emitOpenLeaderboard = () => {
  void openLeaderboard();
};
const emitCloseLeaderboard = () => closeLeaderboard();

const goToOnboardingStep1 = () => {
  onboardingStep.value = 1;
};

const goToOnboardingStep2 = () => {
  onboardingStep.value = 2;
};

const openParticipationRules = () => {
  showParticipationRules.value = true;
};

const closeParticipationRules = () => {
  showParticipationRules.value = false;
};

onMounted(() => {
  if (typeof localStorage !== 'undefined') {
    const best = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    score.value = {
      ...score.value,
      best: Number.isFinite(best) ? best : 0,
    };
  }

  window.addEventListener('keydown', handleKeyDown);

  if (!nickname.value) {
    void getOrCreateNickname().then((created) => {
      nickname.value = created;
    });
  }

  if (canvasRef.value) {
    engineRef.value = new GameEngine(
      canvasRef.value,
      {
        onScoreUpdate: updateScore,
        onGameOver: handleGameOver,
      },
      {
        boxStyle: 'v2',
      }
    );
  }

  void nextTick(() => {
    updateSegmentFillScales();
  });
});

onBeforeUnmount(() => {
  if (!process.client) {
    return;
  }

  window.removeEventListener('keydown', handleKeyDown);
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  document.documentElement.style.overflow = '';

  if (copyTimer.value !== null) {
    window.clearTimeout(copyTimer.value);
  }

  if (cooldownTimer.value !== null) {
    window.clearTimeout(cooldownTimer.value);
  }

  engineRef.value?.cleanup();
});
</script>
<template>
  <div
    class="game-page"
    @pointerdown="handleScreenTap"
  >
    <canvas
      ref="canvasRef"
      class="game-page__canvas"
    />

    <div class="game-page__layers">
      <template v-if="gameState === GameState.START">
        <div
          v-if="onboardingStep === 1"
          class="game-page__overlay game-page__overlay--screen game-page__overlay--start"
        >
          <div class="game-page__panel game-page__panel--start">
            <div class="game-page__intro-head">
              <p class="game-page__intro-kicker">
                Рамадан — время заботы и добрых дел
              </p>
              <h1 class="game-page__intro-title">
                Башня доброты
              </h1>
            </div>

            <div class="game-page__intro-text">
              <p>Эта игра — ваш небольшой, но значимый вклад.</p>
              <p>Постройте ровную и высокую башню из коробок и зарабатывайте баллы.</p>
              <p>В конце месяца Рамадан все набранные баллы будут направлены на благотворительные цели.</p>
              <p>
                Будьте терпеливы, и всё обязательно
                <em>сложится</em>.
              </p>
            </div>

            <div class="game-page__actions game-page__actions--stack">
              <button
                type="button"
                class="game-page__button game-page__button--primary"
                @click="goToOnboardingStep2"
              >
                <span class="game-page__button-content game-page__button-content--lg">
                  <span class="game-page__button-icon game-page__button-icon--lg">
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                      <path
                        :d="svgPaths.p1d055380"
                        fill="white"
                        stroke="white"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.66667"
                      />
                    </svg>
                  </span>
                  Построить башню!
                </span>
              </button>

              <button
                type="button"
                class="game-page__button game-page__button--secondary"
                @click="emitOpenLeaderboard"
              >
                <span class="game-page__button-content game-page__button-content--md game-page__button-content--dark">
                  <span class="game-page__button-icon game-page__button-icon--md">
                    <svg width="18" height="18" fill="none" viewBox="0 0 18 18">
                      <path
                        :d="svgPaths.p34d63080"
                        stroke="#15252B"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                      />
                      <path
                        d="M3.75 15.75H14.25"
                        stroke="#15252B"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                      />
                    </svg>
                  </span>
                  Посмотреть рейтинг игроков
                </span>
              </button>

              <button
                type="button"
                class="game-page__button game-page__button--ghost"
                @click="openParticipationRules"
              >
                Правила участия
              </button>
            </div>
          </div>

          <div
            v-if="showParticipationRules"
            class="game-page__overlay game-page__overlay--modal"
          >
            <div class="game-page__panel game-page__panel--rules">
              <div class="game-page__rules-header">
                <h3 class="game-page__rules-title">Правила участия</h3>
                <button
                  type="button"
                  class="game-page__rules-close"
                  @click="closeParticipationRules"
                >
                  Закрыть
                </button>
              </div>

              <div class="game-page__rules-body">
                <p class="game-page__rules-subtitle">
                  <strong>Правила участия в промо-игре «Башня доброты»</strong>
                </p>
                <div class="game-page__rules-scroll">
                  <ol class="game-page__rules-list">
                    <li
                      v-for="rule in participationRules"
                      :key="rule"
                    >
                      {{ rule }}
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="game-page__overlay game-page__overlay--screen game-page__overlay--start"
        >
          <div class="game-page__panel game-page__panel--start">
            <div class="game-page__intro-head">
              <p class="game-page__step-kicker">
                Шаг 2 из 2
              </p>
              <h2 class="game-page__step-title">
                Правила и награды
              </h2>
            </div>

            <div class="game-page__info-card game-page__info-card--rules">
              <p class="game-page__info-title">Какие же правила?</p>
              <div class="game-page__rules-grid">
                <div
                  v-for="(rule, index) in rules"
                  :key="rule"
                  class="game-page__rule-item"
                >
                  <span class="game-page__rule-index">{{ index + 1 }}</span>
                  <span class="game-page__rule-text">{{ rule }}</span>
                </div>
              </div>
            </div>

            <div class="game-page__info-card game-page__info-card--rewards">
              <p class="game-page__info-title">Награды за уровни</p>
              <div class="game-page__reward-grid">
                <div
                  v-for="reward in PROMO_REWARDS"
                  :key="reward.score"
                  class="game-page__reward-row"
                >
                  <span class="game-page__reward-score">{{ reward.score }} очков</span>
                  <span class="game-page__reward-discount">Скидка {{ reward.discount }} ₽</span>
                </div>
              </div>
            </div>

            <div class="game-page__actions game-page__actions--stack game-page__actions--compact">
              <button
                type="button"
                class="game-page__button game-page__button--primary"
                @click="emitStart"
              >
                <span class="game-page__button-content game-page__button-content--lg">
                  <span class="game-page__button-icon game-page__button-icon--lg">
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                      <path
                        :d="svgPaths.p1d055380"
                        fill="white"
                        stroke="white"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.66667"
                      />
                    </svg>
                  </span>
                  Начать игру
                </span>
              </button>

              <button
                type="button"
                class="game-page__button game-page__button--secondary"
                @click="goToOnboardingStep1"
              >
                <span class="game-page__button-content game-page__button-content--md game-page__button-content--dark">
                  Назад
                </span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <div
        v-else-if="gameState === GameState.LEADERBOARD"
        class="game-page__overlay game-page__overlay--screen game-page__overlay--leaderboard"
      >
        <div class="game-page__panel game-page__panel--leaderboard">
          <div class="game-page__leaderboard-head">
            <div class="game-page__leaderboard-title-wrap">
              <div class="game-page__leaderboard-icon">
                <svg class="game-page__leaderboard-icon-svg" fill="none" viewBox="0 0 22 22">
                  <path
                    :d="svgPaths.p2f60c500"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.83333"
                  />
                  <path
                    d="M4.58333 19.25H17.4167"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.83333"
                  />
                </svg>
              </div>
              <div>
                <p class="game-page__leaderboard-kicker">Топ игроков</p>
                <h2 class="game-page__leaderboard-title">Рейтинг игроков</h2>
              </div>
            </div>

            <button
              type="button"
              class="game-page__leaderboard-back"
              @click="emitCloseLeaderboard"
            >
              <svg class="game-page__leaderboard-back-icon" fill="none" viewBox="0 0 14 14">
                <path
                  :d="svgPaths.p2c0cbc0"
                  opacity="0.5"
                  stroke="#15252B"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.16667"
                />
                <path
                  d="M11.0833 7H2.91667"
                  opacity="0.5"
                  stroke="#15252B"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.16667"
                />
              </svg>
              Назад
            </button>
          </div>

          <div
            v-if="leaderboardStatus === 'error'"
            class="game-page__leaderboard-state"
          >
            Рейтинг игроков пока недоступен
          </div>

          <div
            v-else-if="sortedLeaderboardEntries.length === 0"
            class="game-page__leaderboard-state"
          >
            Игроков в списке пока нет, но вы можете стать первым :)
          </div>

          <div v-else class="game-page__leaderboard-list">
            <div
              v-for="(entry, index) in sortedLeaderboardEntries"
              :key="`${entry.nickname}-${entry.score}-${entry.id || index}`"
              :class="[
                'game-page__leaderboard-entry',
                { 'game-page__leaderboard-entry--current': entry.nickname === nickname }
              ]"
            >
              <div class="game-page__leaderboard-entry-main">
                <div class="game-page__leaderboard-rank">{{ index + 1 }}</div>
                <div class="game-page__leaderboard-user">
                  <span class="game-page__leaderboard-name">{{ entry.nickname }}</span>
                  <span
                    v-if="entry.nickname === nickname"
                    class="game-page__leaderboard-you"
                  >
                    это вы
                  </span>
                </div>
              </div>

              <span class="game-page__leaderboard-score">{{ entry.score }}</span>
            </div>
          </div>

          <div class="game-page__leaderboard-footer">
            <div class="game-page__leaderboard-footer-row">
              <div class="game-page__leaderboard-footer-line">
                <span class="game-page__leaderboard-footer-label">Ваш ник:</span>
                <span class="game-page__leaderboard-footer-value game-page__leaderboard-footer-value--nickname">{{ nickname || '—' }}</span>
              </div>

              <div class="game-page__leaderboard-footer-line game-page__leaderboard-footer-line--record">
                <span class="game-page__leaderboard-footer-label game-page__leaderboard-footer-label--normal">Рекорд:</span>
                <span class="game-page__leaderboard-footer-value">{{ score.best }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else-if="gameState === GameState.GAME_OVER">
        <div
          v-if="score.current > 0"
          class="game-page__overlay game-page__overlay--game-over"
        >
          <div class="game-page__panel game-page__panel--game-over-rich">
            <div class="game-page__game-over-head">
              <div class="game-page__game-over-title-wrap">
                <div class="game-page__game-over-icon">
                  <svg class="game-page__game-over-icon-svg" fill="none" viewBox="0 0 26 26">
                    <path
                      :d="svgPaths.p10c19f00"
                      fill="#FF2C00"
                      stroke="#FF2C00"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.16667"
                    />
                  </svg>
                </div>

                <div>
                  <p class="game-page__game-over-kicker">Благотворительность</p>
                  <h2 class="game-page__game-over-title">Каждая игра — шаг к добру</h2>
                </div>
              </div>

              <div
                v-if="score.current >= score.best"
                class="game-page__record-badge"
              >
                <svg class="game-page__record-icon" fill="none" viewBox="0 0 11.47 14.0015">
                  <path
                    :d="svgPaths.p17d743e8"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.955833"
                  />
                  <path
                    :d="svgPaths.p2a89eb80"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.955833"
                  />
                  <path
                    :d="svgPaths.p54eb100"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.955833"
                  />
                  <path
                    d="M1.91167 11.7799H9.55753"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.955833"
                  />
                  <path
                    :d="svgPaths.p57a9b00"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.955833"
                  />
                  <path
                    :d="svgPaths.p17482af0"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="0.955833"
                  />
                </svg>

                <span class="game-page__record-badge-text">Новый рекорд</span>
              </div>
            </div>

            <div class="game-page__stats-card">
              <div class="game-page__stats-row">
                <span class="game-page__stats-label">Очки</span>
                <span class="game-page__stats-value">{{ score.current }}</span>
              </div>

              <div class="game-page__stats-row">
                <span class="game-page__stats-label">Пожертвование</span>
                <span class="game-page__stats-value game-page__stats-value--donation">{{ donation }} ₽</span>
              </div>

              <p class="game-page__stats-note">В конце Рамадана эта сумма будет направлена на благотворительность</p>
            </div>

            <div class="game-page__hint-card">
              <div class="game-page__hint-content">
                <svg class="game-page__hint-icon" fill="none" viewBox="0 0 17.7 17.9968">
                  <path
                    :d="svgPaths.p3f949880"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.475"
                  />
                  <path
                    d="M14.75 1.62342V4.57394"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.475"
                  />
                  <path
                    d="M16.2255 3.09842H13.275"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.475"
                  />
                  <path
                    :d="svgPaths.p2491c700"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.475"
                  />
                </svg>

                <div>
                  <p class="game-page__hint-title">Каждый балл — вклад в копилку добра.</p>
                  <p class="game-page__hint-text">Можно сыграть ещё раз и увеличить сумму пожертвования</p>
                </div>
              </div>
            </div>

            <div
              v-if="earnedReward"
              class="game-page__reward-card"
            >
              <div class="game-page__reward-card-head">
                <svg class="game-page__reward-card-icon" fill="none" viewBox="0 0 18 18">
                  <path
                    :d="svgPaths.p34d63080"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                  />
                  <path
                    d="M3.75 15.75H14.25"
                    stroke="#FFD466"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                  />
                </svg>

                <div>
                  <p class="game-page__reward-card-title">Ваша награда:</p>
                  <p class="game-page__reward-card-text">
                    <span>Скидка на {{ earnedReward.discount }} ₽ </span>
                    <span class="game-page__reward-card-nowrap">при покупке от 25 000 ₽</span>
                  </p>
                  <p class="game-page__reward-card-note">(не действует на технику Apple)</p>
                </div>
              </div>

              <button
                type="button"
                class="game-page__promo-button"
                @click="copyCode"
              >
                <p class="game-page__promo-label">Промокод</p>

                <div class="game-page__promo-row">
                  <span class="game-page__promo-code">{{ earnedReward.code }}</span>
                  <svg class="game-page__promo-copy-icon" fill="none" viewBox="0 0 16 16">
                    <path
                      :d="svgPaths.p216f800"
                      opacity="0.2"
                      stroke="#15252B"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.33333"
                    />
                    <path
                      :d="svgPaths.p13e4b3c0"
                      opacity="0.2"
                      stroke="#15252B"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.33333"
                    />
                  </svg>
                </div>

                <div
                  v-if="copied"
                  class="game-page__promo-copied"
                >
                  СКОПИРОВАНО!
                </div>
              </button>
            </div>

            <div
              :class="[
                'game-page__actions game-page__actions--stack',
                { 'game-page__actions--disabled': gameOverCooldown }
              ]"
            >
              <button
                type="button"
                class="game-page__button game-page__button--primary game-page__button--game-over-main"
                :disabled="gameOverCooldown"
                @click="emitRestart"
              >
                <span class="game-page__button-content game-page__button-content--md">
                  Сыграть ещё раз
                </span>
              </button>

              <button
                type="button"
                class="game-page__button game-page__button--secondary game-page__button--game-over-secondary"
                :disabled="gameOverCooldown"
                @click="emitOpenLeaderboard"
              >
                <span class="game-page__button-content game-page__button-content--md game-page__button-content--dark">
                  <svg class="game-page__button-inline-icon" fill="none" viewBox="0 0 16 16">
                    <path
                      :d="svgPaths.p10a7d900"
                      stroke="#15252B"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.33333"
                    />
                    <path
                      d="M3.33333 14H12.6667"
                      stroke="#15252B"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.33333"
                    />
                  </svg>
                  Посмотреть рейтинг игроков
                </span>
              </button>
            </div>
          </div>
        </div>

        <div
          v-else
          class="game-page__overlay game-page__overlay--game-over"
        >
          <div class="game-page__simple-wrap">
            <h2 class="game-page__simple-title">Ваша башня упала</h2>
            <p class="game-page__simple-subtitle">Но можно попробовать ещё раз</p>

            <div class="game-page__simple-score">
              <span class="game-page__simple-score-label">Высота:</span>
              <span class="game-page__simple-score-value">{{ score.current }}</span>
            </div>

            <div
              :class="[
                'game-page__actions game-page__actions--simple',
                { 'game-page__actions--disabled': gameOverCooldown }
              ]"
            >
              <button
                type="button"
                class="game-page__button game-page__button--pill-primary"
                :disabled="gameOverCooldown"
                @click="emitRestart"
              >
                <span class="game-page__button-content game-page__button-content--lg">
                  <span class="game-page__button-icon game-page__button-icon--lg">
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                      <path
                        :d="svgPaths.pd0f9a00"
                        stroke="#F2F5F6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.66667"
                      />
                      <path
                        d="M17.5 2.5V6.66667H13.3333"
                        stroke="#F2F5F6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.66667"
                      />
                    </svg>
                  </span>
                  Попробовать снова
                </span>
              </button>

              <button
                type="button"
                class="game-page__button game-page__button--pill-secondary"
                :disabled="gameOverCooldown"
                @click="emitOpenLeaderboard"
              >
                <span class="game-page__button-content game-page__button-content--md">
                  <span class="game-page__button-icon game-page__button-icon--sm">
                    <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                      <path
                        :d="svgPaths.p10a7d900"
                        stroke="#F2F5F6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.33333"
                      />
                      <path
                        d="M3.33333 14H12.6667"
                        stroke="#F2F5F6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.33333"
                      />
                    </svg>
                  </span>
                  Посмотреть рейтинг игроков
                </span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="gameState === GameState.PLAYING">
        <div class="game-page__hud">
          <div class="game-page__hud-column">
            <span class="game-page__hud-label">Этаж</span>
            <span class="game-page__hud-value">{{ score.current }}</span>
          </div>

          <div class="game-page__hud-column game-page__hud-column--right">
            <span class="game-page__hud-label">Рекорд</span>
            <span class="game-page__hud-value game-page__hud-value--accent">{{ score.best }}</span>
          </div>
        </div>

        <div class="game-page__progress">
          <div
            v-if="nextReward"
            class="game-page__progress-card"
          >
            <div
              aria-hidden="true"
              class="game-page__progress-frame"
            />

            <div class="game-page__progress-content">
              <div class="game-page__progress-row">
                <span class="game-page__progress-kicker">До награды</span>
                <span class="game-page__progress-kicker">{{ remainingToReward }} этажей</span>
              </div>

              <div class="game-page__progress-row">
                <p class="game-page__progress-title">
                  <span>Скидка </span>
                  <span class="game-page__progress-title-accent">{{ nextReward.discount }} ₽</span>
                </p>
                <span class="game-page__progress-count">{{ score.current }}/{{ nextReward.score }}</span>
              </div>

              <div
                ref="progressTrackRef"
                class="game-page__progress-track-grid"
              >
                <div
                  v-for="(reward, index) in PROMO_REWARDS"
                  :key="reward.score"
                  class="game-page__progress-segment"
                >
                  <div
                    ref="segmentFillRefs"
                    class="game-page__progress-segment-fill"
                    :class="{ 'game-page__progress-segment-fill--inactive': score.current < reward.score }"
                  />
                </div>
              </div>

              <div class="game-page__progress-row">
                <span class="game-page__progress-caption">Прогресс</span>
                <span class="game-page__progress-caption">{{ Math.round(overallProgress * 100) }}%</span>
              </div>
            </div>
          </div>

          <div
            v-else
            class="game-page__progress-pill"
          >
            <p class="game-page__progress-pill-text">Все награды получены. Продолжайте играть!</p>
          </div>
        </div>
      </template>

      <div
        v-else
        class="game-page__hud"
      >
        <div class="game-page__hud-column">
          <span class="game-page__hud-label">Этаж</span>
          <span class="game-page__hud-value">{{ score.current }}</span>
        </div>

        <div class="game-page__hud-column game-page__hud-column--right">
          <span class="game-page__hud-label">Рекорд</span>
          <span class="game-page__hud-value game-page__hud-value--accent">{{ score.best }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
@font-face {
  font-family: 'PP Right Grotesk';
  src: url('/fonts/PPRightGrotesk-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'PP Right Grotesk';
  src: url('/fonts/PPRightGrotesk-RegularItalic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: 'PP Right Grotesk';
  src: url('/fonts/PPRightGrotesk-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'PP Right Grotesk';
  src: url('/fonts/PPRightGrotesk-MediumItalic.woff2') format('woff2');
  font-weight: 500;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: 'PP Right Grotesk';
  src: url('/fonts/PPRightGrotesk-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'PP Right Grotesk';
  src: url('/fonts/PPRightGrotesk-BoldItalic.woff2') format('woff2');
  font-weight: 700;
  font-style: italic;
  font-display: swap;
}

.game-page {
  --color-bg: #15252b;
  --color-panel: #f2f5f6;
  --color-accent: #ff2c00;
  --color-gold: #ffd466;
  --color-secondary: #b4d3ff;
  --color-copy: #15252b;

  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-bg);
  user-select: none;
  font-family: 'PP Right Grotesk', system-ui, -apple-system, sans-serif;

  &__canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  &__layers {
    position: absolute;
    inset: 0;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    background: rgb(0 0 0 / 70%);
    backdrop-filter: blur(4px);
    pointer-events: auto;

    &--screen,
    &--start,
    &--leaderboard {
      z-index: 50;
    }

    &--game-over {
      z-index: 40;
    }

    &--modal {
      z-index: 60;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
  }

  &__panel {
    width: 100%;
    max-width: 448px;
    margin: auto 0;
    border-radius: 16px;
    background: var(--color-panel);
    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
    padding: 20px;

    &--leaderboard,
    &--game-over-rich {
      border-radius: 24px;
    }

    &--rules {
      margin: 0;
      border-radius: 16px;
      padding: 20px;
    }
  }

  &__intro-head {
    margin-bottom: 16px;
    text-align: center;
  }

  &__intro-kicker {
    margin: 0;
    color: var(--color-copy);
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
  }

  &__intro-title {
    margin: 8px 0 0;
    color: var(--color-accent);
    font-size: clamp(40px, 12vw, 56px);
    line-height: 0.95;
    font-weight: 500;
    letter-spacing: -0.75px;
  }

  &__intro-text {
    margin-bottom: 20px;
    color: var(--color-copy);
    text-align: center;
    font-size: 14px;
    line-height: 20px;

    p {
      margin: 0;
    }

    p + p {
      margin-top: 8px;
    }
  }

  &__step-kicker {
    margin: 0;
    color: var(--color-copy);
    font-size: 10px;
    line-height: 15px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  &__step-title {
    margin: 8px 0 0;
    color: var(--color-copy);
    font-size: 24px;
    line-height: 32px;
    font-weight: 500;
  }

  &__actions {
    display: flex;

    &--stack {
      flex-direction: column;
      gap: 12px;
    }

    &--compact {
      gap: 10px;
    }

    &--simple {
      margin-top: 24px;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    &--disabled {
      pointer-events: none;
      opacity: 0.7;
    }
  }

  &__button {
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 12px;
    background: transparent;
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease;

    &:active {
      transform: translateY(1px);
    }

    &:disabled {
      cursor: not-allowed;
    }

    &--primary {
      width: 100%;
      padding: 16px 24px;
      color: #fff;
      background: radial-gradient(408.24% 368.51% at 67.25% 87.2%, #ff0000 0%, rgb(255 92 0 / 0%) 100%), #ff5c00;
      box-shadow: 0 4px 20px rgb(255 44 0 / 40%);
    }

    &--secondary {
      width: 100%;
      padding: 13px 16px;
      border: 1px solid rgb(255 255 255 / 10%);
      background: var(--color-secondary);
      box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);
    }

    &--ghost {
      width: 100%;
      border: 0;
      background: transparent;
      color: var(--color-copy);
      font-size: 12px;
      line-height: 16px;
      text-align: center;
    }

    &--game-over-main {
      padding: 12px 24px;
    }

    &--game-over-secondary {
      padding: 12px 24px;
    }

    &--pill-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      border-radius: 9999px;
      padding: 12px 32px;
      color: #f2f5f6;
      background: radial-gradient(408.24% 368.51% at 67.25% 87.2%, #ff0000 0%, rgb(255 92 0 / 0%) 100%), #ff5c00;
      box-shadow: 0 4px 20px rgb(255 44 0 / 40%);
    }

    &--pill-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      border-radius: 9999px;
      border: 1px solid rgb(255 255 255 / 15%);
      background: rgb(255 255 255 / 5%);
      padding: 9px 24px;
      color: #f2f5f6;
    }
  }

  &__button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 500;

    &--lg {
      font-size: 18px;
      line-height: 28px;
    }

    &--md {
      font-size: 14px;
      line-height: 20px;
    }

    &--dark {
      color: var(--color-copy);
    }
  }

  &__button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--lg {
      width: 20px;
      height: 20px;
    }

    &--md {
      width: 18px;
      height: 18px;
    }

    &--sm {
      width: 16px;
      height: 16px;
    }
  }

  &__button-inline-icon {
    width: 16px;
    height: 16px;
  }

  &__rules-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }

  &__rules-title {
    margin: 0;
    color: var(--color-copy);
    font-size: 18px;
    line-height: 28px;
    font-weight: 500;
  }

  &__rules-close {
    border: 0;
    background: transparent;
    color: rgb(21 37 43 / 60%);
    font-size: 12px;
    line-height: 16px;
    cursor: pointer;
  }

  &__rules-body {
    color: rgb(21 37 43 / 70%);
    font-size: 14px;
    line-height: 20px;
  }

  &__rules-subtitle {
    margin: 0;
  }

  &__rules-scroll {
    max-height: 55vh;
    overflow-y: auto;
    margin-top: 12px;
    padding-right: 4px;
  }

  &__rules-list {
    margin: 0;
    padding-left: 4px;
    list-style-position: inside;
    list-style-type: decimal;

    li + li {
      margin-top: 8px;
    }
  }

  &__info-card {
    border-radius: 12px;
    padding: 16px;
    box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);

    &--rules {
      margin-bottom: 12px;
      background: var(--color-secondary);
    }

    &--rewards {
      margin-bottom: 12px;
      background: #fff;
    }
  }

  &__info-title {
    margin: 0 0 8px;
    color: var(--color-copy);
    font-size: 14px;
    line-height: 16px;
    font-weight: 500;
  }

  &__rules-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__rule-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  &__rule-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 9999px;
    background: #f2f5f6;
    color: var(--color-accent);
    font-size: 12px;
    line-height: 20px;
    font-weight: 700;
  }

  &__rule-text {
    color: var(--color-copy);
    font-size: 12px;
    line-height: 16px;
  }

  &__reward-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__reward-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 8px;
    background: rgb(180 211 255 / 20%);
    padding: 8px 12px;
  }

  &__reward-score {
    color: var(--color-copy);
    font-size: 12px;
    line-height: 16px;
  }

  &__reward-discount {
    color: var(--color-accent);
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
  }

  &__leaderboard-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }

  &__leaderboard-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__leaderboard-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 16px;
    background: rgb(255 212 102 / 30%);
    flex-shrink: 0;
  }

  &__leaderboard-icon-svg {
    width: 22px;
    height: 22px;
  }

  &__leaderboard-kicker {
    margin: 0;
    color: var(--color-copy);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 10px;
    line-height: 15px;
  }

  &__leaderboard-title {
    margin: 0;
    color: var(--color-copy);
    font-size: 24px;
    line-height: 32px;
    font-weight: 500;
  }

  &__leaderboard-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    border-radius: 9999px;
    border: 1px solid rgb(255 255 255 / 10%);
    background: rgb(255 255 255 / 5%);
    padding: 8px 12px;
    color: rgb(21 37 43 / 60%);
    font-size: 12px;
    line-height: 16px;
    cursor: pointer;
  }

  &__leaderboard-back-icon {
    width: 14px;
    height: 14px;
  }

  &__leaderboard-state {
    border-radius: 16px;
    background: var(--color-gold);
    padding: 24px 16px;
    color: var(--color-copy);
    text-align: center;
    font-size: 14px;
    line-height: 20px;
  }

  &__leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__leaderboard-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-radius: 16px;
    background: #f6e4b7;
    padding: 12px 16px;
    box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);

    &--current {
      background: #ffd466;
    }
  }

  &__leaderboard-entry-main {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 12px;
  }

  &__leaderboard-rank {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 9999px;
    background: #f2f5f6;
    color: var(--color-copy);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
  }

  &__leaderboard-user {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__leaderboard-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-copy);
    font-size: 16px;
    line-height: 24px;
    font-weight: 500;
  }

  &__leaderboard-you {
    flex-shrink: 0;
    white-space: nowrap;
    color: rgb(21 37 43 / 50%);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 10px;
    line-height: 15px;
  }

  &__leaderboard-score {
    margin-left: 12px;
    flex-shrink: 0;
    color: var(--color-copy);
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
  }

  &__leaderboard-footer {
    margin-top: 12px;
    border-radius: 16px;
    background: var(--color-secondary);
    padding: 12px 16px;
    box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);
  }

  &__leaderboard-footer-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__leaderboard-footer-line {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 4px;

    &--record {
      flex-shrink: 0;
    }
  }

  &__leaderboard-footer-label {
    color: var(--color-copy);
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;

    &--normal {
      font-weight: 400;
    }
  }

  &__leaderboard-footer-value {
    color: var(--color-copy);
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;

    &--nickname {
      max-width: min(42vw, 220px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }
  }

  &__game-over-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  &__game-over-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__game-over-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    background: rgb(255 44 0 / 20%);
    flex-shrink: 0;
  }

  &__game-over-icon-svg {
    width: 26px;
    height: 26px;
  }

  &__game-over-kicker {
    margin: 0;
    color: var(--color-copy);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-size: 10px;
    line-height: 15px;
  }

  &__game-over-title {
    margin: 0;
    color: var(--color-copy);
    font-size: 24px;
    line-height: 26px;
    font-weight: 500;
  }

  &__record-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    border-radius: 9999px;
    border: 1px solid var(--color-gold);
    background: rgb(255 212 102 / 20%);
    padding: 4px 12px;
  }

  &__record-icon {
    width: 12px;
    height: 14px;
  }

  &__record-badge-text {
    color: var(--color-gold);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
  }

  &__stats-card {
    margin-bottom: 16px;
    border-radius: 16px;
    background: var(--color-secondary);
    padding: 16px;
    box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);
  }

  &__stats-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  &__stats-label {
    color: var(--color-copy);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 11px;
    line-height: 16.5px;
  }

  &__stats-value {
    color: var(--color-copy);
    font-size: 30px;
    line-height: 36px;
    font-weight: 500;

    &--donation {
      color: var(--color-accent);
      font-size: 36px;
      line-height: 40px;
    }
  }

  &__stats-note {
    margin: 0;
    color: var(--color-copy);
    font-size: 12px;
    line-height: 14px;
  }

  &__hint-card {
    margin-bottom: 16px;
    border-radius: 16px;
    background: rgb(255 255 255 / 50%);
    padding: 16px;
    box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);
  }

  &__hint-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__hint-icon {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__hint-title,
  &__hint-text {
    margin: 0;
    color: var(--color-copy);
    font-size: 14px;
    line-height: 20px;
  }

  &__hint-title {
    font-weight: 500;
  }

  &__reward-card {
    margin-bottom: 16px;
    border-radius: 16px;
    background: #fff;
    padding: 16px;
    box-shadow: 2px 2px 12px rgb(0 0 0 / 5%);
  }

  &__reward-card-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__reward-card-icon {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__reward-card-title,
  &__reward-card-text {
    margin: 0;
    color: var(--color-copy);
    font-size: 14px;
    line-height: 20px;
  }

  &__reward-card-title {
    font-weight: 500;
  }

  &__reward-card-nowrap {
    white-space: nowrap;
  }

  &__reward-card-note {
    margin: 0;
    color: rgb(21 37 43 / 70%);
    font-size: 12px;
    line-height: 16px;
  }

  &__promo-button {
    position: relative;
    width: 100%;
    border-radius: 12px;
    border: 1px dashed rgb(255 255 255 / 20%);
    background: var(--color-secondary);
    padding: 12px;
    cursor: pointer;
  }

  &__promo-label {
    margin: 0;
    color: var(--color-copy);
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 10px;
    line-height: 20px;
  }

  &__promo-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
  }

  &__promo-code {
    color: var(--color-copy);
    font-family: Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 20px;
    line-height: 28px;
    letter-spacing: 2px;
    font-weight: 700;
  }

  &__promo-copy-icon {
    width: 16px;
    height: 16px;
  }

  &__promo-copied {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgb(21 37 43 / 90%);
    color: #fff;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
  }

  &__simple-wrap {
    width: 100%;
    max-width: 448px;
    margin: auto 0;
    text-align: center;
  }

  &__simple-title {
    margin: 0;
    color: var(--color-accent);
    font-size: 36px;
    line-height: 40px;
    font-weight: 500;
  }

  &__simple-subtitle {
    margin: 4px 0 0;
    color: rgb(255 255 255 / 60%);
    font-size: 16px;
    line-height: 24px;
  }

  &__simple-score {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 12px;
  }

  &__simple-score-label {
    color: rgb(255 255 255 / 60%);
    font-size: 18px;
    line-height: 28px;
  }

  &__simple-score-value {
    color: var(--color-accent);
    font-size: 48px;
    line-height: 48px;
    font-weight: 500;
  }

  &__hud {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 20;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding: 16px;
    pointer-events: none;
  }

  &__hud-column {
    display: flex;
    flex-direction: column;

    &--right {
      align-items: flex-end;
    }
  }

  &__hud-label {
    color: rgb(255 255 255 / 60%);
    text-transform: uppercase;
    font-size: 12px;
    line-height: 16px;
    font-weight: 700;
  }

  &__hud-value {
    color: #fff;
    font-size: 36px;
    line-height: 40px;
    font-weight: 500;

    &--accent {
      color: var(--color-gold);
      font-size: 24px;
      line-height: 32px;
      font-weight: 700;
    }
  }

  &__progress {
    position: absolute;
    top: 80px;
    left: 50%;
    z-index: 20;
    width: min(92vw, 560px);
    pointer-events: none;
    background: var(--color-bg);
    transform: translateX(-50%);
  }

  &__progress-card {
    position: relative;
    width: 100%;
    border-radius: 16px;
    background: var(--color-bg);
    backdrop-filter: blur(4px);
  }

  &__progress-frame {
    position: absolute;
    inset: 0;
    border: 1px solid rgb(255 255 255 / 10%);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 35%);
    pointer-events: none;
  }

  &__progress-content {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 17px 13px;
  }

  &__progress-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__progress-kicker {
    color: rgb(255 255 255 / 60%);
    text-transform: uppercase;
    font-size: 11px;
    line-height: 16.5px;
    white-space: nowrap;
  }

  &__progress-title {
    margin: 0;
    color: #fff;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    white-space: nowrap;
  }

  &__progress-title-accent {
    color: var(--color-gold);
  }

  &__progress-count {
    color: rgb(255 255 255 / 70%);
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    white-space: nowrap;
  }

  &__progress-track-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    margin-top: 4px;
  }

  &__progress-segment {
    position: relative;
    width: 100%;
    height: 8px;
    overflow: hidden;
    border-radius: 9999px;
    background: rgb(255 255 255 / 10%);
  }

  &__progress-segment-fill {
    --fill-scale: 0;

    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background: radial-gradient(
      ellipse 350px 150px at 67% 87%,
      rgb(255 0 0 / 100%) 0%,
      rgb(255 11 0 / 87.5%) 12.5%,
      rgb(255 23 0 / 75%) 25%,
      rgb(255 46 0 / 50%) 50%,
      rgb(255 92 0 / 0%) 100%
    ), linear-gradient(90deg, rgb(255 92 0 / 100%) 0%, rgb(255 92 0 / 100%) 100%);
    transform: scaleX(var(--fill-scale));
    transform-origin: left center;
    transition: transform 0.16s ease-out, background-color 0.16s ease-out;

    &--inactive {
      background: #f2f5f6;
    }
  }

  &__progress-caption {
    color: rgb(255 255 255 / 50%);
    font-size: 10px;
    line-height: 15px;
    white-space: nowrap;
  }

  &__progress-pill {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    border: 1px solid var(--color-gold);
    border-radius: 9999px;
    background: var(--color-gold);
    backdrop-filter: blur(4px);
    padding: 9px 17px;
  }

  &__progress-pill-text {
    margin: 0;
    color: var(--color-copy);
    text-align: center;
    font-size: 12px;
    line-height: 16px;
  }

  @media (min-width: 640px) {
    &__overlay {
      padding-right: 24px;
      padding-left: 24px;
    }

    &__panel {
      padding: 24px;
    }
  }

  @media (max-width: 768px) {
    &__hud {
      top: calc(env(safe-area-inset-top) + 10px);
    }

    &__progress {
      top: calc(env(safe-area-inset-top) + 90px);
    }
  }
}
</style>
