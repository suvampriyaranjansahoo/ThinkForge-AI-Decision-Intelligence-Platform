-- Serialize audit-chain appends per user and reject stale predecessors.
-- This prevents two concurrent transactions from creating sibling events from
-- the same previous_hash. The caller receives SQLSTATE 40001 and must retry.
create or replace function public.thinkforge_guard_audit_chain_append()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_latest_hash text;
begin
  if new.event_hash is null or new.event_hash='' then
    raise exception using errcode='23514',message='audit event_hash is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select event_hash into v_latest_hash
    from public.thinkforge_audit_events
    where user_id=new.user_id
    order by created_at desc,id desc limit 1;
  if coalesce(new.previous_hash,'')<>coalesce(v_latest_hash,'') then
    raise exception using errcode='40001',message='audit chain predecessor changed; retry append';
  end if;
  return new;
end $$;

drop trigger if exists thinkforge_audit_chain_append_guard on public.thinkforge_audit_events;
create trigger thinkforge_audit_chain_append_guard
before insert on public.thinkforge_audit_events
for each row execute function public.thinkforge_guard_audit_chain_append();
