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

-- ----------------------------------------------------------------------------
-- CAIXA: abertura, fechamento e conferencia
--
-- Um turno de caixa. `opening_amount` e o troco que entrou na gaveta na
-- abertura; `counted_amount` e o que a pessoa contou na hora de fechar.
--
-- A diferenca nao e informada por ninguem: e calculada, e guardada junto com o
-- que o sistema esperava. Guardar o esperado congelado importa porque um
-- estorno de venda feito depois mudaria a conta e o fechamento de ontem
-- passaria a "bater" sozinho, escondendo a falta que existiu no dia.
-- ----------------------------------------------------------------------------
create table if not exists public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  opened_at       timestamptz not null default now(),
  opening_amount  numeric(10,2) not null default 0 check (opening_amount >= 0),
  opened_by       uuid references auth.users,
  opened_by_email text,
  closed_at       timestamptz,
  counted_amount  numeric(10,2),                       -- o que foi contado na gaveta
  expected_amount numeric(10,2),                       -- o que o sistema esperava, congelado
  difference      numeric(10,2),                       -- contado - esperado (sobra + / falta -)
  closed_by       uuid references auth.users,
  closed_by_email text,
  opening_note    text,
  closing_note    text,
  created_at      timestamptz not null default now()
);

create index if not exists cash_sessions_opened_idx on public.cash_sessions (opened_at desc);

-- So um caixa aberto por vez. Dois abertos ao mesmo tempo tornariam impossivel
-- dizer a qual turno uma venda pertence, e a conferencia perderia o sentido.
create unique index if not exists cash_sessions_single_open_idx
  on public.cash_sessions ((closed_at is null))
  where closed_at is null;

-- ----------------------------------------------------------------------------
-- SANGRIA E SUPRIMENTO
--
-- Dinheiro que sai da gaveta sem ser troco (sangria: leva pro cofre, paga o
-- entregador) ou que entra sem ser venda (suprimento: reforco de troco).
--
-- Sem isso, todo dinheiro tirado durante o dia viraria "falta" no fechamento e
-- o operador seria cobrado por algo que ele registrou verbalmente com o dono.
-- ----------------------------------------------------------------------------
create table if not exists public.cash_movements (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.cash_sessions(id) on delete cascade,
  kind         text not null check (kind in ('sangria', 'suprimento')),
  amount       numeric(10,2) not null check (amount > 0),
  reason       text not null,
  happened_at  timestamptz not null default now(),
  user_id      uuid references auth.users,
  user_email   text,
  created_at   timestamptz not null default now()
);

create index if not exists cash_movements_session_idx on public.cash_movements (session_id);

-- ----------------------------------------------------------------------------
-- Colunas de venda que dependem das tabelas acima
-- ----------------------------------------------------------------------------

-- `client_uuid`: identificador que o PDV gera ANTES de tentar enviar. E o que
-- permite reenviar uma venda offline sem medo de duplicar — ver create_sale.
alter table public.sales
  add column if not exists client_uuid     uuid,
  add column if not exists sold_offline    boolean not null default false,
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;

create unique index if not exists sales_client_uuid_key
  on public.sales (client_uuid)
  where client_uuid is not null;

create index if not exists sales_cash_session_idx on public.sales (cash_session_id);

-- ----------------------------------------------------------------------------
-- NOTA FISCAL (NFC-e, modelo 65)
--
-- Dados do emitente. Linha unica: a loja e uma so. `id` fixo em 1 para que o
-- app leia sem precisar saber de qual linha se trata, e para que ninguem crie
-- uma segunda configuracao por engano.
--
-- O que NAO mora aqui, de proposito: o token do emissor e o CSC da SEFAZ. Os
-- dois assinam nota em nome da loja, e esta tabela e legivel pelo app instalado
-- na maquina — eles ficam no segredo da Edge Function, no servidor.
-- ----------------------------------------------------------------------------
create table if not exists public.fiscal_settings (
  id              smallint primary key default 1 check (id = 1),
  enabled         boolean not null default false,
  environment     text not null default 'homologacao'
                    check (environment in ('homologacao', 'producao')),
  cnpj            text,
  inscricao_estadual text,
  razao_social    text,
  nome_fantasia   text,
  regime_tributario text not null default 'simples'   -- simples | simples_excesso | normal
                    check (regime_tributario in ('simples', 'simples_excesso', 'normal')),
  logradouro      text,
  numero          text,
  bairro          text,
  municipio       text,
  codigo_municipio text,                              -- IBGE, 7 digitos
  uf              text,
  cep             text,
  telefone        text,
  serie           integer not null default 1,
  -- Padrao aplicado ao produto que nao tem o campo preenchido. Sem isso, cada
  -- um dos milhares de itens do mercadinho teria que ser classificado a mao
  -- antes da primeira nota sair.
  ncm_padrao      text default '21069090',
  cfop_padrao     text default '5102',
  csosn_padrao    text default '102',
  cst_padrao      text default '00',
  origem_padrao   smallint not null default 0,
  updated_at      timestamptz not null default now()
);

-- Campos fiscais do produto. Ficam em `products` e nao numa tabela a parte
-- porque sao atributos do item, e a nota precisa deles item a item.
alter table public.products
  add column if not exists ncm    text,
  add column if not exists cfop   text,
  add column if not exists cest   text,
  add column if not exists csosn  text,
  add column if not exists cst    text,
  add column if not exists origem smallint;

-- ----------------------------------------------------------------------------
-- NOTAS EMITIDAS
--
-- Uma linha por tentativa de emissao de uma venda. `ref` e a referencia unica
-- mandada ao emissor: reenviar a mesma ref devolve a nota que ja existe em vez
-- de emitir outra — mesma ideia do `client_uuid` da venda, agora do lado
-- fiscal, onde duplicar custaria uma nota a ser cancelada.
--
-- `chave`, `protocolo`, `qrcode` e `xml_url` sao o que a SEFAZ devolveu. Sao
-- guardados porque a reimpressao do cupom sai deles: reimprimir NAO e emitir de
-- novo, e sim imprimir outra vez a nota que ja existe.
-- ----------------------------------------------------------------------------
create table if not exists public.fiscal_invoices (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id) on delete cascade,
  ref           text not null unique,
  status        text not null default 'processando'
                  check (status in ('processando', 'autorizada', 'rejeitada', 'cancelada', 'erro')),
  numero        integer,
  serie         integer,
  chave         text,
  protocolo     text,
  qrcode        text,
  url_consulta  text,
  xml_url       text,
  danfe_url     text,
  mensagem      text,                                  -- motivo da rejeicao, quando houver
  ambiente      text,
  cpf           text,                                  -- do consumidor, quando ele pede na nota
  emitted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists fiscal_invoices_sale_idx   on public.fiscal_invoices (sale_id);
create index if not exists fiscal_invoices_status_idx on public.fiscal_invoices (status);

-- ============================================================================
-- TRANCA TUDO, AGORA
--
-- Isto fica aqui em cima, logo depois das tabelas, e nao junto das policies la
-- embaixo, por um motivo aprendido do jeito ruim: se o script parar no meio por
-- qualquer erro, o que vem depois nao roda. Com o `enable` no fim, uma falha
-- deixava as tabelas criadas e SEM RLS — e o Supabase concede leitura para
-- `anon` por padrao, entao o banco inteiro ficava legivel por qualquer um que
-- tivesse a chave publica (que viaja dentro do app instalado).
--
-- Ligando o RLS aqui, tabela sem policy nega tudo. Uma falha no meio passa a
-- resultar em app quebrado, que se percebe na hora, em vez de banco aberto, que
-- ninguem percebe.
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
alter table public.cash_sessions     enable row level security;
alter table public.cash_movements    enable row level security;
alter table public.fiscal_settings   enable row level security;
alter table public.fiscal_invoices   enable row level security;

-- As views sao trancadas uma a uma, logo depois de cada CREATE VIEW — nao aqui.
-- Elas ainda nem existem neste ponto, e um revoke em objeto inexistente e um
-- no-op silencioso: a view nasceria depois ja com o privilegio padrao do
-- Supabase, aberta para `anon`.

-- Nenhuma tabela deste app deve ser alcancavel sem login.
revoke all on public.products          from anon;
revoke all on public.sales             from anon;
revoke all on public.sale_items        from anon;
revoke all on public.sale_payments     from anon;
revoke all on public.stock_entries     from anon;
revoke all on public.customers         from anon;
revoke all on public.credit_payments   from anon;
revoke all on public.employee_credits  from anon;
revoke all on public.employee_profiles from anon;
revoke all on public.cash_sessions     from anon;
revoke all on public.cash_movements    from anon;
revoke all on public.fiscal_settings   from anon;
revoke all on public.fiscal_invoices   from anon;

-- E o `authenticated` recebe explicitamente.
--
-- As tabelas antigas herdaram esse privilegio do padrao que o Supabase aplica a
-- tabela nova no schema public. Depender desse padrao e apostar numa
-- configuracao que nao esta escrita em lugar nenhum: o dia em que o projeto for
-- recriado com outro padrao, ou restaurado de um dump, as telas voltam vazias
-- com "permission denied" e ninguem liga o erro a esta linha que nao existe.
--
-- Quem filtra linha continua sendo o RLS logo abaixo; isto so abre a porta da
-- tabela para o papel de quem esta logado.
grant select, insert, update, delete on public.cash_sessions   to authenticated;
grant select, insert, update, delete on public.cash_movements  to authenticated;
grant select, insert, update, delete on public.fiscal_settings to authenticated;
grant select, insert, update, delete on public.fiscal_invoices to authenticated;

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
-- VALOR DA EPOCA: o que ja foi gravado nao muda mais
--
-- O preco de um produto e de hoje. O que o funcionario pegou em marco e o que
-- o cliente levou fiado em abril valem o preco daquele dia, nao o de agora.
--
-- Metade disso o modelo ja resolvia guardando o valor na linha (snapshot).
-- A outra metade faltava: nada impedia um UPDATE de mexer nesse valor depois.
-- Bastava um "corrigir preco" mal feito na tela, ou um `update` corrido no SQL
-- Editor, para a divida de abril virar outra coisa — sem erro nenhum e sem
-- ninguem perceber, porque nao existe copia do valor original.
--
-- Estes gatilhos fecham essa porta. O que pode mudar em cada tabela e uma lista
-- curta e explicita; o resto e recusado com uma mensagem que diz o que fazer.
-- ============================================================================

-- Consumo do funcionario ------------------------------------------------------
-- Muda so a situacao do acerto (`settled_at`) e a observacao. Produto,
-- quantidade, preco, total e data ficam como estavam no dia.
create or replace function public.freeze_employee_credit()
returns trigger
language plpgsql
as $$
begin
  if new.product_id   is distinct from old.product_id
     or new.barcode      is distinct from old.barcode
     or new.product_name is distinct from old.product_name
     or new.quantity     is distinct from old.quantity
     or new.unit_price   is distinct from old.unit_price
     or new.total        is distinct from old.total
     or new.taken_at     is distinct from old.taken_at
     or new.employee_profile_id is distinct from old.employee_profile_id
  then
    raise exception
      'O valor de um consumo ja lancado nao muda: ele vale o preco do dia em que o produto foi pego. Para corrigir, apague o lancamento e faca outro.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_freeze_employee_credit on public.employee_credits;
create trigger trg_freeze_employee_credit
  before update on public.employee_credits
  for each row execute function public.freeze_employee_credit();

-- Itens da venda --------------------------------------------------------------
-- Nada muda. O item vendido e um fato do passado; corrigir venda errada e
-- estornar e vender de novo, que devolve o estoque pelo caminho certo.
create or replace function public.freeze_sale_row()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Venda registrada nao se edita: os valores sao os do momento da compra. Para corrigir, estorne a venda e registre de novo.'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_freeze_sale_items on public.sale_items;
create trigger trg_freeze_sale_items
  before update on public.sale_items
  for each row execute function public.freeze_sale_row();

-- Pagamentos da venda ---------------------------------------------------------
-- E daqui que sai a divida do fiado: `customer_credit_balance` soma
-- exatamente estas linhas. Deixar o valor mudar seria deixar a divida do
-- cliente mudar sozinha depois da compra — que e o problema todo.
drop trigger if exists trg_freeze_sale_payments on public.sale_payments;
create trigger trg_freeze_sale_payments
  before update on public.sale_payments
  for each row execute function public.freeze_sale_row();

-- Cabecalho da venda ----------------------------------------------------------
-- Aqui a lista de permitidos nao e vazia: a nota fiscal e emitida depois da
-- venda fechada e precisa gravar o vinculo. Dinheiro, itens e data continuam
-- congelados.
create or replace function public.freeze_sale_header()
returns trigger
language plpgsql
as $$
begin
  if new.total          is distinct from old.total
     or new.cost_total     is distinct from old.cost_total
     or new.discount       is distinct from old.discount
     or new.item_count     is distinct from old.item_count
     or new.payment_method is distinct from old.payment_method
     or new.sold_at        is distinct from old.sold_at
     or new.customer_id    is distinct from old.customer_id
     or new.client_uuid    is distinct from old.client_uuid
  then
    raise exception
      'Venda registrada nao se edita: os valores sao os do momento da compra. Para corrigir, estorne a venda e registre de novo.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_freeze_sales on public.sales;
create trigger trg_freeze_sales
  before update on public.sales
  for each row execute function public.freeze_sale_header();

-- Venda com nota autorizada nao se estorna --------------------------------
--
-- O `on delete cascade` de fiscal_invoices apagaria o registro da nota junto
-- com a venda — mas a nota continuaria existindo na SEFAZ, autorizada, no CNPJ
-- da loja. O sistema esqueceria uma nota que o fisco lembra, e o acerto viraria
-- problema meses depois, sem nenhum rastro de onde veio.
--
-- Desfazer nota autorizada e cancelamento junto a SEFAZ, com prazo e
-- justificativa. Enquanto isso nao existir no app, o caminho e barrado aqui.
create or replace function public.block_delete_invoiced_sale()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.fiscal_invoices
              where sale_id = old.id and status = 'autorizada')
  then
    raise exception
      'Esta venda tem nota fiscal autorizada e nao pode ser estornada. Cancele a nota na SEFAZ primeiro.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_block_delete_invoiced_sale on public.sales;
create trigger trg_block_delete_invoiced_sale
  before delete on public.sales
  for each row execute function public.block_delete_invoiced_sale();

-- ============================================================================
-- RPC: lancar consumo do funcionario com o preco do dia
--
-- Antes o app mandava o preco junto e o banco gravava o que chegasse. Duas
-- consequencias: o funcionario podia lancar o proprio consumo com o valor que
-- quisesse (a policy de insert e dele), e um app desatualizado com catalogo
-- velho gravaria um preco que nao era mais o da loja.
--
-- Agora quem le o preco e o banco, no instante do lancamento. E esse valor,
-- congelado pelo gatilho acima, e o que sera descontado no fim do mes — mesmo
-- que o produto mude de preco no dia seguinte.
-- ============================================================================
create or replace function public.create_employee_credit(
  p_product_id uuid,
  p_quantity   numeric,
  p_taken_at   date default null,
  p_note       text default null,
  p_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_product    public.products%rowtype;
  v_price      numeric(10,2);
  v_id         uuid;
begin
  if auth.uid() is null then
    raise exception 'Precisa estar autenticado';
  end if;

  -- O administrador lanca para qualquer um (ele acerta a folha e as vezes
  -- anota pelo funcionario). O funcionario, so para si: ninguem poe consumo na
  -- conta do colega.
  if public.is_admin() then
    v_profile_id := coalesce(p_profile_id, public.current_employee_profile_id());
  else
    v_profile_id := public.current_employee_profile_id();
  end if;

  if v_profile_id is null then
    raise exception 'Nao sei de quem e este consumo';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Informe a quantidade';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Produto nao encontrado';
  end if;
  if not v_product.active then
    raise exception 'Produto inativo';
  end if;

  v_price := v_product.sale_price;

  insert into public.employee_credits (
    employee_profile_id, product_id, barcode, product_name,
    quantity, unit_price, total, taken_at, note
  )
  values (
    v_profile_id, v_product.id, v_product.barcode, v_product.name,
    p_quantity, v_price, round(p_quantity * v_price, 2),
    coalesce(p_taken_at, current_date), nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

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
drop function if exists public.create_sale(jsonb, jsonb, numeric, text, uuid);

create or replace function public.create_sale(
  p_items       jsonb,
  p_payments    jsonb,
  p_discount    numeric default 0,
  p_note        text default null,
  p_customer_id uuid default null,
  p_client_uuid uuid default null,
  p_sold_at     timestamptz default null
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
  v_sold_at    timestamptz;
  v_offline    boolean := false;
  v_session_id uuid;
begin
  -- Cinto e suspensorio: o GRANT ja limita a chamada a quem esta logado, mas a
  -- funcao e SECURITY DEFINER e grava venda — se um dia alguem afrouxar a
  -- permissao sem perceber, esta linha ainda segura.
  if auth.uid() is null then
    raise exception 'Precisa estar autenticado';
  end if;

  -- Venda que ja entrou. A fila de vendas offline reenvia ate ter certeza de
  -- que chegou, e "ter certeza" e justamente o que falta quando a conexao cai
  -- no meio da resposta: o banco gravou, o app nao soube. Sem esta checagem o
  -- reenvio viraria uma segunda venda, com estoque baixado duas vezes.
  --
  -- Devolver o id que ja existe faz o reenvio ser inofensivo, quantas vezes
  -- for preciso.
  if p_client_uuid is not null then
    select id into v_sale_id from public.sales where client_uuid = p_client_uuid;
    if v_sale_id is not null then
      return v_sale_id;
    end if;
  end if;

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

  -- Venda que ficou esperando na fila enquanto a internet estava fora.
  --
  -- So conta como offline se vier com identificador proprio E com uma data
  -- que ja passou faz tempo. Nao e uma tranca (quem chama a API escolhe o que
  -- manda), e sim um limite: o caminho normal do balcao nunca cai aqui por
  -- acidente, e toda venda que cai fica marcada em `sold_offline` para o
  -- administrador conferir.
  v_offline := p_client_uuid is not null
               and p_sold_at is not null
               and p_sold_at < now() - interval '60 seconds';

  -- Data da venda: a de quando ela aconteceu no balcao, nao a de quando a
  -- conexao voltou. Presa entre um mes atras e agora, porque data no futuro
  -- bagunçaria o fechamento do caixa e o historico.
  v_sold_at := least(greatest(coalesce(p_sold_at, now()), now() - interval '30 days'), now());

  -- Precos vem da tabela de produtos, nao do que o app mandou.
  --
  -- O app envia preco junto so para montar a tela; confiar nele deixaria
  -- qualquer um registrar uma venda de R$ 0,01 chamando a API direto. Item sem
  -- product_id (granel, produto nao cadastrado) e a unica excecao, porque nao
  -- ha de onde buscar.
  --
  -- Na venda offline vale o preco que o app mandou, e nao o de agora: o cliente
  -- ja pagou aquele valor e ja levou o cupom. Se o preco do produto mudou
  -- enquanto a loja estava sem internet, recalcular aqui gravaria uma venda que
  -- nunca aconteceu.
  --
  -- O custo continua vindo do cadastro nos dois casos: ele so serve para a
  -- margem do administrador, e o app do funcionario nem enxerga essa coluna.
  select coalesce(sum(qty * price), 0),
         coalesce(sum(qty * cost), 0),
         count(*)
    into v_subtotal, v_cost_total, v_count
    from (
      select (i->>'quantity')::numeric as qty,
             case when v_offline then (i->>'unit_price')::numeric
                  else coalesce(p.sale_price, (i->>'unit_price')::numeric) end as price,
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

  -- Caixa aberto no momento em que a venda entra no banco. Nulo quando ninguem
  -- abriu caixa — o PDV nao para por causa disso; a conferencia e que fica sem
  -- essa venda.
  select id into v_session_id
    from public.cash_sessions
   where closed_at is null
   order by opened_at desc
   limit 1;

  insert into public.sales (sold_at, total, cost_total, discount, payment_method, item_count, note,
                            customer_id, user_id, user_email,
                            client_uuid, sold_offline, cash_session_id)
  values (v_sold_at, v_total, v_cost_total, coalesce(p_discount, 0), v_summary, v_count, p_note,
          p_customer_id, auth.uid(), v_email,
          p_client_uuid, v_offline, v_session_id)
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
         case when v_offline then (item->>'unit_price')::numeric
              else coalesce(p.sale_price, (item->>'unit_price')::numeric) end,
         coalesce(p.cost_price, coalesce((item->>'unit_cost')::numeric, 0)),
         (item->>'quantity')::numeric
           * case when v_offline then (item->>'unit_price')::numeric
                  else coalesce(p.sale_price, (item->>'unit_price')::numeric) end
    from jsonb_array_elements(p_items) as item
    left join public.products p on p.id = nullif(item->>'product_id', '')::uuid;

  insert into public.sale_payments (sale_id, method, amount)
  select v_sale_id, p->>'method', (p->>'amount')::numeric
    from jsonb_array_elements(p_payments) as p;

  return v_sale_id;

-- A checagem no comeco resolve o reenvio normal, mas nao o caso de duas chamadas
-- da mesma venda chegarem ao mesmo tempo: as duas leriam "nao existe" antes de
-- qualquer uma gravar. Quem decide o empate e o indice unico, e o perdedor cai
-- aqui e devolve o id de quem ganhou.
exception
  when unique_violation then
    if p_client_uuid is not null then
      select id into v_sale_id from public.sales where client_uuid = p_client_uuid;
      if v_sale_id is not null then
        return v_sale_id;
      end if;
    end if;
    raise;
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
--
-- DROP antes de criar: `create or replace view` nao aceita renomear nem
-- reordenar coluna, e falha com 42P16 em quem ja tinha a versao anterior.
-- Pela mesma razao ele tambem NAO limpa opcoes antigas da view (como
-- security_invoker), entao recriar do zero e a unica forma de garantir que a
-- definicao no banco e a que esta escrita aqui.
drop view if exists public.employee_profiles_public;
create view public.employee_profiles_public
  with (security_invoker = true)
as
  select id, name, login_email, active, created_at
    from public.employee_profiles
   where active;

revoke all on public.employee_profiles_public from anon, authenticated;
grant select on public.employee_profiles_public to authenticated;

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
--
-- DROP antes de criar porque `create or replace` mantem as opcoes que a view ja
-- tinha: quem rodou a versao anterior ficaria com security_invoker ligado, e o
-- saldo apareceria zerado para o funcionario sem nenhum erro na tela.
drop view if exists public.customer_credit_balance;
create view public.customer_credit_balance as
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

-- Roda como dono para conseguir somar `sale_payments`, entao o GRANT e o unico
-- controle: sem este revoke, a divida de todos os clientes ficaria legivel sem
-- login.
revoke all on public.customer_credit_balance from anon, authenticated;
grant select on public.customer_credit_balance to authenticated;

-- security_invoker: sem isso a view rodaria com os poderes do dono e passaria
-- por cima do RLS de `products`. Como so o administrador le `products`, para o
-- funcionario ela volta vazia — que e o desejado.
drop view if exists public.low_stock_products;
create view public.low_stock_products
  with (security_invoker = true)
as
  select p.*,
         (p.min_stock - p.stock_quantity) as missing_quantity
    from public.products p
   where p.active
     and p.min_stock > 0
     and p.stock_quantity <= p.min_stock;

revoke all on public.low_stock_products from anon, authenticated;
grant select on public.low_stock_products to authenticated;

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
-- O RLS ja foi ligado la em cima, logo depois das tabelas, para o script falhar
-- fechado se parar no meio. Aqui so vem quem pode fazer o que.

-- Limpa as policies permissivas da versao anterior, em que todo mundo via tudo.
do $$
declare
  t text;
  p text;
begin
  foreach t in array array['products', 'sales', 'sale_items', 'sale_payments',
                           'stock_entries', 'customers', 'credit_payments',
                           'employee_credits', 'employee_profiles',
                           'cash_sessions', 'cash_movements',
                           'fiscal_settings', 'fiscal_invoices'] loop
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
drop view if exists public.products_pos;
create view public.products_pos as
  select id, barcode, name, unit, sale_price, stock_quantity, min_stock,
         category, supplier_id, active
    from public.products
   where active;

-- Trancada aqui mesmo, e nao no fim do arquivo: esta view roda como dono e
-- atravessa o RLS de propósito, entao o GRANT e o unico controle que ela tem.
-- Deixar para depois abriria uma janela em que ela existe com o privilegio
-- padrao do Supabase — ou seja, legivel sem login.
revoke all on public.products_pos from anon, authenticated;
grant select on public.products_pos to authenticated;

-- ----------------------------------------------------------------------------
-- CLIENTES: os dois lados leem e cadastram
--
-- Vender fiado no balcao e trabalho de caixa, e para isso o funcionario precisa
-- escolher o cliente — ou cadastrar na hora, se for a primeira compra dele.
-- Nome e telefone de cliente nao revelam nada do financeiro da loja.
-- Alterar e apagar continuam com o administrador.
-- ----------------------------------------------------------------------------
create policy "auth_select_customers" on public.customers
  for select to authenticated using (true);
create policy "auth_insert_customers" on public.customers
  for insert to authenticated with check (true);
create policy "admin_update_customers" on public.customers
  for update to authenticated using (public.is_admin());
create policy "admin_delete_customers" on public.customers
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- RECEBIMENTO DE FIADO: so administrador
--
-- Registrar que alguem pagou a divida e mexer em dinheiro que entrou. Deixar
-- isso na mao do funcionario abriria o caminho mais obvio de desvio: dar a
-- divida por paga sem o dinheiro ter entrado no caixa.
-- ----------------------------------------------------------------------------
create policy "admin_select_credit_payments" on public.credit_payments
  for select to authenticated using (public.is_admin());
create policy "admin_insert_credit_payments" on public.credit_payments
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_credit_payments" on public.credit_payments
  for update to authenticated using (public.is_admin());
create policy "admin_delete_credit_payments" on public.credit_payments
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- CREDITO DA LOJA: cada funcionario so enxerga o proprio consumo
-- ----------------------------------------------------------------------------
create policy "emp_select_employee_credits" on public.employee_credits
  for select to authenticated
  using (public.is_admin() or employee_profile_id = public.current_employee_profile_id());

-- Insercao direta so do administrador. O funcionario lanca pelo
-- `create_employee_credit`, que roda como dono e passa por cima desta policy.
--
-- A diferenca importa: pela policy o funcionario escolheria o valor do proprio
-- consumo, porque `unit_price` e `total` viriam do app. Pela funcao, quem le o
-- preco e o banco. Fechar o caminho direto e o que torna a funcao a unica
-- porta — deixar os dois abertos seria o mesmo que nao ter fechado nada.
create policy "admin_insert_employee_credits" on public.employee_credits
  for insert to authenticated
  with check (public.is_admin());

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
-- Leitura liberada para quem esta logado: depois que a senha saiu daqui (ela
-- vive no auth.users), a tabela guarda so nome, e-mail de login e situacao —
-- nada que um colega nao veja no dia a dia. E o seletor de perfil precisa
-- listar todo mundo para permitir a troca.
create policy "auth_select_employee_profiles" on public.employee_profiles
  for select to authenticated using (true);
create policy "admin_insert_employee_profiles" on public.employee_profiles
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_employee_profiles" on public.employee_profiles
  for update to authenticated using (public.is_admin());
create policy "admin_delete_employee_profiles" on public.employee_profiles
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- CAIXA: so administrador, ponto
--
-- Abrir, sangrar e fechar caixa e conferir dinheiro — o oposto do que se
-- delega a quem opera o caixa. O funcionario continua vendendo normalmente; a
-- venda dele entra no turno aberto sem que ele precise (ou consiga) ver o
-- turno.
--
-- Sem policy de delete: turno de caixa nao se apaga. Fechamento que some leva
-- junto a prova da falta que apareceu naquele dia.
-- ----------------------------------------------------------------------------
create policy "admin_select_cash_sessions" on public.cash_sessions
  for select to authenticated using (public.is_admin());
create policy "admin_insert_cash_sessions" on public.cash_sessions
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_cash_sessions" on public.cash_sessions
  for update to authenticated using (public.is_admin());

create policy "admin_select_cash_movements" on public.cash_movements
  for select to authenticated using (public.is_admin());
create policy "admin_insert_cash_movements" on public.cash_movements
  for insert to authenticated with check (public.is_admin());
create policy "admin_delete_cash_movements" on public.cash_movements
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- FISCAL
--
-- A configuracao do emitente e legivel por quem esta logado porque o cupom
-- impresso mostra CNPJ, razao social e endereco da loja — dados que ja saem
-- impressos no papel que o cliente leva. Mexer nela e do administrador.
--
-- As notas emitidas so o administrador le: elas carregam o valor de cada venda.
-- Quem emite e a Edge Function, com poderes de servico, entao o funcionario
-- consegue emitir a nota da venda que acabou de fazer sem enxergar nenhuma.
-- ----------------------------------------------------------------------------
create policy "auth_select_fiscal_settings" on public.fiscal_settings
  for select to authenticated using (true);
create policy "admin_insert_fiscal_settings" on public.fiscal_settings
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_fiscal_settings" on public.fiscal_settings
  for update to authenticated using (public.is_admin());

create policy "admin_select_fiscal_invoices" on public.fiscal_invoices
  for select to authenticated using (public.is_admin());
create policy "admin_update_fiscal_invoices" on public.fiscal_invoices
  for update to authenticated using (public.is_admin());

-- ============================================================================
-- RPCs DO CAIXA
--
-- Abertura e fechamento passam por funcao, e nao por insert/update direto, por
-- causa do valor esperado: ele tem que ser calculado pelo banco, na hora, a
-- partir das vendas em dinheiro do turno. Calculado no app, seria um numero
-- que o proprio operador manda — e conferencia com numero informado pelo
-- conferido nao confere nada.
-- ============================================================================

/**
 * Quanto o sistema espera na gaveta agora: abertura + dinheiro + suprimentos - sangrias.
 *
 * SECURITY DEFINER para conseguir somar `sale_payments`, que so o administrador
 * le. Por isso mesmo checa o papel por dentro: sem essa checagem, ela seria uma
 * fresta pela qual o funcionario descobriria o dinheiro do dia — bastaria
 * chamar a funcao direto pela API com o id do turno.
 */
create or replace function public.cash_session_expected(p_session_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.is_admin() then null else round(
    coalesce((select opening_amount from public.cash_sessions where id = p_session_id), 0)
    -- So a parte em dinheiro. Cartao, PIX e fiado nao passam pela gaveta.
    + coalesce((select sum(sp.amount)
                  from public.sale_payments sp
                  join public.sales s on s.id = sp.sale_id
                 where s.cash_session_id = p_session_id
                   and sp.method = 'Dinheiro'), 0)
    + coalesce((select sum(amount) from public.cash_movements
                 where session_id = p_session_id and kind = 'suprimento'), 0)
    - coalesce((select sum(amount) from public.cash_movements
                 where session_id = p_session_id and kind = 'sangria'), 0)
  , 2) end;
$$;

create or replace function public.open_cash_session(
  p_opening_amount numeric default 0,
  p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'So o administrador abre o caixa';
  end if;

  if exists (select 1 from public.cash_sessions where closed_at is null) then
    raise exception 'Ja existe um caixa aberto. Feche o atual antes de abrir outro.';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.cash_sessions (opening_amount, opened_by, opened_by_email, opening_note)
  values (coalesce(p_opening_amount, 0), auth.uid(), v_email,
          nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.close_cash_session(
  p_counted_amount numeric,
  p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_expected numeric(10,2);
  v_email    text;
begin
  if not public.is_admin() then
    raise exception 'So o administrador fecha o caixa';
  end if;

  if p_counted_amount is null or p_counted_amount < 0 then
    raise exception 'Informe quanto foi contado na gaveta';
  end if;

  select id into v_id from public.cash_sessions where closed_at is null;
  if v_id is null then
    raise exception 'Nao ha caixa aberto';
  end if;

  -- Congelado agora. Um estorno feito amanha nao pode fazer o fechamento de
  -- hoje passar a bater sozinho.
  v_expected := public.cash_session_expected(v_id);

  select email into v_email from auth.users where id = auth.uid();

  update public.cash_sessions
     set closed_at       = now(),
         counted_amount  = round(p_counted_amount, 2),
         expected_amount = v_expected,
         difference      = round(p_counted_amount, 2) - v_expected,
         closed_by       = auth.uid(),
         closed_by_email = v_email,
         closing_note    = nullif(btrim(coalesce(p_note, '')), '')
   where id = v_id;

  return v_id;
end;
$$;

create or replace function public.add_cash_movement(
  p_kind   text,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
  v_id      uuid;
  v_email   text;
begin
  if not public.is_admin() then
    raise exception 'So o administrador registra sangria e suprimento';
  end if;

  if p_kind not in ('sangria', 'suprimento') then
    raise exception 'Movimento invalido';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe o valor';
  end if;

  -- Motivo obrigatorio: e o unico registro de para onde o dinheiro foi. Sem
  -- ele a sangria vira so um buraco no caixa com carimbo oficial.
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Escreva o motivo';
  end if;

  select id into v_session from public.cash_sessions where closed_at is null;
  if v_session is null then
    raise exception 'Abra o caixa antes de registrar movimento';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.cash_movements (session_id, kind, amount, reason, user_id, user_email)
  values (v_session, p_kind, round(p_amount, 2), btrim(p_reason), auth.uid(), v_email)
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- VIEW: turnos de caixa com a conferencia pronta
--
-- Turno aberto mostra o esperado calculado agora; turno fechado mostra o que
-- foi congelado no fechamento. Assim a mesma tela serve para acompanhar o dia
-- e para revisar o passado, sem que o passado se mexa.
-- ============================================================================
drop view if exists public.cash_session_summary;
create view public.cash_session_summary
  with (security_invoker = true)
as
  select cs.*,
         coalesce((select sum(sp.amount)
                     from public.sale_payments sp
                     join public.sales s on s.id = sp.sale_id
                    where s.cash_session_id = cs.id
                      and sp.method = 'Dinheiro'), 0)              as cash_sales,
         coalesce((select sum(s.total) from public.sales s
                    where s.cash_session_id = cs.id), 0)           as sales_total,
         coalesce((select count(*) from public.sales s
                    where s.cash_session_id = cs.id), 0)           as sales_count,
         coalesce((select sum(amount) from public.cash_movements
                    where session_id = cs.id and kind = 'sangria'), 0)    as withdrawals,
         coalesce((select sum(amount) from public.cash_movements
                    where session_id = cs.id and kind = 'suprimento'), 0) as deposits,
         case when cs.closed_at is null
              then public.cash_session_expected(cs.id)
              else cs.expected_amount
         end                                                       as expected_now
    from public.cash_sessions cs;

revoke all on public.cash_session_summary from anon, authenticated;
grant select on public.cash_session_summary to authenticated;

-- ============================================================================
-- DASHBOARD
--
-- Contas prontas para a tela do administrador. Poderiam ser feitas no app, e
-- eram: ele baixava as vendas do mes e somava em memoria. Isso funciona com
-- uma loja pequena e para de funcionar sem avisar — um mercadinho movimentado
-- faz umas 300 vendas por dia, e o termometro de 12 semanas precisaria de
-- ~25 mil linhas trafegadas para desenhar 84 quadradinhos.
--
-- Aqui o banco devolve so o resultado. Cada funcao checa `is_admin()` por
-- dentro, e nao apenas confia no GRANT: sao numeros de faturamento e lucro, o
-- que o funcionario justamente nao pode ver, e SECURITY DEFINER passa por cima
-- do RLS de `sales` de proposito para conseguir somar.
-- ============================================================================

/** Totais do periodo. Chamado duas vezes pela tela, para comparar com o anterior. */
create or replace function public.dashboard_totals(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  revenue      numeric,
  cost         numeric,
  profit       numeric,
  discount     numeric,
  sale_count   bigint,
  item_count   numeric,
  avg_ticket   numeric,
  offline_count bigint,
  invoiced_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(s.total), 0),
         coalesce(sum(s.cost_total), 0),
         coalesce(sum(s.total - s.cost_total), 0),
         coalesce(sum(s.discount), 0),
         count(*),
         coalesce(sum(s.item_count), 0),
         -- Ticket medio precisa da divisao protegida: periodo sem venda
         -- nenhuma daria divisao por zero e a tela inteira quebraria.
         case when count(*) = 0 then 0 else round(sum(s.total) / count(*), 2) end,
         count(*) filter (where s.sold_offline),
         count(*) filter (where exists (
           select 1 from public.fiscal_invoices f
            where f.sale_id = s.id and f.status = 'autorizada'
         ))
    from public.sales s
   where public.is_admin()
     and s.sold_at >= p_from
     and s.sold_at <= p_to;
$$;

/**
 * Faturamento por dia.
 *
 * `generate_series` preenche os dias sem venda com zero. Sem isso o grafico
 * ligaria segunda direto em quarta como se terca nao existisse, e o termometro
 * de 12 semanas ficaria com buracos no lugar dos dias parados.
 */
create or replace function public.dashboard_daily(
  p_from date,
  p_to   date
)
returns table (
  day        date,
  revenue    numeric,
  cost       numeric,
  profit     numeric,
  sale_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select d::date,
         coalesce(sum(s.total), 0),
         coalesce(sum(s.cost_total), 0),
         coalesce(sum(s.total - s.cost_total), 0),
         count(s.id)
    from generate_series(p_from, p_to, interval '1 day') as d
    left join public.sales s
      -- Fuso de Sao Paulo, e nao UTC: uma venda das 21h entraria no dia
      -- seguinte e o faturamento do sabado apareceria no domingo.
      on (s.sold_at at time zone 'America/Sao_Paulo')::date = d::date
   where public.is_admin()
   group by d
   order by d;
$$;

/**
 * Vendas por hora do dia, somando todos os dias do periodo.
 *
 * E o que responde "a que horas a loja enche" — a pergunta que decide escala de
 * funcionario e hora de assar mais pao.
 */
create or replace function public.dashboard_hourly(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  hour       integer,
  revenue    numeric,
  sale_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select h::integer,
         coalesce(sum(s.total), 0),
         count(s.id)
    from generate_series(0, 23) as h
    left join public.sales s
      on extract(hour from s.sold_at at time zone 'America/Sao_Paulo') = h
     and s.sold_at >= p_from
     and s.sold_at <= p_to
   where public.is_admin()
   group by h
   order by h;
$$;

/** Quanto entrou por forma de pagamento. Sai do detalhe, nao do resumo textual. */
create or replace function public.dashboard_payment_mix(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  method text,
  amount numeric,
  uses   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.method,
         sum(sp.amount),
         count(*)
    from public.sale_payments sp
    join public.sales s on s.id = sp.sale_id
   where public.is_admin()
     and s.sold_at >= p_from
     and s.sold_at <= p_to
   group by sp.method
   order by sum(sp.amount) desc;
$$;

/**
 * Ranking de produtos, com quantidade E lucro.
 *
 * Os dois juntos porque nao sao a mesma lista: o item mais vendido costuma ser
 * o de margem menor (pao, leite), e quem paga as contas e outro. Ver so a
 * quantidade esconde isso.
 */
create or replace function public.dashboard_top_products(
  p_from  timestamptz,
  p_to    timestamptz,
  p_limit integer default 8
)
returns table (
  product_name text,
  quantity     numeric,
  revenue      numeric,
  profit       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select si.product_name,
         sum(si.quantity),
         sum(si.subtotal),
         sum(si.subtotal - (si.unit_cost * si.quantity))
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
   where public.is_admin()
     and s.sold_at >= p_from
     and s.sold_at <= p_to
   group by si.product_name
   order by sum(si.subtotal) desc
   limit greatest(coalesce(p_limit, 8), 1);
$$;

-- ============================================================================
-- GRANTS
--
-- O Postgres da EXECUTE de funcao para PUBLIC por padrao, e PUBLIC inclui o
-- papel `anon`. Como estas funcoes sao SECURITY DEFINER, isso significava que
-- daria para chamar create_sale sem sequer estar logado. Cada uma e revogada
-- e so devolvida a quem precisa.
--
-- As tres funcoes de trigger nao recebem grant nenhum: o trigger as executa
-- pelo mecanismo interno, ninguem precisa poder chama-las direto.
-- ============================================================================
-- `from public, anon`: os dois sao necessarios. PUBLIC e o padrao do Postgres;
-- o `anon` o Supabase concede EXPLICITAMENTE, e revogar de PUBLIC nao apaga uma
-- concessao nominal. Medido: so com `from public`, is_admin() ainda respondia
-- para quem nao estava logado.
revoke all on function public.create_sale(jsonb, jsonb, numeric, text, uuid, uuid, timestamptz) from public, anon;
revoke all on function public.create_employee_credit(uuid, numeric, date, text, uuid) from public, anon;
revoke all on function public.open_cash_session(numeric, text) from public, anon;
revoke all on function public.close_cash_session(numeric, text) from public, anon;
revoke all on function public.add_cash_movement(text, numeric, text) from public, anon;
revoke all on function public.cash_session_expected(uuid) from public, anon;
revoke all on function public.dashboard_totals(timestamptz, timestamptz) from public, anon;
revoke all on function public.dashboard_daily(date, date) from public, anon;
revoke all on function public.dashboard_hourly(timestamptz, timestamptz) from public, anon;
revoke all on function public.dashboard_payment_mix(timestamptz, timestamptz) from public, anon;
revoke all on function public.dashboard_top_products(timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_employee() from public, anon;
revoke all on function public.current_employee_profile_id() from public, anon;
revoke all on function public.apply_sale_item_stock() from public, anon;
revoke all on function public.apply_stock_entry() from public, anon;
revoke all on function public.apply_employee_credit_stock() from public, anon;
revoke all on function public.freeze_employee_credit() from public, anon;
revoke all on function public.freeze_sale_row() from public, anon;
revoke all on function public.freeze_sale_header() from public, anon;
revoke all on function public.block_delete_invoiced_sale() from public, anon;

grant execute on function public.create_sale(jsonb, jsonb, numeric, text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.create_employee_credit(uuid, numeric, date, text, uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_employee() to authenticated;
grant execute on function public.current_employee_profile_id() to authenticated;

-- As do caixa checam is_admin() por dentro e ainda assim so o logado alcanca:
-- a checagem interna e o que vale, o grant e a primeira porta.
grant execute on function public.open_cash_session(numeric, text) to authenticated;
grant execute on function public.close_cash_session(numeric, text) to authenticated;
grant execute on function public.add_cash_movement(text, numeric, text) to authenticated;
grant execute on function public.cash_session_expected(uuid) to authenticated;

-- As do dashboard tambem checam is_admin() por dentro: para o funcionario elas
-- respondem vazio, e nao com erro — a tela dele simplesmente nao as chama.
grant execute on function public.dashboard_totals(timestamptz, timestamptz) to authenticated;
grant execute on function public.dashboard_daily(date, date) to authenticated;
grant execute on function public.dashboard_hourly(timestamptz, timestamptz) to authenticated;
grant execute on function public.dashboard_payment_mix(timestamptz, timestamptz) to authenticated;
grant execute on function public.dashboard_top_products(timestamptz, timestamptz, integer) to authenticated;

-- `cash_session_expected` e usada dentro da view `cash_session_summary`, que e
-- security_invoker: sem este grant a tela do caixa abriria com erro de
-- permissao mesmo para o administrador.

-- ============================================================================
-- CONFIGURACAO FISCAL: a linha unica precisa existir
--
-- A tela le e atualiza a linha 1. Se ela nao existir, o UPDATE nao acha nada e
-- a configuracao some sem erro — o app diria "salvo" e nada teria sido salvo.
-- ============================================================================
insert into public.fiscal_settings (id) values (1) on conflict (id) do nothing;

-- As quatro views ja foram revogadas de `anon` e liberadas para
-- `authenticated` logo apos cada CREATE VIEW, e nao aqui: entre a criacao e o
-- fim do arquivo elas ficariam abertas se o script parasse no meio.
