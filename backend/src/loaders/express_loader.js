/*const express = require('express');
const cors = require('cors');

const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser'); // Hoặc dùng express.json(), express.urlencoded()
const path = require('path');
const serveStatic = require('serve-static');

const config = require('../config'); // Tải cấu hình chung
const corsOptions = require('../config/cors.options'); // Tải cấu hình CORS

module.exports = (app) => {
  app.use(cors(corsOptions));
  app.use(cookieParser());
  app.use(express.json({ limit: config.bodyParserLimit })); // Thay thế bodyParser.json
  app.use(express.urlencoded({ limit: config.bodyParserLimit, extended: true })); // Thay thế bodyParser.urlencoded
  app.use(fileUpload());

  // Cấu hình view engine (nếu bạn thực sự dùng EJS cho một phần nào đó)
  // Nếu không, bạn có thể bỏ qua phần này
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../../views')); // Giả sử có thư mục views ở root

  // Phục vụ file tĩnh từ thư mục 'assets' ở root
  app.use('/assets', express.static(path.join(__dirname, '../../assets')));

  // Phục vụ file tĩnh từ 'public/dist' (cho SPA)
  // serveStatic mạnh hơn express.static ở một số trường hợp, nhưng express.static thường đủ
  app.use(serveStatic(path.join(__dirname, '../../public/dist')));

  console.log('Express middleware configured.');
  return app;
};*/