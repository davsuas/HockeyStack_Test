const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const http = require('http');
const moment = require('moment');

const {
  PORT,
  NODE_ENV
} = process.env;
const isValidBodyLimit = value => /^\d+\s*(b|kb|mb)$/i.test(value);
const configuredBodyLimit = (process.env.REQUEST_BODY_LIMIT || '').trim();
const REQUEST_BODY_LIMIT = isValidBodyLimit(configuredBodyLimit) ? configuredBodyLimit : '1mb';
const jsonParser = express.json({ limit: REQUEST_BODY_LIMIT, strict: true });

// server setup
const app = express();
const server = http.Server(app);
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  if (NODE_ENV === 'production' && !isSecure) {
    return res.status(403).send('HTTPS is required');
  }

  return next();
});

app.locals.moment = moment;
app.locals.version = process.env.version;
app.locals.NODE_ENV = NODE_ENV;

app.use(bodyParser.urlencoded({ limit: REQUEST_BODY_LIMIT, extended: false }));
app.use(jsonParser);
app.use(bodyParser.text({ limit: REQUEST_BODY_LIMIT }));
app.use(cookieParser());

// listen to connections
server.listen(PORT);
