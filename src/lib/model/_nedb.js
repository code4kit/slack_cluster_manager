'use strict';

/**
 * @fileOverview _nedb.js
 *
 * @author waricoma
 * @version 1.0.0
 */

const NeDB = require('nedb-async').default;

/**
 * main
 * @param {String} dbFilePath db file path
 * @param {String} systemMode system mode
 * @returns {Object} nedb object
 */
const main = (dbFilePath, systemMode) => {
  if (systemMode.toLowerCase().trim() === 'test') {
    return new NeDB();
  }

  return new NeDB({
    filename: dbFilePath,
    autoload: true
  });
};

module.exports = main;
