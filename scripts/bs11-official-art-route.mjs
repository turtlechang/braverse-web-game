import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const candidate = JSON.parse(readFileSync(resolve(root, 'data/cards/official-dark-enchantress-war-bs11.en.json'), 'utf8'))
const localArtByUrl = new Map(candidate.cards.map((card) => [
  card.imageUrl,
  resolve(root, 'test-results/bs11-official-art', `${card.cardNumber.replace('@', '-at-')}.webp`),
]))

export const routeBs11OfficialArt = async (page) => {
  await page.route('https://cookierunbraverse.com/data/en_storage/**', (route) => {
    const imagePath = localArtByUrl.get(route.request().url())
    if (!imagePath) return route.continue()
    if (!existsSync(imagePath)) throw new Error(`Missing local BS11 art: ${imagePath}`)
    return route.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(imagePath) })
  })
}
