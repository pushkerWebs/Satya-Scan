const Check = require('../models/Check');
const PDFDocument = require('pdfkit');
const logger = require('../config/logger');

/**
 * GET /api/report/:id
 * Public report — no auth required.
 * ?format=pdf returns a PDF download.
 */
async function getReport(req, res, next) {
  try {
    const check = await Check.findById(req.params.id).lean();

    if (!check) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // PDF format
    if (req.query.format === 'pdf') {
      return generatePdf(check, res);
    }

    // JSON format (default)
    res.json(check);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Report not found' });
    }
    next(error);
  }
}

/**
 * Generate a PDF report for a check.
 */
function generatePdf(check, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=satyascan-report-${check._id}.pdf`);

  doc.pipe(res);

  // ─── Header ──────────────────────────────────────────────────────────
  doc.fontSize(24).fillColor('#14B8A6').text('SatyaScan', { continued: true });
  doc.fillColor('#333333').text(' Verification Report');
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#888888')
    .text(`Report ID: ${check._id}`);
  doc.text(`Generated: ${new Date().toLocaleString()}`);
  doc.text(`Analysis Date: ${new Date(check.createdAt).toLocaleString()}`);
  doc.moveDown();

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#DDDDDD');
  doc.moveDown();

  // ─── Input Info ──────────────────────────────────────────────────────
  doc.fontSize(14).fillColor('#333333').text('Analysis Details');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555555');
  doc.text(`Input Type: ${(check.inputType || '').toUpperCase()}`);
  if (check.detectedLanguage) doc.text(`Language: ${check.detectedLanguage.toUpperCase()}`);
  doc.moveDown(0.5);

  // ─── Scores ──────────────────────────────────────────────────────────
  if (check.inputType !== 'image') {
    doc.fontSize(14).fillColor('#333333').text('Scores');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#555555');
    doc.text(`Trust Score: ${check.trustScore ?? 'N/A'}/100`);
    doc.text(`AI Score: ${check.aiScore ?? 'N/A'}/100`);
    doc.text(`Source Credibility: ${check.sourceScore ?? 'N/A'}/100`);
    doc.moveDown();
  } else {
    doc.fontSize(14).fillColor('#333333').text('Image Analysis');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#555555');
    doc.text(`Verdict: ${check.imageVerdict || 'N/A'}`);
    doc.text(`Confidence: ${check.imageConfidence ?? 'N/A'}%`);
    doc.text(`AI Probability: ${check.aiProbability ?? 'N/A'}%`);
    doc.text(`Deepfake Probability: ${check.deepfakeProbability ?? 'N/A'}%`);
    doc.text(`Manipulation Probability: ${check.manipulationProbability ?? 'N/A'}%`);
    doc.text(`Metadata Integrity: ${check.metadataIntegrity || 'N/A'}`);
    doc.moveDown();

    if (check.findings?.length > 0) {
      doc.fontSize(12).fillColor('#333333').text('Findings');
      doc.moveDown(0.3);
      check.findings.forEach((f) => {
        doc.fontSize(10).fillColor('#555555').text(`• ${f}`);
      });
      doc.moveDown();
    }

    if (check.imageSummary) {
      doc.fontSize(12).fillColor('#333333').text('Summary');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#555555').text(check.imageSummary);
    }
  }

  // ─── Original Content ────────────────────────────────────────────────
  if (check.originalText && check.inputType !== 'image') {
    doc.fontSize(14).fillColor('#333333').text('Original Content');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#555555')
      .text(check.originalText.slice(0, 2000), { width: 495 });
    doc.moveDown();
  }

  // ─── Claims ──────────────────────────────────────────────────────────
  if (check.claims?.length > 0) {
    doc.fontSize(14).fillColor('#333333').text('Claims Analysis');
    doc.moveDown(0.3);

    check.claims.forEach((claim, i) => {
      // Check if we need a new page
      if (doc.y > 700) doc.addPage();

      const verdictColor = claim.verdict === 'Supported' || claim.verdict === 'True'
        ? '#14B8A6'
        : claim.verdict === 'Contradicted' || claim.verdict === 'False'
        ? '#EF4444'
        : '#F59E0B';

      doc.fontSize(11).fillColor('#333333')
        .text(`Claim ${i + 1}: `, { continued: true });
      doc.fillColor(verdictColor).text(`[${claim.verdict}]`);
      doc.fontSize(9).fillColor('#555555')
        .text(`"${claim.text?.slice(0, 300)}"`, { width: 495 });

      if (claim.confidence) {
        doc.text(`Confidence: ${claim.confidence}%`);
      }
      if (claim.reasoning) {
        doc.text(`Reasoning: ${claim.reasoning.slice(0, 300)}`);
      }

      if (claim.sources?.length > 0) {
        doc.text('Sources:');
        claim.sources.slice(0, 3).forEach((src) => {
          const srcText = src.url || src;
          doc.fillColor('#14B8A6').text(`  → ${typeof srcText === 'string' ? srcText : JSON.stringify(srcText)}`, { width: 485 });
        });
        doc.fillColor('#555555');
      }

      doc.moveDown(0.5);
    });
  }

  // ─── Footer ──────────────────────────────────────────────────────────
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#DDDDDD');
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#AAAAAA')
    .text('Generated by SatyaScan AI — Digital Truth Verification Platform', { align: 'center' });
  doc.text('This report is for informational purposes only.', { align: 'center' });

  doc.end();
}

module.exports = { getReport };
