-- ThinkForge v14.2

-- v14.2 live database verification: fail-closed, read-only runtime diagnostics.
-- This function verifies that the Stage 1 schema and canonical persistence
-- surface are actually present in the connected database. It performs no writes.
create or replace function public.thinkforge_verify_stage1_live()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  checks jsonb := '[]'::jsonb;
  ok boolean := true;
  has_rls boolean;
  has_table boolean;
  has_function boolean;
  has_column boolean;
  rec record;
begin
  for rec in select * from (values
    ('thinkforge_discoveries','table'),
    ('thinkforge_research_evidence','table'),
    ('thinkforge_research_codes','table'),
    ('thinkforge_research_themes','table'),
    ('thinkforge_opportunities','table'),
    ('thinkforge_solutions','table')
  ) as x(name,kind) loop
    select exists(select 1 from information_schema.tables where table_schema='public' and table_name=rec.name) into has_table;
    ok := ok and has_table;
    checks := checks || jsonb_build_array(jsonb_build_object('check',rec.kind||':'||rec.name,'passed',has_table));
  end loop;

  for rec in select * from (values
    ('thinkforge_discoveries','analysis_version'),
    ('thinkforge_discoveries','analysis_payload'),
    ('thinkforge_research_codes','confidence'),
    ('thinkforge_research_codes','client_id'),
    ('thinkforge_research_themes','confidence'),
    ('thinkforge_research_themes','evidence_ids'),
    ('thinkforge_solutions','evidence_ids')
  ) as x(table_name,column_name) loop
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=rec.table_name and column_name=rec.column_name) into has_column;
    ok := ok and has_column;
    checks := checks || jsonb_build_array(jsonb_build_object('check','column:'||rec.table_name||'.'||rec.column_name,'passed',has_column));
  end loop;

  select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='thinkforge_upsert_discovery_v2') into has_function;
  ok := ok and has_function;
  checks := checks || jsonb_build_array(jsonb_build_object('check','function:thinkforge_upsert_discovery_v2','passed',has_function));

  select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='thinkforge_verify_stage1_live') into has_function;
  checks := checks || jsonb_build_array(jsonb_build_object('check','function:thinkforge_verify_stage1_live','passed',has_function));

  for rec in select * from (values
    ('thinkforge_discoveries'),('thinkforge_research_evidence'),('thinkforge_research_codes'),
    ('thinkforge_research_themes'),('thinkforge_opportunities'),('thinkforge_solutions')
  ) as x(table_name) loop
    select coalesce(c.relrowsecurity,false) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=rec.table_name into has_rls;
    ok := ok and coalesce(has_rls,false);
    checks := checks || jsonb_build_array(jsonb_build_object('check','rls:'||rec.table_name,'passed',coalesce(has_rls,false)));
  end loop;

  return jsonb_build_object('status',case when ok then 'PASS' else 'FAIL' end,'checkedAt',now(),'checks',checks,'readOnly',true,'migration','020+021');
end $$;

grant execute on function public.thinkforge_verify_stage1_live() to service_role;
