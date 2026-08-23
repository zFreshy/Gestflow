-- Create transactions table
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  description text not null,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  payment_method text,
  date date not null,
  subtitle text,
  client_name text,
  is_bakery_income boolean default false,
  recurrence text,
  exam text,
  health_plan text,
  status text default 'Aguardando',
  expense_type text check (expense_type in ('fixed', 'variable')),
  interest_rate numeric, -- New field for interest rate
  active boolean default true, -- New field to mark if fixed expense is still active
  end_date date, -- New field to specify when the fixed expense ended
  user_email text, -- New field to track who created the transaction
  installments integer, -- Total de parcelas
  current_installment integer, -- Número da parcela atual (ex: 1, 2, 3)
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Create policies
create policy "Users can view all transactions"
  on public.transactions for select
  using (true);

create policy "Users can insert transactions"
  on public.transactions for insert
  with check (true);

create policy "Users can update transactions"
  on public.transactions for update
  using (true);

create policy "Users can delete transactions"
  on public.transactions for delete
  using (true);

-- ============================================================================
-- APAGAR UMA CONTA TEM QUE SER POSSIVEL
--
-- `user_id` nasceu como `references auth.users not null`, sem dizer o que fazer
-- quando a conta some. O padrao do Postgres nesse caso e NO ACTION, ou seja:
-- proibir. Na pratica, quem lancou uma transacao virava indeleavel, e o painel
-- do Supabase so mostra o erro cru:
--
--   violates foreign key constraint "transactions_user_id_fkey"
--
-- `on delete cascade` NAO serve aqui, e vale dizer por que: ele apagaria todo o
-- historico financeiro lancado por aquela pessoa junto com a conta dela. E o
-- tipo de perda que so se descobre no fechamento do mes seguinte.
--
-- `set null` e o certo. A coluna e rastro, nao dono do dado: a transacao
-- continua com valor, data e descricao intactos, e `user_email` — que e o que o
-- site realmente exibe — preserva quem lancou.
--
-- Para isso o NOT NULL precisa sair. E seguro: o app continua preenchendo
-- `user_id` em toda insercao, nunca le a coluna de volta (a consulta da tela
-- nem a inclui), e as policies de RLS nao dependem dela.
-- ============================================================================
do $$
declare
  nome text;
begin
  alter table public.transactions alter column user_id drop not null;

  select con.conname into nome
    from pg_constraint con
    join pg_class rel    on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid
                         and att.attnum = con.conkey[1]
   where con.contype = 'f'
     and ns.nspname = 'public'
     and rel.relname = 'transactions'
     and att.attname = 'user_id'
     and con.confrelid = 'auth.users'::regclass
     and con.confdeltype = 'a'   -- 'a' = NO ACTION, o padrao que trava
   limit 1;

  if nome is not null then
    execute format('alter table public.transactions drop constraint %I', nome);
    execute format(
      'alter table public.transactions add constraint %I foreign key (user_id) references auth.users(id) on delete set null',
      nome);
  end if;
end $$;
