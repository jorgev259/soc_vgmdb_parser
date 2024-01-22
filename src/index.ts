import axios from 'axios'
import { load, CheerioAPI, Element, text } from 'cheerio'

import { type Album, type Disc } from './types.js'

const artistFields = [
  'artist',
  'composer',
  'lyric',
  'arranger',
  'vocal',
  'performer'
]

function traverse(childrenList, result: Set<string>) {
  if (childrenList.length === 0) return result

  childrenList.forEach(c => {
    if (c.type === 'text') {
      const parent = c.parent
      if (!parent.attribs?.style?.includes('display:none')) {
        const text = c.data.trim()
        if (text.length > 1) result.add(text.replaceAll(',', '').trim())
      }
    } else traverse(c.children, result)
  })

  return result
}

function getTableInfo($: CheerioAPI) {
  const table = $('#album_infobit_large')[0]
  if (!table) return {}

  const { children: tableChildren } = <{ children: Element[] }>table
  const tableBody = tableChildren.find(c => c.name === 'tbody')
  if (!tableBody) return {}

  const rows = tableBody.children.filter(
    c => c.type === 'tag' && c.name === 'tr'
  )
  const result = {}

  rows.forEach(row => {
    const { children } = <{ children: Element[] }>row
    const [labelEl, valueEl] = children.filter(c => c.name === 'td')

    if (!labelEl) return

    result[text(labelEl.children)] = valueEl ? text(valueEl.children) : ''
  })

  return result
}

function getTitle(element) {
  try {
    const titleElement = element[0]
    const title = text(titleElement.children)
    return title
  } catch (err) {
    console.error(err)
    return null
  }
}

function getTracklist($) {
  const tracklist: Disc[] = []

  try {
    const discs = $('#tracklist table')
    discs.each((i, d) => {
      const parent = <Element>d?.parent
      if (!parent || parent.attribs.style?.includes('display: none')) return

      let list = ''
      const tbody = <Element>d.childNodes.find(n => n.type === 'tag')
      if (!tbody) return

      const trows = <Element[]>(
        tbody.childNodes.filter(n => n.type === 'tag' && n.name === 'tr')
      )

      trows.forEach((tRow, i2) => {
        if (i2 > 0) list = `${list}\n`
        const tds = tRow.childNodes.filter(
          n => n.type === 'tag' && n.name === 'td'
        )
        // @ts-ignore
        const td = tds[1].childNodes[0].data.trim()

        list = `${list}${td}`
      })
      tracklist.push({ number: i, body: list })
    })

    return tracklist
  } catch (err) {
    console.error(err)
  }

  return tracklist
}

function getArtists($) {
  const artists = new Set<string>()

  try {
    $('.maincred .artistname[style*="display:inline"]').each((_, labelEl) => {
      const labelText = (text(labelEl.children) ?? '').toLowerCase().trim()
      if (!artistFields.includes(labelText)) return

      let parentEl = <Element>labelEl.parent
      while (parentEl && !parentEl.attribs?.class?.includes('maincred')) {
        parentEl = <Element>parentEl.parent
      }
      if (!parentEl) return

      const dataEl = parentEl.children[1]
      // @ts-ignore
      traverse(dataEl.children, artists)
    })
  } catch (err) {
    console.error(err)
  }

  return Array.from(artists)
}

function getCategories($) {
  const result: string[] = []

  try {
    const labels = $('#rightcolumn .label')
    labels.each((_, l) => {
      const labelText = text(l.children).toLowerCase().trim()
      if (labelText === 'category') {
        const resultText = text(
          l.parent.children.filter(c => c.type === 'text')
        ).trim()
        result.push(resultText)

        return false
      }
    })
  } catch (err) {
    console.error(err)
  }

  return result
}

const monthLabels = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sept',
  'oct',
  'nov',
  'dec'
]

function formatDigits(value: string | number, digits: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumIntegerDigits: digits,
    useGrouping: false
  })
}

function getReleaseDate(releaseDateString) {
  try {
    if (!releaseDateString) return null

    const [monthString, day, year] = releaseDateString
      .split(/[, ]/g)
      .filter(c => c.length > 1)

    if (!monthString || !day || !year) return null

    const monthIndex = monthLabels.findIndex(m =>
      monthString.toLowerCase().includes(m)
    )
    if (monthIndex === -1) return null

    const month = formatDigits(monthIndex + 1, 2)
    return `${formatDigits(year, 4)}-${month}-${formatDigits(day, 2)}`
  } catch (err) {
    return null
  }
}

export default async function getVGMDB(url: string) {
  const { data } = await axios.get(url, {
    headers: { 'Content-Type': 'text/html' }
  })
  const $ = load(data)

  const title = getTitle(
    $('#innermain > h1:has(.albumtitle) span[style*="display:inline"]')
  )
  const subTitle = getTitle(
    $('#innermain > div:has(.albumtitle) span[style*="display:inline"]')
  )

  const tableInfo = <{ [key: string]: string }>getTableInfo($)
  const {
    'Release Date': releaseDateString,
    Classification: classString = ''
  } = tableInfo

  const releaseDate = getReleaseDate(releaseDateString)
  const tracklist = getTracklist($)
  const artists = getArtists($)
  const categories = getCategories($)
  const classifications = classString.split(/[,/]/).map(c => c.trim()) ?? []
  const coverUrl =
    $('#coverart')[0]
      .attribs.style.replace("background-image: url('", '')
      .replaceAll(/[('"())]/g, '') ?? null

  const album: Album = {
    title,
    subTitle,
    releaseDate,
    tracklist,
    artists,
    categories,
    classifications,
    coverUrl
  }

  return album
}
