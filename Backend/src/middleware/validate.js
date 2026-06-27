/**
 * Validation middleware for request bodies
 */

function validateSignup(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required');
  }
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('Valid email is required');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join('. ') });
  }
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  }
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join('. ') });
  }
  next();
}

function validateAnalyze(req, res, next) {
  const { type } = req.body;

  if (!type || !['text', 'url', 'image'].includes(type)) {
    return res.status(400).json({ message: 'Invalid analysis type. Must be text, url, or image.' });
  }

  if (type === 'text') {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: 'Text content is required for text analysis.' });
    }
    if (content.length > 10000) {
      return res.status(400).json({ message: 'Text content must be under 10,000 characters.' });
    }
  }

  if (type === 'url') {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'URL is required for URL analysis.' });
    }
    try {
      new URL(content);
    } catch {
      return res.status(400).json({ message: 'Invalid URL format.' });
    }
  }

  if (type === 'image') {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required for image analysis.' });
    }
  }

  next();
}

module.exports = { validateSignup, validateLogin, validateAnalyze };
