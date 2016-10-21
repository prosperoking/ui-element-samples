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

// If there is a hash in the requests file name,
// put it into the request object and rename the
// request url to the vanilla file name.
function handleHashesInNames (req, res, next) {
  if (hashRegexp.test(req.url)) {
    var [_, __, hash, ext] = hashRegexp.exec(req.url);
  }
  Object.assign(req, {hash, ext});
  req.url = req.url.replace(`.${hash}.${ext}`, `.${ext}`);
  next();
}

// Read the file’s contents into `res.body`
function readFile (req, res, next) {
  let body = Promise.resolve(res.body);
  if (!res.body) {
    body = fs.readFile(`app${req.url}`)
      .then(buffer => res.body = buffer.toString('utf-8'));
  }
  body.then(_ => next());
}

// Execute handlebars on res.body
function executeHandlebars (req, res, next) {
  if (['.html', '.css', '.js', '/'].map(ext => req.url.endsWith(ext)).indexOf(true) !== -1) {
    res.body = handlebars.compile(res.body)({req});
  }
  next();
}

// Set an etag by hashing res.body. Set Cache-Control
// depending on whether there was a hash in the request
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
  readFile,
  handleHashesInNames,
  executeHandlebars,
  setETag
};
