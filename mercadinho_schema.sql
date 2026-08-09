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
-- Cada funcionario e uma conta Supabase de verdade, com e-mail sintetico
-- (maria@funcionario.local). Na tela ele digita so nome e senha; o e-mail e
-- montado a partir do nome e nunca aparece.
--
-- A conta real e o que torna a separacao efetiva: o RLS enxerga quem esta
-- pedindo e nega o dado na origem. Esconder menu e coluna nao adiantaria, pois
-- o dado ainda chegaria na maquina e bastaria abrir o devtools para ler.
--
-- Quem NAO tem linha aqui e administrador. Uma tabela de papeis separada
-- exigiria semear os administradores que ja existem e daria margem a conta sem
-- papel nenhum; assim a regra tem uma fonte unica de verdade.
-- ============================================================================

create table if not exists public.employee_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  name        text not null unique,
  login_email text unique,
  active      boolean not null default true,
  created_by  uuid references auth.users,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migracao de bancos que ja tinham o modelo antigo (perfil sem conta, com
-- senha em hash na propria tabela).
alter table public.employee_profiles
  add column if not exists user_id     uuid unique references auth.users(id) on delete cascade,
  add column if not exists login_email text unique;

-- A senha agora mora no auth.users. Guardar hash aqui era mais um segredo para
-- vazar, sem servir para nada.
alter table public.employee_profiles drop column if exists password_hash;

create index if not exists employee_profiles_user_idx on public.employee_profiles (user_id);

-- ----------------------------------------------------------------------------
-- Quem e quem
--
-- SECURITY DEFINER porque estas funcoes sao usadas dentro das proprias policies
-- de employee_profiles: se lessem a tabela com as permissoes de quem chamou,
-- entrariam em recursao infinita de RLS.
-- ----------------------------------------------------------------------------
create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employee_profiles
     where user_id = auth.uid() and active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and not public.is_employee();
$$;

/** Perfil do funcionario logado, para ele so mexer no que e dele. */
create or replace function public.current_employee_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.employee_profiles
   where user_id = auth.uid() and active
   limit 1;
$$;

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

  -- Precos vem da tabela de produtos, nao do que o app mandou.
  --
  -- O app envia preco junto so para montar a tela; confiar nele deixaria
  -- qualquer um registrar uma venda de R$ 0,01 chamando a API direto. Item sem
  -- product_id (granel, produto nao cadastrado) e a unica excecao, porque nao
  -- ha de onde buscar.
  select coalesce(sum(qty * price), 0),
         coalesce(sum(qty * cost), 0),
         count(*)
    into v_subtotal, v_cost_total, v_count
    from (
      select (i->>'quantity')::numeric as qty,
             coalesce(p.sale_price, (i->>'unit_price')::numeric) as price,
             coalesce(p.cost_price, coalesce((i->>'unit_cost')::numeric, 0)) as cost
        from jsonb_array_elements(p_items) as i
        left join public.products p on p.id = nullif(i->>'product_id', '')::uuid
    ) resolvido;

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
  -- Mesma resolucao de preco usada nos totais, para o item gravado bater com o
  -- valor cobrado.
  insert into public.sale_items (sale_id, product_id, barcode, product_name,
                                 quantity, unit_price, unit_cost, subtotal)
  select v_sale_id,
         p.id,
         coalesce(p.barcode, item->>'barcode'),
         coalesce(p.name, item->>'product_name'),
         (item->>'quantity')::numeric,
         coalesce(p.sale_price, (item->>'unit_price')::numeric),
         coalesce(p.cost_price, coalesce((item->>'unit_cost')::numeric, 0)),
         (item->>'quantity')::numeric
           * coalesce(p.sale_price, (item->>'unit_price')::numeric)
    from jsonb_array_elements(p_items) as item
    left join public.products p on p.id = nullif(item->>'product_id', '')::uuid;

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
-- PERFIS: funcoes antigas removidas
--
-- Na versao anterior o perfil tinha senha propria, guardada em hash aqui, e
-- estas funcoes cuidavam disso. Agora a senha e do auth.users e quem confere e
-- o proprio Supabase, entao elas nao so ficaram sem uso como manteriam um
-- caminho paralelo de autenticacao mais fraco que o oficial.
-- ============================================================================
drop function if exists public.create_employee_profile(text, text);
drop function if exists public.verify_employee_password(uuid, text);
drop function if exists public.set_employee_password(uuid, text);

-- Listagem dos perfis para o seletor de conta. Precisa ser visivel antes do
-- login do funcionario, entao roda como dono (nao security_invoker) e expoe so
-- nome e situacao.
-- `login_email` entra aqui porque o seletor de perfil precisa dele para fazer
-- o login. Nao e segredo: e derivado do nome de forma previsivel
-- (maria -> maria@funcionario.local) e sozinho nao abre nada — a senha
-- continua sendo exigida pelo Supabase.
create or replace view public.employee_profiles_public as
  select id, name, login_email, active, created_at
    from public.employee_profiles
   where active;

-- ============================================================================
-- VIEW: quanto cada cliente deve no fiado
--
-- O saldo e sempre calculado, nunca guardado numa coluna. Assim estornar uma
-- venda ou apagar um pagamento corrige a divida sozinho — um contador
-- denormalizado sairia do lugar no primeiro estorno e ninguem perceberia.
-- ============================================================================
-- Sem security_invoker de proposito: a conta soma `sale_payments`, que o
-- funcionario nao pode ler. Rodando como dono, ela devolve o saldo certo para
-- os dois papeis sem abrir a tabela de vendas para ninguem.
create or replace view public.customer_credit_balance as
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
-- Aqui e onde a separacao entre administrador e funcionario deixa de ser
-- aparencia e vira regra. Um detalhe do Postgres torna isso obrigatorio: todo
-- usuario logado compartilha o MESMO papel `authenticated`, entao permissao por
-- coluna (GRANT) nao consegue distinguir os dois. A distincao tem que estar na
-- policy, e como policy e por LINHA e nao por coluna, tudo que contem valor
-- financeiro (custo, lucro, faturamento) e negado por inteiro ao funcionario e
-- reexposto pela view `products_pos`, que simplesmente nao tem essas colunas.
--
-- Regra geral: o funcionario opera o caixa, o administrador enxerga dinheiro.
-- ============================================================================
alter table public.products          enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_items        enable row level security;
alter table public.sale_payments     enable row level security;
alter table public.stock_entries     enable row level security;
alter table public.customers         enable row level security;
alter table public.credit_payments   enable row level security;
alter table public.employee_credits  enable row level security;
alter table public.employee_profiles enable row level security;

-- Limpa as policies permissivas da versao anterior, em que todo mundo via tudo.
do $$
declare
  t text;
  p text;
begin
  foreach t in array array['products', 'sales', 'sale_items', 'sale_payments',
                           'stock_entries', 'customers', 'credit_payments',
                           'employee_credits', 'employee_profiles'] loop
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists "auth_%s_%s" on public.%I', p, t, t);
      execute format('drop policy if exists "admin_%s_%s" on public.%I', p, t, t);
      execute format('drop policy if exists "emp_%s_%s" on public.%I', p, t, t);
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- SO ADMINISTRADOR: tudo que revela dinheiro
--
-- sales/sale_items/sale_payments guardam faturamento, custo e lucro.
-- stock_entries e o quanto se paga ao fornecedor.
-- O funcionario nao le nada disso — nem em consulta direta pela API.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['sales', 'sale_items', 'sale_payments', 'stock_entries'] loop
    execute format($f$
      create policy "admin_select_%1$s" on public.%1$I
        for select to authenticated using (public.is_admin());
      create policy "admin_insert_%1$s" on public.%1$I
        for insert to authenticated with check (public.is_admin());
      create policy "admin_update_%1$s" on public.%1$I
        for update to authenticated using (public.is_admin());
      create policy "admin_delete_%1$s" on public.%1$I
        for delete to authenticated using (public.is_admin());
    $f$, t);
  end loop;
end $$;

-- O funcionario ainda vende: quem grava a venda e o create_sale, que roda como
-- SECURITY DEFINER e por isso passa por cima destas policies. Ou seja, ele
-- consegue registrar venda sem conseguir ler nenhuma.

-- ----------------------------------------------------------------------------
-- PRODUTOS: administrador le a tabela; funcionario le a view sem custo
-- ----------------------------------------------------------------------------
create policy "admin_select_products" on public.products
  for select to authenticated using (public.is_admin());
create policy "admin_insert_products" on public.products
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_products" on public.products
  for update to authenticated using (public.is_admin());
create policy "admin_delete_products" on public.products
  for delete to authenticated using (public.is_admin());

-- View de venda: mesmos produtos, sem cost_price. Roda como dono para
-- atravessar o RLS acima de proposito — e o unico caminho do funcionario ate o
-- catalogo, e nele o custo simplesmente nao existe.
create or replace view public.products_pos as
  select id, barcode, name, unit, sale_price, stock_quantity, min_stock,
         category, supplier_id, active
    from public.products
   where active;

-- ----------------------------------------------------------------------------
-- CLIENTES E FIADO: os dois lados operam
--
-- Divida de cliente nao e lucro da loja, e vender fiado no balcao e trabalho de
-- caixa. Sem isto o funcionario nao conseguiria fechar uma venda no fiado.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['customers', 'credit_payments'] loop
    execute format($f$
      create policy "auth_select_%1$s" on public.%1$I
        for select to authenticated using (true);
      create policy "auth_insert_%1$s" on public.%1$I
        for insert to authenticated with check (true);
      create policy "admin_update_%1$s" on public.%1$I
        for update to authenticated using (public.is_admin());
      create policy "admin_delete_%1$s" on public.%1$I
        for delete to authenticated using (public.is_admin());
    $f$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- CREDITO DA LOJA: cada funcionario so enxerga o proprio consumo
-- ----------------------------------------------------------------------------
create policy "emp_select_employee_credits" on public.employee_credits
  for select to authenticated
  using (public.is_admin() or employee_profile_id = public.current_employee_profile_id());

-- Lancar so para si mesmo: ninguem poe consumo na conta do colega.
create policy "emp_insert_employee_credits" on public.employee_credits
  for insert to authenticated
  with check (
    public.is_admin() or (
      employee_profile_id = public.current_employee_profile_id()
      and settled_at is null   -- funcionario nao nasce lancamento ja quitado
    )
  );

-- Marcar como descontado e ato do administrador: e o acerto do pagamento.
create policy "admin_update_employee_credits" on public.employee_credits
  for update to authenticated using (public.is_admin());

-- O funcionario corrige o proprio erro, desde que ainda nao tenha sido
-- descontado — mexer em conta ja fechada bagunçaria o acerto do mes passado.
create policy "emp_delete_employee_credits" on public.employee_credits
  for delete to authenticated
  using (
    public.is_admin() or (
      employee_profile_id = public.current_employee_profile_id()
      and settled_at is null
    )
  );

-- ----------------------------------------------------------------------------
-- PERFIS: so o administrador cria e mexe
--
-- O funcionario le apenas a propria linha, que e o que o app precisa para saber
-- quem ele e. A lista para o seletor de conta vem da view.
-- ----------------------------------------------------------------------------
create policy "emp_select_employee_profiles" on public.employee_profiles
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy "admin_insert_employee_profiles" on public.employee_profiles
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_employee_profiles" on public.employee_profiles
  for update to authenticated using (public.is_admin());
create policy "admin_delete_employee_profiles" on public.employee_profiles
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- GRANTS
-- ============================================================================
grant execute on function public.create_sale(jsonb, jsonb, numeric, text, uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_employee() to authenticated;
grant execute on function public.current_employee_profile_id() to authenticated;

grant select on public.employee_profiles_public to authenticated;
grant select on public.products_pos to authenticated;

-- low_stock_products roda com security_invoker e le `products`, que o
-- funcionario nao pode ler: para ele a view simplesmente volta vazia. Nao
-- precisa de restricao extra — o RLS ja resolve, e as telas que a usam sao do
-- administrador de qualquer forma.
grant select on public.low_stock_products to authenticated;

-- customer_credit_balance e o caso oposto: precisa ser calculada corretamente
-- tambem para o funcionario, senao ele venderia fiado sem enxergar o quanto a
-- pessoa ja deve. Ela expoe divida de cliente, nao faturamento da loja.
grant select on public.customer_credit_balance to authenticated;
