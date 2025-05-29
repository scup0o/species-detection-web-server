const express = require('express');
const path = require('path');

//const expressLoader = require('../loaders/express_loader');
const routesLoader = require('../loaders/routes_loader');
const notFoundHandler = require('../middlewares/not_found_handler');
const globalErrorHandler = require('../middlewares/error_handler');
const cors = require('cors');


const app = express();

//expressLoader(app);
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

routesLoader(app);


/*app.get('*', (req, res, next) => {
  if (!req.originalUrl.startsWith('/api/') && req.originalUrl.indexOf('.') === -1) {
    res.sendFile(path.join(__dirname, '../../public/dist/index.html'));
  } else {
    next();
  }
});*/

app.use(notFoundHandler);

//app.use(globalErrorHandler);

module.exports = app;