-- ============================================================================
-- Mercadinho - schema das tabelas do app desktop (PDV + Estoque)
--
-- Roda inteiro no SQL Editor do Supabase. E idempotente: pode rodar de novo
-- sem quebrar nada.
--
-- Reaproveita a tabela `suppliers` que ja existe no projeto.
-- Nao mexe em `transactions` (a parte financeira do site continua intacta).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PRODUTOS
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  barcode        text,                                  -- EAN-13 etc. Nulo para granel/sem codigo
  name           text not null,
  unit           text not null default 'un',            -- un, kg, g, l, ml, cx, pct
  sale_price     numeric(10,2) not null default 0,
  cost_price     numeric(10,2) not null default 0,      -- ultimo custo pago
  stock_quantity numeric(10,3) not null default 0,
  min_stock      numeric(10,3) not null default 0,      -- alerta de estoque baixo
  category       text,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  active         boolean not null default true,
  user_id        uuid references auth.users,
  user_email     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Codigo de barras unico, mas permitindo varios produtos sem codigo (NULL).
create unique index if not exists products_barcode_key
  on public.products (barcode)
  where barcode is not null;

create index if not exists products_name_idx     on public.products (lower(name));
create index if not exists products_active_idx   on public.products (active);
create index if not exists products_supplier_idx on public.products (supplier_id);

-- ============================================================================
-- PERFIS DE FUNCIONARIO
--
-- Funcionam como perfil do Chrome: quem tem conta de verdade (login do
-- Supabase) e o dono. Os funcionarios sao perfis dentro dessa conta, com nome e
-- senha, sem e-mail e sem conta propria.
--
-- ATENCAO: isto NAO e barreira de seguranca. Todo acesso ao banco continua
-- sendo feito com a sessao do administrador logado, entao o perfil so decide o
-- que a interface mostra. Serve para organizar o caixa e evitar que o
-- funcionario veja o financeiro sem querer - nao para impedir quem queira
-- burlar. Barreira real exigiria conta Supabase por funcionario e RLS por papel.
-- ============================================================================

-- crypt()/gen_salt() para nao guardar a senha em texto puro.
create extension if not exists pgcrypto;

create table if not exists public.employee_profiles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  password_hash text not null,
  active        boolean not null default true,
  created_by    uuid references auth.users,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CLIENTES
--
-- Existem por causa do fiado ("Credito Loja"). Guardar o nome digitado na
-- observacao da venda nao serve para cobrar: "Seu Joao", "seu joao" e "Joao"
-- virariam tres pessoas e ninguem saberia o total devido.
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  note       text,
  active     boolean not null default true,
  user_id    uuid references auth.users,
  user_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_name_idx   on public.customers (lower(name));
create index if not exists customers_active_idx on public.customers (active);

-- ----------------------------------------------------------------------------
-- VENDAS (cabecalho)
-- ----------------------------------------------------------------------------
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  sold_at        timestamptz not null default now(),
  total          numeric(10,2) not null default 0,   -- ja com desconto aplicado
  cost_total     numeric(10,2) not null default 0,   -- soma dos custos, para margem
  discount       numeric(10,2) not null default 0,
  payment_method text not null default 'Dinheiro',   -- resumo: "Dinheiro" ou "Dinheiro + Ticket"
  item_count     integer not null default 0,
  note           text,
  customer_id    uuid references public.customers(id) on delete set null,
  user_id        uuid references auth.users,
  user_email     text,
  created_at     timestamptz not null default now()
);

-- Para bancos criados antes de existir cliente: a criacao acima nao roda de
-- novo, entao a coluna precisa ser adicionada a parte.
alter table public.sales
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists sales_sold_at_idx  on public.sales (sold_at desc);
create index if not exists sales_payment_idx  on public.sales (payment_method);
create index if not exists sales_customer_idx on public.sales (customer_id);

-- ----------------------------------------------------------------------------
-- ITENS DA VENDA
--
-- Guarda snapshot de nome/preco/custo: se o produto mudar de preco depois,
-- o historico da venda continua correto.
-- ----------------------------------------------------------------------------
create table if not exists public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  barcode      text,
  product_name text not null,
  quantity     numeric(10,3) not null,
  unit_price   numeric(10,2) not null,
  unit_cost    numeric(10,2) not null default 0,
  subtotal     numeric(10,2) not null,
  created_at   timestamptz not null default now()
);

create index if not exists sale_items_sale_idx    on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

-- ----------------------------------------------------------------------------
-- PAGAMENTOS DA VENDA
--
-- Uma venda pode ser paga em mais de uma forma ("R$ 50 no ticket e o resto em
-- dinheiro"), entao a forma de pagamento vira uma linha por meio usado.
--
-- `sales.payment_method` continua existindo como resumo legivel
-- ("Dinheiro + Ticket") para listagem e busca; o detalhe com valor de cada
-- meio fica aqui.
-- ----------------------------------------------------------------------------
create table if not exists public.sale_payments (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales(id) on delete cascade,
  method     text not null,             -- Dinheiro, PIX, Debito, Credito, Ticket, Fiado
  amount     numeric(10,2) not null,    -- quanto deste meio entrou na venda (sem troco)
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_sale_idx   on public.sale_payments (sale_id);
create index if not exists sale_payments_method_idx on public.sale_payments (method);

-- ----------------------------------------------------------------------------
-- ABATIMENTOS DO FIADO
--
-- Quando o cliente vem pagar o que devia. Nao esta ligado a uma venda
-- especifica de proposito: quem deve tres compras e paga R$ 50 nao costuma
-- dizer qual delas esta quitando. O saldo e a conta do total devido menos o
-- total pago.
-- ----------------------------------------------------------------------------
create table if not exists public.credit_payments (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  method      text not null default 'Dinheiro',
  paid_at     date not null default current_date,
  note        text,
  user_id     uuid references auth.users,
  user_email  text,
  created_at  timestamptz not null default now()
);

create index if not exists credit_payments_customer_idx on public.credit_payments (customer_id);
create index if not exists credit_payments_date_idx     on public.credit_payments (paid_at desc);

-- ----------------------------------------------------------------------------
-- CREDITO DA LOJA (consumo do funcionario)
--
-- Produto que o funcionario pegou para si e sera descontado no pagamento do
-- fim do mes. E coisa diferente do fiado do cliente: o devedor e o funcionario
-- e a quitacao acontece na folha, nao no caixa.
--
-- `settled_at` marca o que ja foi descontado, senao o total cresceria para
-- sempre e ninguem saberia o que ainda esta em aberto.
-- ----------------------------------------------------------------------------
create table if not exists public.employee_credits (
  id                  uuid primary key default gen_random_uuid(),
  employee_profile_id uuid not null references public.employee_profiles(id) on delete cascade,
  product_id          uuid references public.products(id) on delete set null,
  barcode             text,
  product_name        text not null,
  quantity            numeric(10,3) not null check (quantity > 0),
  unit_price          numeric(10,2) not null,
  total               numeric(10,2) not null,
  taken_at            date not null default current_date,
  note                text,
  settled_at          date,
  created_at          timestamptz not null default now()
);

create index if not exists employee_credits_profile_idx on public.employee_credits (employee_profile_id);
create index if not exists employee_credits_date_idx    on public.employee_credits (taken_at desc);
create index if not exists employee_credits_open_idx    on public.employee_credits (settled_at)
  where settled_at is null;

-- ----------------------------------------------------------------------------
-- ENTRADAS DE ESTOQUE (as "despesas de reestoque")
-- ----------------------------------------------------------------------------
create table if not exists public.stock_entries (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid references public.products(id) on delete set null,
  barcode        text,
  product_name   text not null,
  quantity       numeric(10,3) not null,
  unit_cost      numeric(10,2) not null,
  total_cost     numeric(10,2) not null,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  entry_date     date not null default current_date,
  payment_method text,
  note           text,
  user_id        uuid references auth.users,
  user_email     text,
  created_at     timestamptz not null default now()
);

create index if not exists stock_entries_date_idx     on public.stock_entries (entry_date desc);
create index if not exists stock_entries_product_idx  on public.stock_entries (product_id);
create index if not exists stock_entries_supplier_idx on public.stock_entries (supplier_id);

-- ============================================================================
-- TRIGGERS DE ESTOQUE
--
-- O estoque nunca e mexido na mao pelo app: quem move e o banco. Assim nao tem
-- risco de venda gravada e estoque nao baixado (ou vice-versa).
-- ============================================================================

-- Venda: baixa o estoque ------------------------------------------------------
create or replace function public.apply_sale_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.product_id is not null then
      update public.products
         set stock_quantity = stock_quantity - new.quantity,
             updated_at     = now()
       where id = new.product_id;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    -- Venda cancelada/estornada devolve o item ao estoque.
    if old.product_id is not null then
      update public.products
         set stock_quantity = stock_quantity + old.quantity,
             updated_at     = now()
       where id = old.product_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sale_item_stock on public.sale_items;
create trigger trg_sale_item_stock
  after insert or delete on public.sale_items
  for each row execute function public.apply_sale_item_stock();

-- Reestoque: sobe o estoque e atualiza o custo do produto ---------------------
create or replace function public.apply_stock_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.product_id is not null then
      update public.products
         set stock_quantity = stock_quantity + new.quantity,
             cost_price     = new.unit_cost,   -- passa a valer o custo da compra mais recente
             updated_at     = now()
       where id = new.product_id;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.product_id is not null then
      update public.products
         set stock_quantity = stock_quantity - old.quantity,
             updated_at     = now()
       where id = old.product_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_stock_entry on public.stock_entries;
create trigger trg_stock_entry
  after insert or delete on public.stock_entries
  for each row execute function public.apply_stock_entry();

-- Consumo do funcionario: baixa o estoque igual a uma venda ------------------
-- O produto saiu da prateleira do mesmo jeito. Sem isto, o estoque do sistema
-- ficaria maior que o real e ninguem entenderia a diferenca na contagem.
create or replace function public.apply_employee_credit_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.product_id is not null then
      update public.products
         set stock_quantity = stock_quantity - new.quantity,
             updated_at     = now()
       where id = new.product_id;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.product_id is not null then
      update public.products
         set stock_quantity = stock_quantity + old.quantity,
             updated_at     = now()
       where id = old.product_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_employee_credit_stock on public.employee_credits;
create trigger trg_employee_credit_stock
  after insert or delete on public.employee_credits
  for each row execute function public.apply_employee_credit_stock();

-- ============================================================================
-- RPC: finalizar venda de forma atomica
--
-- O PDV manda o carrinho inteiro numa chamada so. Ou grava tudo (venda +
-- itens + baixa de estoque), ou nao grava nada. Sem venda pela metade se a
-- internet cair no meio.
--
-- p_items: [{ "product_id": uuid|null, "barcode": text, "product_name": text,
--             "quantity": num, "unit_price": num, "unit_cost": num }]
--
-- p_payments: [{ "method": text, "amount": num }] - um item para pagamento
--             simples, varios para pagamento combinado. Os valores sao o que
--             entrou na venda, ja sem o troco.
-- ============================================================================

-- Assinaturas antigas. Adicionar parametro cria sobrecarga em vez de
-- substituir, e o PostgREST nao saberia qual chamar — por isso cada versao
-- anterior precisa ser removida explicitamente.
drop function if exists public.create_sale(jsonb, text, numeric, text);
drop function if exists public.create_sale(jsonb, jsonb, numeric, text);

create or replace function public.create_sale(
  p_items       jsonb,
  p_payments    jsonb,
  p_discount    numeric default 0,
  p_note        text default null,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id    uuid;
  v_subtotal   numeric(10,2) := 0;
  v_cost_total numeric(10,2) := 0;
  v_total      numeric(10,2) := 0;
  v_paid       numeric(10,2) := 0;
  v_count      integer       := 0;
  v_item       jsonb;
  v_email      text;
  v_summary    text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;

  if p_payments is null or jsonb_array_length(p_payments) = 0 then
    raise exception 'Informe ao menos uma forma de pagamento';
  end if;

  -- Fiado sem dono e divida que ninguem consegue cobrar depois. A regra mora
  -- aqui, e nao so na tela, para que nenhum caminho consiga gravar assim.
  if p_customer_id is null
     and exists (select 1
                   from jsonb_array_elements(p_payments) as p
                  where p->>'method' = 'Crédito Loja')
  then
    raise exception 'Venda no Crédito Loja precisa de um cliente';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  -- Totais calculados no banco a partir dos itens: o cliente nao dita o total.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal   := v_subtotal
                    + (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    v_cost_total := v_cost_total
                    + (v_item->>'quantity')::numeric * coalesce((v_item->>'unit_cost')::numeric, 0);
    v_count      := v_count + 1;
  end loop;

  v_total := greatest(v_subtotal - coalesce(p_discount, 0), 0);

  -- A soma dos pagamentos tem que fechar com o total. Sem isso daria para
  -- gravar venda de R$ 100 com R$ 10 pagos e o caixa nunca bateria. A folga de
  -- um centavo cobre arredondamento na divisao entre os meios.
  select coalesce(sum((p->>'amount')::numeric), 0)
    into v_paid
    from jsonb_array_elements(p_payments) as p;

  if abs(v_paid - v_total) > 0.01 then
    raise exception 'Pagamentos somam % mas a venda e de %', v_paid, v_total;
  end if;

  -- Resumo legivel para a listagem: "Dinheiro" ou "Dinheiro + Ticket".
  select string_agg(distinct p->>'method', ' + ')
    into v_summary
    from jsonb_array_elements(p_payments) as p;

  insert into public.sales (total, cost_total, discount, payment_method, item_count, note,
                            customer_id, user_id, user_email)
  values (v_total, v_cost_total, coalesce(p_discount, 0), v_summary, v_count, p_note,
          p_customer_id, auth.uid(), v_email)
  returning id into v_sale_id;

  -- O trigger em sale_items cuida da baixa de estoque.
  insert into public.sale_items (sale_id, product_id, barcode, product_name,
                                 quantity, unit_price, unit_cost, subtotal)
  select v_sale_id,
         nullif(item->>'product_id', '')::uuid,
         item->>'barcode',
         item->>'product_name',
         (item->>'quantity')::numeric,
         (item->>'unit_price')::numeric,
         coalesce((item->>'unit_cost')::numeric, 0),
         (item->>'quantity')::numeric * (item->>'unit_price')::numeric
    from jsonb_array_elements(p_items) as item;

  insert into public.sale_payments (sale_id, method, amount)
  select v_sale_id, p->>'method', (p->>'amount')::numeric
    from jsonb_array_elements(p_payments) as p;

  return v_sale_id;
end;
$$;

-- ============================================================================
-- VIEW: produtos abaixo do estoque minimo
-- ============================================================================
-- ============================================================================
-- PERFIS: criar, conferir senha, renomear
--
-- Tudo por funcao SECURITY DEFINER porque o `password_hash` nunca deve sair da
-- tabela. A listagem usa a view abaixo, que expoe so nome e situacao.
--
-- `search_path` inclui `extensions` porque no Supabase o pgcrypto costuma
-- morar la, e sem isso o crypt() nao seria encontrado.
-- ============================================================================

create or replace function public.create_employee_profile(
  p_name     text,
  p_password text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'O nome do perfil e obrigatorio';
  end if;

  if length(coalesce(p_password, '')) < 4 then
    raise exception 'A senha precisa de pelo menos 4 caracteres';
  end if;

  insert into public.employee_profiles (name, password_hash, created_by)
  values (trim(p_name), crypt(p_password, gen_salt('bf')), auth.uid())
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ja existe um perfil com esse nome';
end;
$$;

create or replace function public.verify_employee_password(
  p_profile_id uuid,
  p_password   text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash
    from public.employee_profiles
   where id = p_profile_id and active;

  if v_hash is null then
    return false;
  end if;

  return v_hash = crypt(p_password, v_hash);
end;
$$;

create or replace function public.set_employee_password(
  p_profile_id uuid,
  p_password   text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(coalesce(p_password, '')) < 4 then
    raise exception 'A senha precisa de pelo menos 4 caracteres';
  end if;

  update public.employee_profiles
     set password_hash = crypt(p_password, gen_salt('bf')),
         updated_at    = now()
   where id = p_profile_id;
end;
$$;

-- Listagem sem o hash. View comum (nao security_invoker) de proposito: ela
-- precisa enxergar a tabela que o RLS mantem fechada para leitura direta.
create or replace view public.employee_profiles_public as
  select id, name, active, created_at
    from public.employee_profiles;

-- ============================================================================
-- VIEW: quanto cada cliente deve no fiado
--
-- O saldo e sempre calculado, nunca guardado numa coluna. Assim estornar uma
-- venda ou apagar um pagamento corrige a divida sozinho — um contador
-- denormalizado sairia do lugar no primeiro estorno e ninguem perceberia.
-- ============================================================================
create or replace view public.customer_credit_balance
  with (security_invoker = true)
as
  with debt as (
    select s.customer_id, sum(sp.amount) as total
      from public.sales s
      join public.sale_payments sp on sp.sale_id = s.id
     where sp.method = 'Crédito Loja'
       and s.customer_id is not null
     group by s.customer_id
  ),
  paid as (
    select customer_id, sum(amount) as total
      from public.credit_payments
     group by customer_id
  )
  select c.id,
         c.name,
         c.phone,
         c.active,
         coalesce(d.total, 0)                        as total_debt,
         coalesce(p.total, 0)                        as total_paid,
         coalesce(d.total, 0) - coalesce(p.total, 0) as balance,
         (select max(s.sold_at)
            from public.sales s
           where s.customer_id = c.id)               as last_purchase_at,
         (select max(cp.paid_at)
            from public.credit_payments cp
           where cp.customer_id = c.id)              as last_payment_at
    from public.customers c
    left join debt d on d.customer_id = c.id
    left join paid p on p.customer_id = c.id;

-- security_invoker: sem isso a view rodaria com os poderes do dono e passaria
-- por cima do RLS de `products`.
create or replace view public.low_stock_products
  with (security_invoker = true)
as
  select p.*,
         (p.min_stock - p.stock_quantity) as missing_quantity
    from public.products p
   where p.active
     and p.min_stock > 0
     and p.stock_quantity <= p.min_stock;

-- ============================================================================
-- RLS
--
-- Mesmo modelo do resto do projeto (todo mundo logado ve tudo), mas restrito
-- a usuarios autenticados - o `anon` nao enxerga nada.
-- ============================================================================
alter table public.products        enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.sale_payments   enable row level security;
alter table public.stock_entries   enable row level security;
alter table public.customers         enable row level security;
alter table public.credit_payments   enable row level security;
alter table public.employee_credits  enable row level security;
alter table public.employee_profiles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['products', 'sales', 'sale_items', 'sale_payments',
                           'stock_entries', 'customers', 'credit_payments',
                           'employee_credits'] loop
    execute format('drop policy if exists "auth_select_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "auth_insert_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "auth_update_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "auth_delete_%1$s" on public.%1$I', t);

    execute format('create policy "auth_select_%1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "auth_insert_%1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "auth_update_%1$s" on public.%1$I for update to authenticated using (true)', t);
    execute format('create policy "auth_delete_%1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- employee_profiles fica de fora do laco acima: recebe insert/update/delete,
-- mas NENHUMA policy de select. Assim o `password_hash` nao pode ser lido pela
-- API nem por engano; quem lista e a view employee_profiles_public.
do $$
declare
  p text;
begin
  foreach p in array array['insert', 'update', 'delete'] loop
    execute format('drop policy if exists "auth_%s_employee_profiles" on public.employee_profiles', p);
  end loop;
  execute 'drop policy if exists "auth_select_employee_profiles" on public.employee_profiles';

  create policy "auth_insert_employee_profiles" on public.employee_profiles
    for insert to authenticated with check (true);
  create policy "auth_update_employee_profiles" on public.employee_profiles
    for update to authenticated using (true);
  create policy "auth_delete_employee_profiles" on public.employee_profiles
    for delete to authenticated using (true);
end $$;

grant execute on function public.create_sale(jsonb, jsonb, numeric, text, uuid) to authenticated;
grant execute on function public.create_employee_profile(text, text) to authenticated;
grant execute on function public.verify_employee_password(uuid, text) to authenticated;
grant execute on function public.set_employee_password(uuid, text) to authenticated;
grant select on public.employee_profiles_public to authenticated;
grant select on public.low_stock_products to authenticated;
grant select on public.customer_credit_balance to authenticated;
