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
generate(options);
