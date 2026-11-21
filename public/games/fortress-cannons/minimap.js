import { MAP, TEAMS } from './model.js';

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  const pad = 12;
  const x = value => pad + (value + MAP.halfSize) / (2 * MAP.halfSize) * (width - pad * 2);
  const y = value => height - pad - (value + MAP.halfSize) / (2 * MAP.halfSize) * (height - pad * 2);
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function shape(team, cx, cy, radius) {
    ctx.beginPath();
    if (team === 'red') ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
    else if (team === 'yellow') {
      ctx.moveTo(cx, cy - radius * 1.3);
      ctx.lineTo(cx + radius * 1.2, cy + radius);
      ctx.lineTo(cx - radius * 1.2, cy + radius);
      ctx.closePath();
    } else ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = TEAMS[team].color;
    ctx.fill();
    ctx.strokeStyle = '#153443';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  function render(game, bounds) {
    if (!width || !height) resize();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#eef3ef';
    ctx.beginPath();
    ctx.roundRect(pad - 3, pad - 3, width - pad * 2 + 6, height - pad * 2 + 6, 8);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#d2dcd5';
    ctx.lineWidth = 3;
    for (const fort of game.forts) {
      ctx.beginPath();
      ctx.moveTo(x(0), y(0));
      ctx.lineTo(x(fort.x), y(fort.z));
      ctx.stroke();
    }
    for (const obstacle of MAP.obstacles) {
      ctx.fillStyle = '#9cabaa';
      ctx.fillRect(x(obstacle.x - obstacle.w / 2), y(obstacle.z + obstacle.d / 2),
        obstacle.w / (MAP.halfSize * 2) * (width - pad * 2),
        obstacle.d / (MAP.halfSize * 2) * (height - pad * 2));
    }
    if (bounds) {
      ctx.strokeStyle = '#496a7d';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(x(bounds.minX), y(bounds.maxZ), x(bounds.maxX) - x(bounds.minX), y(bounds.minZ) - y(bounds.maxZ));
      ctx.setLineDash([]);
    }
    for (const cannon of game.cannons) {
      shape(cannon.owner, x(cannon.x), y(cannon.z), 3.2);
    }
    for (const fort of game.forts) {
      shape(fort.owner, x(fort.x), y(fort.z), width < 140 ? 4 : 5);
    }
    for (const actor of game.actors) {
      if (actor.id === 'player') continue;
      ctx.fillStyle = TEAMS[actor.team].color;
      ctx.beginPath();
      ctx.arc(x(actor.x), y(actor.z), 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = game.player;
    const cx = x(p.x), cy = y(p.z);
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#132e3c';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(p.yaw) * 8, cy - Math.cos(p.yaw) * 8);
    ctx.stroke();
    ctx.restore();
  }
  resize();
  return { render, resize };
}
