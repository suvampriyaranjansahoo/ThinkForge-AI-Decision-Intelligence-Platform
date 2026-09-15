## Security and data-access checklist

- [ ] Every new or changed `SECURITY DEFINER` RPC that reads or writes organization data calls `public.thinkforge_require_membership(p_user_id, p_organization_id, minimum_role)` before accessing tenant data. If this does not apply, explain why below.
- [ ] Outbound HTTP calls use `lib/http.js` (or document an equivalent provider-specific control).
- [ ] Prompt-injection heuristics, if used, are telemetry only; no `false` result is treated as safe input.
- [ ] Tests cover the authorization and failure paths changed by this PR.

Notes / exception rationale:

