'use strict';
/**
 * Fact access (§1 rule 3). The UI states numbers only through `fact(id)`;
 * unverified facts render with a "figure under verification" badge.
 */
let FACTS = [];
const byId = new Map();
function load(list) { FACTS = list || []; byId.clear(); for (const f of FACTS) byId.set(f.id, f); }
function get(id) { return byId.get(id) || null; }
function badge(f) {
  if (!f) return '<span class="badge badge-warn">fact missing</span>';
  const rep = f.replication && f.replication !== 'n/a' ? `<span class="badge rep-${f.replication}">${f.replication}</span>` : '';
  const conf = f.confidence === 'verified' ? '<span class="badge badge-ok" title="Verified against source">verified</span>'
    : f.confidence === 'disputed' ? '<span class="badge badge-bad">disputed</span>' : '<span class="badge badge-warn" title="Figure under verification">figure under verification</span>';
  return conf + rep;
}
function cite(id) { const f = get(id); return f ? `${f.source}${f.doi_or_url ? ' — ' + f.doi_or_url : ''}` : ''; }
module.exports = { load, get, badge, cite, all: () => FACTS };
