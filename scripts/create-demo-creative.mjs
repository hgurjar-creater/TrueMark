import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffeed5"/><stop offset="1" stop-color="#f1b5a5"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#56242d" flood-opacity=".16"/></filter></defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="915" cy="190" r="160" fill="#ff7c4d" opacity=".55"/><circle cx="152" cy="900" r="220" fill="#f4c642" opacity=".42"/>
  <rect x="92" y="90" width="896" height="900" rx="56" fill="#fffaf1" filter="url(#shadow)"/>
  <rect x="138" y="138" width="72" height="72" rx="18" fill="#e6405c"/><path d="M160 174h30M175 159v30" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
  <text x="230" y="188" font-family="Arial,sans-serif" font-size="35" font-weight="700" fill="#d62844">True Mark</text>
  <text x="140" y="370" font-family="Arial,sans-serif" font-size="28" font-weight="700" letter-spacing="7" fill="#8e5a55">YOUR TEAM DESERVES</text>
  <text x="140" y="490" font-family="Arial,sans-serif" font-size="98" font-weight="800" fill="#b84854">BRAND</text>
  <text x="140" y="600" font-family="Arial,sans-serif" font-size="98" font-weight="800" fill="#e96b45">MAGIC</text>
  <text x="144" y="685" font-family="Arial,sans-serif" font-size="31" fill="#bb8b83">Guaranteed to transform every campaign</text>
  <rect x="140" y="752" width="438" height="92" rx="46" fill="#ef6b49"/>
  <text x="192" y="810" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#fff">START YOUR JOURNEY</text>
  <text x="143" y="910" font-family="Arial,sans-serif" font-size="20" fill="#a87570">A demo creative with deliberate brand inconsistencies</text>
</svg>`)

const outputDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const outputFile = fileURLToPath(new URL('../public/demo-creative.png', import.meta.url))
await mkdir(outputDirectory, { recursive: true })
await sharp(svg).png().toFile(outputFile)
console.log('Created public/demo-creative.png')
