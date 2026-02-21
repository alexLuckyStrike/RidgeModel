const PDFDocument = require('pdfkit')
const fs = require('fs')

/**
 * Build a PDF with plan text and optional charts.
 * Supports multi-athlete payload: { athletes: [{ title, subtitle, planText, chartPngDataUrls }]}.
 * Falls back to single payload shape for backward compatibility.
 * @param {Object} payload
 * @param {Array<Object>} [payload.athletes]
 * @param {string} [payload.title]
 * @param {string} [payload.subtitle]
 * @param {string} [payload.planText]
 * @param {string[]} [payload.chartPngDataUrls]
 * @returns {Promise<Buffer>}
 */
function createPdf(payload) {
  const athletes = Array.isArray(payload?.athletes)
    ? payload.athletes
    : [payload]
  const safeAthletes = athletes.filter(Boolean)
  if (!safeAthletes.length) safeAthletes.push({ title: 'Training Plan', planText: 'Нет данных' })
  const fontPath = pickReadableFont()

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('error', reject)
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    safeAthletes.forEach((athlete, athleteIndex) => {
      const {
        title = 'Training Plan',
        subtitle = '',
        planText = '',
        chartPngDataUrls = [],
      } = athlete

      const charts = Array.isArray(chartPngDataUrls)
        ? chartPngDataUrls
        : chartPngDataUrls && typeof chartPngDataUrls === 'object'
          ? Object.values(chartPngDataUrls)
          : []

      if (athleteIndex > 0) doc.addPage()

      if (fontPath) doc.font(fontPath)
      doc.fontSize(20).text(title, { align: 'left', continued: false })
      if (subtitle) {
        doc.moveDown(0.3)
        if (fontPath) doc.font(fontPath)
        doc.fontSize(12).fillColor('#444').text(subtitle)
        doc.fillColor('black')
      }

      doc.moveDown()

      if (planText) {
        if (fontPath) doc.font(fontPath)
        doc.fontSize(11).text(planText, { align: 'left', lineGap: 2 })
        doc.moveDown()
      }

      charts
        .filter((url) => typeof url === 'string' && url.startsWith('data:image'))
        .forEach((url, index) => {
          try {
            const base64 = url.split(',')[1]
            if (!base64) return
            const img = Buffer.from(base64, 'base64')
            doc.addPage()
            if (fontPath) doc.font(fontPath)
            doc.fontSize(12).text(`График ${index + 1}`, { align: 'left' })
            doc.moveDown(0.5)
            doc.image(img, { fit: [500, 500], align: 'center', valign: 'top' })
          } catch (err) {
            doc.addPage()
            if (fontPath) doc.font(fontPath)
            doc.fontSize(12).fillColor('red').text(`Не удалось вставить график ${index + 1}`)
            doc.fillColor('black')
          }
        })
    })

    doc.end()
  })
}

function pickReadableFont() {
  const candidates = [
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
  ]
  return candidates.find((fontFile) => fs.existsSync(fontFile)) || null
}

module.exports = { createPdf }
