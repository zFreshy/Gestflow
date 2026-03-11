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
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Create policies
create policy "Users can view their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);
