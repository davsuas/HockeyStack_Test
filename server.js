const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const http = require('http');
const moment = require('moment');

const {
  PORT,
  NODE_ENV
} = process.env;
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';

// server setup
const app = express();
const server = http.Server(app);
app.set('trust proxy', 1);

app.locals.moment = moment;
app.locals.version = process.env.version;
app.locals.NODE_ENV = NODE_ENV;

app.use(bodyParser.urlencoded({ limit: REQUEST_BODY_LIMIT, extended: false }));
app.use((req, res, next) => express.json({ limit: REQUEST_BODY_LIMIT, strict: true })(req, res, next));
app.use(bodyParser.text({ limit: REQUEST_BODY_LIMIT }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (NODE_ENV === 'production' && req.get('x-forwarded-proto') !== 'https') {
    return res.status(403).send('HTTPS is required');
  }

  return next();
});

// listen to connections
server.listen(PORT);
