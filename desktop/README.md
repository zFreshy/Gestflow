# Mercadinho — app desktop

PDV com leitor de código de barras e controle de estoque para o mercadinho.
App nativo de Windows feito com **Tauri v2** (React + Vite + Tailwind por cima
do WebView2 que já vem no Windows).

Usa o **mesmo Supabase** do Gestflow — mesmo login, mesma tabela `suppliers`.
Não mexe em `transactions`: a parte financeira do site continua intacta.

---

## O que ele faz

| Tela | O que resolve |
|---|---|
| **Dashboard** | Vendas do dia e do mês, lucro bruto, gasto com reposição, mais vendidos, alerta de estoque baixo |
| **Venda (PDV)** | Bipa o produto, monta o carrinho, calcula troco e fecha a venda |
| **Produtos** | Cadastro por código de barras, preço de venda, margem, estoque mínimo |
| **Estoque** | Entradas de reposição (as "despesas" do mercadinho) com fornecedor e custo |
| **Fiado** | Quem deve, quanto já pagou, e o recebimento das dívidas |
| **Histórico** | Vendas filtradas por período, forma de pagamento e valor, com estorno |
| **Crédito da loja** | O que cada funcionário pegou para descontar no pagamento |
| **Perfis** | Cria e gerencia os perfis de funcionário |

Formas de pagamento: Dinheiro, PIX, Cartão Débito, Cartão Crédito, Ticket/Vale e
Crédito Loja (o fiado). Uma venda pode ser **dividida em mais de uma forma**
("R$ 25 no ticket e o resto em dinheiro"); o banco recusa se a soma das partes
não fechar com o total.

Em **Produtos → Importar planilha** dá para trazer o cadastro de um sistema
antigo a partir de um CSV. O leitor entende separador `;`, preço com vírgula
(`8,49`) e arquivo em Latin-1 — o que sai de PDV brasileiro costuma ter as três
coisas. As colunas são reconhecidas sozinhas e dá para corrigir na tela antes de
confirmar.

O estoque nunca é editado na mão: **quem mexe nele é o banco**. Toda venda baixa
e toda entrada sobe, via trigger. Assim não existe venda gravada com estoque
desatualizado.

O **preço de custo segue a mesma lógica**: não existe campo para digitá-lo no
cadastro do produto. Ele é o valor pago na última compra, gravado na tela de
Estoque, e o trigger atualiza o produto. Um campo editável no cadastro criaria
uma segunda versão da verdade, e a margem passaria a mentir. A única exceção é a
importação de planilha, que semeia o custo inicial junto com o saldo de estoque
— é migração, não operação do dia a dia.

---

## Primeira vez

### 1. Criar as tabelas

No SQL Editor do Supabase, cole e rode o arquivo [`../mercadinho_schema.sql`](../mercadinho_schema.sql).

Ele cria `products`, `sales`, `sale_items`, `sale_payments`, `stock_entries`,
`customers` e `credit_payments`, os triggers de estoque, a função `create_sale`,
as views de estoque baixo e saldo do fiado, e as políticas de RLS.

É idempotente: **rode o arquivo inteiro de novo a cada atualização do schema**,
que ele se encarrega de trocar o que mudou sem apagar dados. Foi testado assim —
banco com vendas e produtos dentro, arquivo aplicado por cima, nada se perdeu.

### 2. Configurar o ambiente

```bash
cp .env.example .env
```

Preencha com as mesmas credenciais do site (`VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`).

### 3. Instalar e rodar

```bash
npm install
```

```bash
npm run app
```

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run app` | Abre o app em modo desenvolvimento, com hot reload |
| `npm run app:build` | Gera o instalador `.msi` em `src-tauri/target/release/bundle/msi/` |
| `npm run dev` | Só o frontend no navegador (a câmera funciona, o updater não) |

---

## O leitor de código de barras

Funcionam os dois caminhos:

**Leitor USB (o normal).** Leitor de pistola USB se apresenta pro Windows como
teclado: ele "digita" o código e manda Enter. No PDV existe um campo que fica
sempre focado esperando isso — é só bipar. Nas outras telas o hook
`useBarcodeScanner` captura pela velocidade da digitação (o leitor solta ~10ms
entre teclas, uma pessoa não passa de ~50ms).

Não precisa configurar nada no leitor. Só o padrão de fábrica: sufixo Enter.

**Webcam.** Botão "Câmera" em qualquer tela que aceita código. Usa ZXing.
Funciona, mas é bem mais lento e erra com luz ruim ou embalagem amassada — é
plano B, não o jeito de trabalhar o dia todo.

Na primeira vez o Windows pergunta se pode usar a câmera. **Cuidado ao
responder:** se clicar em "Bloquear", o WebView2 não pergunta de novo, e a única
forma de reverter é fechar o app e apagar a pasta
`%LOCALAPPDATA%\com.gestflow.mercadinho\EBWebView`.

Câmera virtual (Iriun, DroidCam, OBS) funciona normalmente, mas só aparece na
lista quando está ativa — abra o app dela e conecte o celular **antes**, ou
clique em "Procurar de novo" dentro do modal. A câmera escolhida fica salva
para a próxima vez.

### Produto não cadastrado

Bipou e não achou? Aparece na hora um botão **"Cadastrar agora"**, com o código
já preenchido. Cadastra, e o produto já entra no carrinho. Não trava a fila.

---

## Publicar uma versão nova

O app se atualiza sozinho. O fluxo:

### Configurar uma vez

1. A chave privada de assinatura está em `~/.tauri/mercadinho.key` (fora do
   repositório, e o `.gitignore` bloqueia `*.key`). **Faça backup dela.** Se
   perder, os apps já instalados param de aceitar atualização e todo mundo
   precisa reinstalar na mão.

2. Nos **Settings → Secrets and variables → Actions** do repositório, cadastre:

   | Secret | Valor |
   |---|---|
   | `TAURI_SIGNING_PRIVATE_KEY` | conteúdo de `~/.tauri/mercadinho.key` |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | vazio (a chave foi gerada sem senha) |
   | `VITE_SUPABASE_URL` | mesma do `.env` |
   | `VITE_SUPABASE_ANON_KEY` | mesma do `.env` |
   | `VITE_SITE_URL` | URL do site Gestflow |

### A cada versão

1. Suba o número da versão em `src-tauri/tauri.conf.json`.
2. Crie e empurre a tag:

```bash
git tag mercadinho-v0.2.0 && git push origin mercadinho-v0.2.0
```

O GitHub Actions compila, assina, publica o release e gera o `latest.json`. Na
próxima vez que o app abrir, ele vê a versão nova, mostra a faixa roxa de
atualização, baixa e reinicia sozinho.

### Por que MSI e não NSIS

O Tauri sabe gerar dois tipos de instalador. O padrão dele é o NSIS (`.exe`),
que atualiza sem pedir permissão de administrador. Mas o `@tauri-apps/cli`
2.11.4 quebra ao montar o NSIS nesta máquina: ele extrai o NSIS e falha no
passo seguinte com `os error 17` (mover arquivo entre discos). Foi testado com
o projeto em `D:` e com o build inteiro em `C:` — falha nos dois, então não é
questão de onde o projeto está, e o bundler vem pré-compilado dentro do npm,
sem como corrigir por fora.

Por isso o `targets` está fixo em `["msi"]`, que funciona e está verificado de
ponta a ponta: instalador de 2,7 MB, assinado, com artefato de atualização.

A diferença prática: **a atualização pelo MSI mostra o aviso de permissão do
Windows (UAC)**, é só clicar em "Sim". Com NSIS não mostraria. Quando o bug for
corrigido numa versão nova do CLI, é só voltar `targets` para
`["nsis", "msi"]` e testar.

---

## Detalhes que valem saber

**SmartScreen na primeira instalação.** O instalador não tem certificado de
code signing (custa ~R$1.000/ano), então o Windows mostra "aplicativo não
reconhecido". Clique em "Mais informações" → "Executar assim mesmo". Só na
primeira vez — as atualizações depois são verificadas pela chave do Tauri.

**Precisa de internet.** Todos os dados vêm do Supabase. Se a internet cair, o
app não vende. Um modo offline com fila de sincronização é possível, mas não
está feito.

**Onde fica o login salvo.** Em `%APPDATA%\com.gestflow.mercadinho\auth.json`.
O padrão do Supabase seria o localStorage, mas no Tauri ele pertence à origem
que o WebView carregou — `http://localhost:1420` em desenvolvimento e
`http://tauri.localhost` no app instalado. Como são origens diferentes, o login
feito em um não valia no outro. Em arquivo, o login é do aplicativo e vale nos
dois. Para forçar logout completo, apague esse arquivo.

**Perfis de funcionário — e o que eles NÃO são.** Funcionam como perfil do
Chrome: a conta de verdade é a do administrador (login do Supabase), e os
funcionários são perfis dentro dela, com nome e senha, sem e-mail e sem conta
própria. Criar um perfil exige estar no administrador; entrar num perfil pede a
senha dele; voltar para o administrador pede a senha da conta.

**Isso não é barreira de segurança.** Toda chamada ao banco continua usando a
sessão do administrador, então o perfil só decide o que a interface mostra. Quem
souber mexer consegue contornar. Serve para o funcionário não ver o financeiro
sem querer e para separar o crédito da loja de cada um — não para guardar
segredo de quem você não confia. Barreira real exigiria uma conta Supabase por
funcionário e RLS por papel.

O funcionário não vê: Dashboard, Estoque (dar entrada exige digitar o custo de
compra), coluna de custo e margem em Produtos, e o card de lucro no Histórico.
Em troca ganha **Meu crédito**.

A senha do perfil é guardada com hash bcrypt (`crypt`/`gen_salt` do pgcrypto),
nunca em texto puro, e a tabela `employee_profiles` **não tem policy de select**
— nem a API consegue ler o hash. A listagem vem da view
`employee_profiles_public`, que só expõe nome e situação.

**Crédito da loja (consumo do funcionário).** É coisa diferente do fiado do
cliente: o devedor é o funcionário e a quitação acontece na folha, não no caixa.
O funcionário anota o que pegou, **o produto sai do estoque igual a uma venda**
(senão a contagem da prateleira nunca bateria), e o admin marca como descontado
no fim do mês. O que já foi descontado não pode ser apagado, só desfeito pelo
admin — mexer numa conta fechada bagunçaria o acerto do mês passado.

**Como o fiado fecha a conta.** Vender no Crédito Loja **exige escolher um
cliente** — a regra está na função `create_sale`, não só na tela, então nenhum
caminho consegue gravar dívida sem dono. A venda entra no faturamento e o
estoque baixa normalmente; o valor fica na conta do cliente.

O saldo devedor é sempre **calculado** (`customer_credit_balance`): total fiado
menos total recebido. Nunca é uma coluna guardada. Isso importa porque estornar
uma venda ou apagar um recebimento corrige a dívida sozinho — um contador
denormalizado sairia do lugar no primeiro estorno e ninguém perceberia.

Numa venda combinada só a parte fiada vira dívida: pagou R$ 40 em dinheiro e
R$ 20 no fiado, deve R$ 20. Recebimentos são independentes de venda, porque quem
deve três compras e paga R$ 50 não diz qual delas está quitando — pagamento
parcial funciona naturalmente.

**Lucro bruto ≠ caixa do mês.** O dashboard mostra faturamento menos o custo do
que saiu da prateleira. O gasto com reposição aparece num card separado, porque
comprar 200 caixas hoje não é prejuízo de hoje — é estoque.
