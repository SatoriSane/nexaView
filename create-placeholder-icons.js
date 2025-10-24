#!/usr/bin/env node

/**
 * Script para crear iconos placeholder para la PWA
 * Estos son iconos temporales. Reemplázalos con iconos profesionales.
 * 
 * Uso: node create-placeholder-icons.js
 */

const fs = require('fs');
const path = require('path');

// Crear directorio de iconos si no existe
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Función para crear un SVG simple
function createSVG(size) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Fondo con gradiente -->
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  
  <!-- Símbolo de blockchain (capas) -->
  <g stroke="rgba(255,255,255,0.9)" stroke-width="${size * 0.04}" fill="rgba(255,255,255,0.9)" stroke-linecap="round">
    <!-- Capa superior -->
    <ellipse cx="${size/2}" cy="${size * 0.35}" rx="${size * 0.3}" ry="${size * 0.075}" />
    <line x1="${size * 0.2}" y1="${size * 0.35}" x2="${size * 0.2}" y2="${size * 0.5}" />
    <line x1="${size * 0.8}" y1="${size * 0.35}" x2="${size * 0.8}" y2="${size * 0.5}" />
    
    <!-- Capa media -->
    <ellipse cx="${size/2}" cy="${size * 0.5}" rx="${size * 0.3}" ry="${size * 0.075}" />
    <line x1="${size * 0.2}" y1="${size * 0.5}" x2="${size * 0.2}" y2="${size * 0.65}" />
    <line x1="${size * 0.8}" y1="${size * 0.5}" x2="${size * 0.8}" y2="${size * 0.65}" />
    
    <!-- Capa inferior -->
    <ellipse cx="${size/2}" cy="${size * 0.65}" rx="${size * 0.3}" ry="${size * 0.075}" />
    <path d="M ${size * 0.2} ${size * 0.65} A ${size * 0.3} ${size * 0.075} 0 0 0 ${size * 0.8} ${size * 0.65}" fill="none"/>
  </g>
  
  <!-- Texto "NB" -->
  <text x="${size/2}" y="${size * 0.55}" 
        font-family="Arial, sans-serif" 
        font-size="${size * 0.25}" 
        font-weight="bold" 
        fill="rgba(255,255,255,0.95)" 
        text-anchor="middle" 
        dominant-baseline="middle">NB</text>
</svg>`;
}

// Crear iconos SVG
const sizes = [128, 512];

sizes.forEach(size => {
    const svgContent = createSVG(size);
    const filename = path.join(iconsDir, `icon-${size}x${size}.svg`);
    fs.writeFileSync(filename, svgContent);
    console.log(`✅ Creado: ${filename}`);
});

console.log('\n📝 Nota: Estos son iconos SVG temporales.');
console.log('Para generar PNG, puedes:');
console.log('1. Abrir generate-icons.html en tu navegador');
console.log('2. Usar un conversor online como https://cloudconvert.com/svg-to-png');
console.log('3. Usar ImageMagick: convert icon-128x128.svg icon-128x128.png\n');
