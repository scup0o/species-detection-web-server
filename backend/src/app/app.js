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
app.get('/', (req, res) => {
    console.log('GET / request received');
    res.status(200).json({ message: 'Hello from Express root!' });
});

app.get('/ping', (req, res) => {
    console.log('GET /ping request received');
    res.status(200).json({ message: 'pong' });
});

// API Routes (đã có /api/v1 prefix từ đây)
app.use('/api/v1', (req, res) => {
    console.log('GET / api/v1 received');
    res.status(200).json({ message: 'api/v1 received!' });
});

// Health check route (có thể để ở đây hoặc trong apiV1Routes nếu muốn có prefix /api/v1)
// Nếu để ở đây, nó sẽ là your-app.vercel.app/health
// Nếu trong apiV1Routes, nó sẽ là your-app.vercel.app/api/v1/health
app.get('/health', (req, res) => { // <<<< Đã có ở đây, tốt!
    console.log('GET /health request received');
    res.status(200).json({ status: 'UP' });
});

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