const speciesRoutes = require('../api/v1/species/species_route');

module.exports = (app) => {
  app.use('/api/v1/species', speciesRoutes);

  console.log('API routes loaded.');
  //return app;
};


/*const userRouter = require('../../app/routes/user.route'); // Điều chỉnh đường dẫn
const doctypeRouter = require('../../app/routes/doctype.route');
const projectRouter = require('../../app/routes/project.route');
const fileRouter = require('../../app/routes/file.route');
const eventRouter = require('../../app/routes/event.route');
const settingiRouter = require('../../app/routes/settingi.route');
// ... import các router khác

module.exports = (app) => {
  app.use('/api/user', userRouter);
  app.use('/api/doctype', doctypeRouter);
  app.use('/api/project', projectRouter);
  app.use('/api/file', fileRouter);
  app.use('/api/event', eventRouter);
  app.use('/api/settingi', settingiRouter);
  // ... app.use cho các router khác

  console.log('API routes loaded.');
  return app;
};*/