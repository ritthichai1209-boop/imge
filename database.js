const Datastore = require('@seald-io/nedb');
const path = require('path');

const dataDir = process.env.DATA_DIR || __dirname;

const db = new Datastore({
  filename: path.join(dataDir, 'images.db'),
  autoload: true
});

db.ensureIndex({ fieldName: 'createdAt' });

module.exports = db;
