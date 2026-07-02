const Datastore = require('@seald-io/nedb');
const path = require('path');

const db = new Datastore({
  filename: path.join(__dirname, 'images.db'),
  autoload: true
});

db.ensureIndex({ fieldName: 'createdAt' });

module.exports = db;
