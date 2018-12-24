const express = require('express');
const app     = express();

const StaticRendererService     = require('./service/static-renderer-service');
const ApiErrorAndLoggingHelper  = require('../api/helpers/api-error-and-logging-helper');

const { ApiLoggerStream, ApiLogger }  = require('../../config/winston');

app.get('*', async (req, res) => {
  const host = req.headers.host;
  const originalUrl = req.params[0]; // fetch originalUrl without query string

  const html = await StaticRendererService.getHtml(host, originalUrl);

  return res.send(html);
});

ApiErrorAndLoggingHelper.initAllForApp(app, ApiLogger, ApiLoggerStream);

module.exports = app;