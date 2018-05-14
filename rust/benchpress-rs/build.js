'use strict';

const { join } = require('path');
const { copyFileSync } = require('fs');

const source = join(__dirname, 'native/index.node');
const dest = join(__dirname, `pre-built/${process.platform}_${process.versions.modules}.node`);

copyFileSync(source, dest);
process.stdout.write('Successfully built native benchpress-rs addon.\n' +
  'Please contribute the new file to the repository to improve the experience of others.');
