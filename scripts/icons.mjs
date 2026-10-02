// Exports public/icon.svg to the PNG sizes the manifest and iOS need. Run: npm i --no-save sharp && node scripts/icons.mjs
import sharp from 'sharp'

for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  await sharp('public/icon.svg', { density: 300 }).resize(size, size).png().toFile(`public/${name}.png`)
}
