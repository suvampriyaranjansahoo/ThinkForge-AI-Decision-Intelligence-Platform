'use strict';

// Node's LCOV reporter does not create its destination directory. Creating it
// here keeps `npm run test:coverage` portable across local Windows, macOS/Linux,
// and a clean CI checkout.
const fs = require('node:fs');
const path = require('node:path');

fs.mkdirSync(path.join(__dirname, '..', 'coverage'), { recursive: true });
