'use strict';

const crypto = require('crypto');
const fs = require('mz/fs');
const handlebars = require('handlebars');
const TEN_YEARS = 10 * 365 * 24 * 60 * 60;

function calculateHash (content) {
  return crypto
            .createHash('sha256')
            .update(content)
            .digest('hex');
}

const hashRegexp = /(\.([a-f0-9]+))?\.([^.]+)$/;

function handleHashesInNames (req, res, next) {
  if (hashRegexp.test(req.url)) {
    var [_, __, hash, ext] = hashRegexp.exec(req.url);
  }
  Object.assign(req, {hash, ext});
  req.url = req.url.replace(`.${hash}.${ext}`, `.${ext}`);
  let body = Promise.resolve(res.body);
  if (!res.body) {
    body = fs.readFile(`app${req.url}`)
      .then(buffer => res.body = buffer.toString('utf-8'));
  }
  body.then(_ => next());
}

function executeHandlebars (req, res, next) {
  if (['.html', '.css', '.js', '/'].map(ext => req.url.endsWith(ext)).indexOf(true) !== -1) {
    res.body = handlebars.compile(res.body)(req);
  }
  next();
}

function setETag (req, res, next) {
  const etag = calculateHash(res.body);
  const hasHashInRequest = typeof req.hash === 'string' && req.hash !== '';
  res.set({
    'ETag': etag,
    'Cache-Control': `public, must-revalidate, max-age=${hasHashInRequest ? TEN_YEARS : 0}`
  });
  if (hasHashInRequest && etag !== req.hash) {
    return res.status(404).send();
  }
  next();
}

module.exports = {
  calculateHash,
  handleHashesInNames,
  executeHandlebars,
  setETag
};
