'use strict';
const fs=require('fs');const {outcomeMetrics}=require('../lib/evaluation');
const input=process.argv[2];if(!input){console.error('Usage: node scripts/calibrate.js outcomes.json');process.exit(2)}const rows=JSON.parse(fs.readFileSync(input,'utf8'));console.log(JSON.stringify(outcomeMetrics(rows),null,2));
