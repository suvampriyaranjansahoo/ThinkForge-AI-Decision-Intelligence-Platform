'use strict';
function gate(report={}){const rules={tests:true,syntax:true,security:true,study:true,benchmark:true};const failures=Object.entries(rules).filter(([k])=>report[k]!==true).map(([k])=>k);return{pass:failures.length===0,failures,criteria:Object.keys(rules)}}
module.exports={gate};
