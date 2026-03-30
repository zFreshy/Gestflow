<div align="center">
  <h1>Gestflow</h1>
  <p>Gestão de finanças pessoais com Web (React + Vite) e Mobile (Expo/React Native), integrados ao Supabase</p>
</div>

## Visão Geral

Gestflow é um aplicativo de gestão financeira com duas interfaces:
- Web: aplicação React com Vite e Tailwind, pronta para deploy (ex.: Vercel).
- Mobile: app Expo/React Native com autenticação e calendário, focado em uso offline-friendly e UX nativa.

Backend e autenticação são fornecidos via Supabase.

## Principais Funcionalidades

- Autenticação de usuários (Supabase)
- Dashboard com estatísticas, gráficos e indicadores
- Lançamentos de transações (receitas e despesas)
- Parcelamentos e recorrências
- Calendário de transações (cruzamento por dia)
- Filtros por método de pagamento, período e status
- Web e Mobile compartilham o mesmo backend e o mesmo modelo de dados

## Arquitetura do Repositório

```
meuSogro/
├─ src/                # App Web (React + Vite)
├─ mobile/             # App Mobile (Expo/React Native)
├─ supabase_schema.sql # Esquema inicial do banco
├─ .env.example        # Variáveis de ambiente (Web)
└─ ...
```

## Stack Técnica

- Web: React 19, Vite 7, Tailwind CSS, React Router, Recharts
- Mobile: Expo 54, React Native 0.81, NativeWind, react-native-calendars
- Backend: Supabase (Auth + Postgres)
- Qualidade: ESLint

## Requisitos

- Node.js LTS
- Conta Supabase (URL e Anon Key)
- npm (ou pnpm/yarn, adaptando os comandos)
- Para Mobile: ambiente Expo configurado

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Aplique o esquema do banco usando o arquivo `supabase_schema.sql` (rodando o SQL no editor do Supabase).
3. Obtenha as credenciais:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY

## Variáveis de Ambiente

Web (arquivo `.env` na raiz, copie de `.env.example`):
```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Mobile (variáveis de ambiente públicas do Expo; defina no shell antes de iniciar o app):
```
EXPO_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Observação: variáveis que começam com `EXPO_PUBLIC_` ficam embutidas no bundle do app. Use apenas chaves públicas do Supabase.

## Executando o Projeto (Web)

Na raiz do repositório:
```bash
npm install
npm run dev
```

Aplicação disponível em `http://localhost:5173` (porta padrão do Vite).

Build de produção:
```bash
npm run build
```

Pré-visualização do build:
```bash
npm run preview
```

Lint:
```bash
npm run lint
```

## Executando o Projeto (Mobile)

No diretório `mobile/`:
```bash
cd mobile
npm install
# defina as variáveis no shell (exemplo)
# Windows PowerShell:
# $env:EXPO_PUBLIC_SUPABASE_URL="https://..."
# $env:EXPO_PUBLIC_SUPABASE_ANON_KEY="..."
npm run start
```

Abra o app no Expo Go (ou emulador). Garanta que o dispositivo e o computador estejam na mesma rede.

Executar no Android/iOS nativo (requer toolchain configurada):
```bash
npm run android
npm run ios
```

## Padrões Importantes

- Datas no Mobile: todas as datas exibidas/agrupadas no calendário são normalizadas como strings `YYYY-MM-DD` (evitando desvios de timezone).
- Atualização em massa no Web: ações que impactam várias transações (ex.: finalizar/reabrir série) devem disparar um `fetchTransactions()` completo para manter o estado consistente.

## Estrutura de Diretórios (Resumo)

- Web
  - `src/components/` atoms, molecules, organisms e pages
  - `src/contexts/AuthContext.jsx` autenticação
  - `src/lib/supabase.js` inicialização do cliente Supabase
  - `src/components/organisms/CalendarGrid.jsx` grid e agrupamento de calendário
- Mobile
  - `mobile/src/pages/` telas principais (Dashboard, Transactions, Calendar, etc.)
  - `mobile/src/contexts/AuthContext.jsx` autenticação
  - `mobile/src/lib/supabase.js` cliente Supabase com AsyncStorage
  - `mobile/src/services/transactionService.js` integração com API/banco

## Deploy

- Web: compatível com Vercel (arquivo `vercel.json` presente). Configure as variáveis `VITE_SUPABASE_*` no painel da Vercel.
- Mobile: para builds de distribuição, utilize EAS Build ou as ferramentas nativas, definindo `EXPO_PUBLIC_SUPABASE_*` no ambiente de build.

## Contribuição

1. Crie uma branch a partir de `main`.
2. Siga os padrões de código do projeto e rode `npm run lint` no Web.
3. Teste localmente no Web e no Mobile antes de abrir PR.

## Licença

Uso interno. Ajuste a seção conforme sua necessidade de distribuição.
