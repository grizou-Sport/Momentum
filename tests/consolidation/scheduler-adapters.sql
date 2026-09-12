-- Local adapters only. These do NOT validate Vault encryption, pg_cron execution or HTTP delivery.
create schema vault; create schema cron; create schema net;
create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text,description text);
create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text,new_name text,new_description text) returns uuid language sql as $$insert into vault.secrets(secret,name,description) values(new_secret,new_name,new_description) returning id;$$;
create function vault.update_secret(secret_id uuid,new_secret text,new_name text,new_description text) returns void language sql as $$update vault.secrets set secret=new_secret,name=new_name,description=new_description where id=secret_id;$$;
create table cron.job(jobid bigint generated always as identity,jobname text unique,schedule text,command text);
create function cron.schedule(job_name text,job_schedule text,job_command text) returns bigint language sql as $$insert into cron.job(jobname,schedule,command) values(job_name,job_schedule,job_command) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid;$$;
create table net.test_requests(url text,headers jsonb,body jsonb,timeout_milliseconds integer);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into net.test_requests values(url,headers,body,timeout_milliseconds);return 1;end;$$;
