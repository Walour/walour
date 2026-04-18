-- Threat corpus
create table if not exists threat_reports (
  address      text primary key,
  type         text not null check (type in ('drainer','rug','phishing_domain','malicious_token')),
  source       text not null check (source in ('chainabuse','scam_sniffer','community','twitter')),
  evidence_url text,
  confidence   float not null default 0.5 check (confidence >= 0 and confidence <= 1),
  first_seen   timestamptz not null default now(),
  last_updated timestamptz not null default now()
);
create index if not exists threat_reports_address_idx on threat_reports(address);
create index if not exists threat_reports_confidence_idx on threat_reports(confidence);

-- Ingestion errors
create table if not exists ingestion_errors (
  id         uuid primary key default gen_random_uuid(),
  source     text,
  payload    jsonb,
  reason     text,
  created_at timestamptz default now()
);

-- Telemetry
create table if not exists drain_blocked_events (
  event_id            text primary key,
  timestamp           bigint,
  wallet_pubkey       text,
  blocked_tx_hash     text,
  drainer_target      text,
  block_reason        text,
  estimated_sol_saved float,
  estimated_usd_saved float,
  confirmed           boolean default false,
  surface             text,
  app_version         text,
  created_at          timestamptz default now()
);

-- Provider outages
create table if not exists outages (
  id         uuid primary key default gen_random_uuid(),
  provider   text,
  opened_at  timestamptz default now(),
  closed_at  timestamptz,
  error_msg  text
);

-- Upsert function used by ingestion worker
create or replace function upsert_threat(
  p_address text,
  p_type text,
  p_source text,
  p_evidence_url text,
  p_confidence_delta float
) returns void language plpgsql as $$
begin
  insert into threat_reports (address, type, source, evidence_url, confidence)
  values (p_address, p_type, p_source, p_evidence_url, p_confidence_delta)
  on conflict (address) do update
    set confidence   = least(1.0, threat_reports.confidence + p_confidence_delta * 0.1),
        last_updated = now(),
        evidence_url = coalesce(p_evidence_url, threat_reports.evidence_url);
end;
$$;
