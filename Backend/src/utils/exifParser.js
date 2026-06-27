const exifr = require('exifr');
const logger = require('../config/logger');

/**
 * Extract EXIF metadata from an image buffer.
 * Returns a structured metadata object or null if extraction fails.
 */
async function extractExifData(imageBuffer) {
  try {
    const metadata = await exifr.parse(imageBuffer, {
      // Parse all available tags
      tiff: true,
      exif: true,
      gps: true,
      icc: false,
      iptc: true,
      xmp: true,
      jfif: true,
    });

    if (!metadata) {
      return { available: false, summary: 'No EXIF metadata found in image.' };
    }

    const result = {
      available: true,
      camera: metadata.Make
        ? `${metadata.Make} ${metadata.Model || ''}`.trim()
        : null,
      software: metadata.Software || null,
      dateTime: metadata.DateTimeOriginal || metadata.CreateDate || metadata.ModifyDate || null,
      dimensions: metadata.ImageWidth && metadata.ImageHeight
        ? `${metadata.ImageWidth}x${metadata.ImageHeight}`
        : null,
      gps: metadata.latitude && metadata.longitude
        ? { lat: metadata.latitude, lng: metadata.longitude }
        : null,
      colorSpace: metadata.ColorSpace || null,
      orientation: metadata.Orientation || null,
      flash: metadata.Flash || null,
      iso: metadata.ISO || null,
      exposureTime: metadata.ExposureTime || null,
      fNumber: metadata.FNumber || null,
      focalLength: metadata.FocalLength || null,
    };

    // Build human-readable summary for the AI prompt
    const parts = [];
    if (result.camera) parts.push(`Camera: ${result.camera}`);
    if (result.software) parts.push(`Software: ${result.software}`);
    if (result.dateTime) parts.push(`Date: ${result.dateTime}`);
    if (result.dimensions) parts.push(`Dimensions: ${result.dimensions}`);
    if (result.gps) parts.push(`GPS: ${result.gps.lat}, ${result.gps.lng}`);
    if (result.iso) parts.push(`ISO: ${result.iso}`);
    if (result.exposureTime) parts.push(`Exposure: ${result.exposureTime}s`);
    if (result.fNumber) parts.push(`f/${result.fNumber}`);
    if (result.focalLength) parts.push(`Focal Length: ${result.focalLength}mm`);

    result.summary = parts.length > 0
      ? parts.join('\n')
      : 'EXIF data present but contains no standard photographic metadata.';

    return result;
  } catch (error) {
    logger.warn('EXIF extraction failed:', error.message);
    return {
      available: false,
      summary: 'EXIF extraction failed — metadata may be stripped or corrupted.',
    };
  }
}

module.exports = { extractExifData };
