const test=require('node:test');const assert=require('node:assert/strict');const {brierScore,expectedCalibrationError,sampleSizeTwoProportion}=require('../lib/statistics');
test('calibration metrics are bounded',()=>{const rows=[{probability:.8,outcome:1},{probability:.2,outcome:0}];assert.ok(brierScore(rows)>=0&&brierScore(rows)<=1);assert.ok(expectedCalibrationError(rows)>=0&&expectedCalibrationError(rows)<=1)});
test('sample size returns positive integer',()=>{assert.ok(sampleSizeTwoProportion({baseline:.2,mde:.05})>0)});
