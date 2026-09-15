'use strict';

/**
 * Stage 4 preview facade.
 *
 * IMPORTANT: this module is intentionally NON-AUTHORITATIVE. It is safe for
 * offline UI previews, deterministic diffing, and local tests only. It must
 * never be used to authorize, approve, persist, or transition a real decision.
 * The authoritative governance policy is the versioned PostgreSQL RPC surface.
 */
const preview=require('./decisionGovernancePreview');
module.exports={...preview,PREVIEW_ONLY:true};
