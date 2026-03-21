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
