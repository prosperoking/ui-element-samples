#!/usr/bin/env node

/**
 *
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const express = require('express');
const fs = require('mz/fs');
const handlebars = require('handlebars');
const crypto = require('crypto');

// Handlebars `if` only checks for truthy and falsy values,
// so we have to write our own helper to check for equality (or inequality).
handlebars.registerHelper('ifNotEq', function (a, b, opts) {
  if (a !== b) {
    return opts.fn(this);
  }
});

handlebars.registerHelper('addHash', function (path) {
  const content = fs.readFileSync(`app${path}`).toString('utf-8');
  const hash = calculateHash(content);
  return path.replace(/\.([^.]+)$/, `.${hash}\.$1`);
});

function calculateHash (content) {
  return crypto
            .createHash('sha256')
            .update(content)
            .digest('hex');
}

const app = express();
// Matches paths like `/`, `/index.html`, `/about/` or `/about/index.html`.
const toplevelSection = /([^/]*)(\/|\/index.html)$/;
app.get(toplevelSection, (req, res) => {
  // Extract the menu item name from the path and attach it to
  // the request to have it available for template rendering.
  req.item = req.params[0];

  // If the request has `?partial`, don't render header and footer.
  let files;
  if ('partial' in req.query) {
    files = [fs.readFile(`app/${req.item}/index.html`)];
  } else {
    files = [
      fs.readFile('app/header.partial.html'),
      fs.readFile(`app/${req.item}/index.html`),
      fs.readFile('app/footer.partial.html')
    ];
  }

  Promise.all(files)
  .then(files => files.map(f => f.toString('utf-8')))
  .then(files => files.map(f => handlebars.compile(f)(req)))
  .then(files => {
    const content = files.join('');

    res.set({
      'ETag': calculateHash(content),
      'Cache-Control': 'public, no-cache'
    });
    res.send(content);
  })
  .catch(error => res.status(500).send(error.toString()));
});

app.get(/(\.([a-f0-9]+))?\.([^.]+)$/, (req, res) => {
  const hash = req.params[1];
  const ext = req.params[2];
  const hasHashInRequest = typeof hash === 'string' && hash !== '';

  req.url = req.url.replace(`.${hash}.${ext}`, `.${ext}`);
  fs.readFile(`app${req.url}`)
    .then(file => file.toString('utf-8'))
    .then(content => handlebars.compile(content)(req))
    .then(content => {
      const etag = calculateHash(content);
      if (!hasHashInRequest) {
        res.set({
          'ETag': etag,
          'Cache-Control': `public, no-cache`
        });
        return res.send(content);
      }
      if (hasHashInRequest && hash !== etag) {
        return res.status(404);
      }
      if (hasHashInRequest && hash === etag) {
        res.set({
          'ETag': etag,
          'Cache-Control': `public, max-age=${10*365*24*60*60}`
        });
        return res.send(content);
      }
    })
    .catch(error => res.status(500).send(error.toString()));
});

// Self-signed certificate generated by `simplehttp2server`
// @see https://github.com/GoogleChrome/simplehttp2server
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};
// It says spdy, but it's actually HTTP/2 :)
require('spdy').createServer(options, app).listen(8081);
