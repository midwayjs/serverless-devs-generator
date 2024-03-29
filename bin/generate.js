#! /usr/bin/env node
const { generate } = require('../dist/');

const options = process.argv
  .filter(arg => arg.startsWith('--'))
  .reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    acc[key.replace('--', '')] = value;
    return acc;
  }, {});

/** CLI Task Run */
generate(options)
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
