'use strict';
// Compatibility adapter. Stage 4 governance authority lives exclusively in
// the canonical decision-governance handler/RPC surface. Keep this route for
// older clients without exposing the legacy v1 governance implementation.
module.exports=require('./decision-governance');
