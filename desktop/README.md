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

2. Cadastre os secrets do repositório. No **PowerShell**, de dentro de
   `desktop/` — os valores saem direto dos arquivos, sem copiar e colar:

   ```powershell
   gh secret set TAURI_SIGNING_PRIVATE_KEY --repo zFreshy/Gestflow --body (Get-Content ~/.tauri/mercadinho.key -Raw)
   ```

   ```powershell
   $v = ((Get-Content .env | Select-String '^VITE_SUPABASE_URL=') -split '=',2)[1]; gh secret set VITE_SUPABASE_URL --repo zFreshy/Gestflow --body $v
   ```

   ```powershell
   $v = ((Get-Content .env | Select-String '^VITE_SUPABASE_ANON_KEY=') -split '=',2)[1]; gh secret set VITE_SUPABASE_ANON_KEY --repo zFreshy/Gestflow --body $v
   ```

   Não precisa cadastrar `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: secret que não
   existe vira string vazia no Actions, que é exatamente o certo para uma chave
   gerada sem senha.

   Ou pela interface, em **Settings → Secrets and variables → Actions**:

   | Secret | Valor |
   |---|---|
   | `TAURI_SIGNING_PRIVATE_KEY` | conteúdo de `~/.tauri/mercadinho.key` |
   | `VITE_SUPABASE_URL` | mesma do `.env` |
   | `VITE_SUPABASE_ANON_KEY` | mesma do `.env` |
   | `VITE_SITE_URL` | URL do site Gestflow (opcional) |

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

**Perfis de funcionário.** A experiência é a do Chrome — clica no perfil, digita
a senha, pronto. Por baixo, cada funcionário é uma **conta Supabase de verdade**,
com e-mail sintético (`maria@funcionario.local`) que ele nunca vê nem digita.
Trocar de perfil é fazer login; voltar para o administrador pede a senha da conta
dele.

**A separação é feita pelo banco, não pela tela.** Este é o ponto: esconder menu
e coluna não protegeria nada, porque o dado ainda chegaria na máquina e bastaria
abrir o devtools. Com conta própria, o RLS nega na origem — mesmo chamando a API
por fora do app, a conta do funcionário recebe zero linha de `sales`,
`sale_items`, `sale_payments`, `stock_entries` e `products`.

Um detalhe do Postgres explica o desenho: todo usuário logado compartilha o mesmo
papel `authenticated`, então permissão por coluna não distingue os dois. E policy
é por linha, não por coluna. Por isso o catálogo é negado inteiro ao funcionário
e devolvido pela view **`products_pos`**, que simplesmente não tem `cost_price`.

O funcionário não vê: Dashboard, Estoque, Histórico, Fiado, e custo/margem em
Produtos — onde a tela vira consulta de preço e estoque, sem botão de editar. Em
troca ganha **Meu crédito**, onde só enxerga os próprios lançamentos.

Ele **ainda vende fiado** no PDV: escolhe o cliente, ou cadastra na hora. O que
não pode é registrar que alguém pagou a dívida — isso é dinheiro entrando, e
seria o caminho mais óbvio de desvio (dar a dívida por paga sem o dinheiro
entrar no caixa).

Duas coisas que o linter do Supabase aponta e são intencionais: `products_pos` e
`customer_credit_balance` rodam como dono. É proposital — são justamente o
caminho controlado para o funcionário chegar a um dado derivado de tabela que
ele não pode ler. Sem elas, ou ele veria o custo, ou não conseguiria trabalhar.

O `create_sale` também deixou de confiar no app: **o preço vem da tabela de
produtos**, não do que foi enviado. Sem isso, bastaria chamar a API direto para
registrar uma venda de R$ 0,01.

Criar funcionário passa pela Edge Function `create-employee`, porque criar
usuário exige a `service_role key` — que não pode viajar dentro de um app
instalado na máquina do cliente. A função confere no servidor se quem chamou é
administrador.

```bash
supabase functions deploy create-employee
```

Trocar a senha de um funcionário é feito pelo painel do Supabase, em
**Authentication → Users**.

**Apagar uma conta no painel do Supabase.** As colunas que guardam quem fez cada
lançamento (`user_id`, `opened_by`, `created_by`) nasceram sem dizer o que fazer
quando a conta some — e o padrão do Postgres nesse caso é **proibir**. Na prática
bastava o dono ter cadastrado um produto para a própria conta virar indelével, e
o erro que aparece no painel não explica nada. Agora são `on delete set null`: o
dado continua lá, com valor e data intactos, e o `user_email` gravado junto
preserva o registro de quem fez.

**Esqueceu a senha do administrador?** O e-mail de recuperação depende de SMTP
configurado no projeto — o servidor embutido do Supabase é limitado e costuma não
entregar. O caminho que sempre funciona é o painel: **Authentication → Users**,
abrir o usuário e definir a senha ali. Não depende de e-mail nenhum.

**A conta continua onde estava.** Fechar o app, desligar o computador e voltar
no dia seguinte mantém quem estava usando — administrador continua
administrador, perfil de funcionário continua no perfil. Três coisas seguram
isso, e as três já falharam em versões anteriores:

1. **A sessão vai para arquivo, não para o localStorage** (ver `authStorage.js`),
   e é gravada **na hora**. O `autoSave` do plugin de store tem 100ms de atraso,
   e era justamente aí que morava o risco: o Supabase troca o token de renovação
   de tempos em tempos e invalida o anterior no servidor. Desligar a máquina
   dentro dessa janela deixava no disco um token que já não valia, e a próxima
   abertura caía na tela de login sem ninguém ter saído da conta.
2. **O papel de cada conta fica lembrado em disco** (`profileCache.js`). Quem
   decide se alguém é administrador é o banco, e essa pergunta precisa de
   internet — desde que o app passou a vender offline, abrir sem conexão virou
   rotina. Antes, a falha da pergunta era tratada como "não é administrador", e
   o dono abria o sistema rebaixado a funcionário: sem dashboard, sem caixa, sem
   fiado, e a tela de crédito quebrava por falta de perfil.
3. **O papel lembrado é por conta**, com a chave no id do usuário. Sem isso, sair
   de uma conta de administrador e entrar numa de funcionário herdaria o papel
   anterior.

Enquanto estiver valendo o papel lembrado, o app segue perguntando ao banco em
segundo plano; assim que a internet volta, a resposta real substitui a lembrada
sozinha.

Isso **não** enfraquece a separação de papéis, e vale dizer por quê: o papel
guardado no disco decide só o que aparece no menu. Quem protege o dado é o RLS,
no servidor. Alguém que edite esse arquivo à mão para virar "administrador" vê
as telas — e todas voltam vazias, porque o banco continua respondendo conforme o
login de verdade.

**Valor gravado é valor da época.** O que o funcionário pegou em março e o que o
cliente levou fiado em abril valem o preço daquele dia — mesmo que o produto
mude de preço amanhã. Metade disso o modelo já resolvia guardando o valor na
linha; a outra metade faltava, porque nada impedia um `UPDATE` de mexer nesse
valor depois. Um "corrigir preço" mal feito, ou um update corrido no SQL Editor,
mudava a dívida de abril sem erro nenhum e sem cópia do valor original.

Agora gatilhos recusam alterar o que já foi gravado em `employee_credits`,
`sale_items`, `sale_payments` e nos valores de `sales`. O que ainda pode mudar é
uma lista curta e explícita: marcar o consumo como descontado, e a observação.
Para corrigir de verdade, apaga e lança de novo — que é o caminho que devolve o
estoque pelo lugar certo.

O consumo do funcionário também deixou de confiar no app: quem lê o preço é o
banco, dentro do `create_employee_credit`. Antes o valor vinha da tela, o que na
prática deixava o funcionário escolher quanto o próprio consumo custaria.

**Vender sem internet.** O caixa não para quando a conexão cai. A venda é
fechada na hora, gravada em disco (`vendas-pendentes.json`, na pasta de dados do
app) e sobe sozinha quando a conexão volta — inclusive se o app for fechado e
aberto no meio. O catálogo é copiado para a máquina a cada sincronização, que é
o que mantém o leitor de código de barras funcionando offline.

Duas coisas seguram a corretude:

1. Cada venda nasce com um `client_uuid` gerado no app, antes da primeira
   tentativa. O banco tem índice único nessa coluna e o `create_sale` devolve o
   id que já existe em vez de gravar outra. Sem isso, o caso mais comum de falha
   — o banco grava e a resposta se perde no caminho — viraria venda duplicada
   com estoque baixado duas vezes.
2. Nada sai da fila sem confirmação do servidor. Venda recusada por regra fica
   marcada e aparece na tela de pendentes; nunca é descartada em silêncio,
   porque é dinheiro que já entrou na gaveta.

Na venda offline o preço gravado é o que o app cobrou, e não o do momento em que
a conexão voltou — o cliente já pagou aquele valor e já levou o cupom. Essas
vendas ficam marcadas em `sales.sold_offline` para conferência.

Cadastrar cliente novo não funciona offline, de propósito: o fiado precisa de um
id do banco para apontar, e inventar um aqui daria dois cadastros da mesma
pessoa assim que a fila subisse.

**Caixa: abertura, sangria e fechamento.** Tela só de administrador — abrir,
sangrar e conferir é mexer em dinheiro fora da venda. O funcionário continua
vendendo, e as vendas dele entram no turno aberto sozinhas.

O valor esperado na gaveta é calculado pelo banco (abertura + vendas em
dinheiro + suprimentos − sangrias), nunca pelo app: conferência com número
informado pela mesma pessoa que está sendo conferida não confere nada. No
fechamento esse valor é **congelado** junto com o que foi contado, senão um
estorno feito amanhã faria o fechamento de hoje passar a bater sozinho,
escondendo a falta que existiu no dia.

Só um caixa aberto por vez, garantido por índice único — dois abertos ao mesmo
tempo tornariam impossível dizer a qual turno uma venda pertence. Motivo é
obrigatório na sangria: é o único registro de para onde o dinheiro foi.

**Nota fiscal (NFC-e).** Ao fechar a venda aparecem os botões de imprimir cupom
e emitir nota; no Histórico dá para emitir depois e reimprimir quantas vezes
quiser. Reimprimir **não** é emitir de novo: sai o mesmo DANFE, com a mesma
chave e o mesmo protocolo. Emitir outra nota para a mesma venda seria imposto em
dobro e um cancelamento junto à SEFAZ para desfazer — por isso venda com nota
autorizada também não pode ser estornada.

O cupom sai no layout do DANFE NFC-e (Manual de Padrões Técnicos): cabeçalho do
emitente, itens, totais, formas de pagamento, chave de acesso e QR Code. Venda
sem nota imprime o mesmo corpo sob o título de **comprovante**, deixando
explícito que não é documento fiscal.

**Impressora: dois caminhos, e isso é de propósito.** Em **Nota e impressora** dá
para escolher uma térmica de bobina; a partir daí o cupom sai sozinho ao fechar a
venda, corta o papel e abre a gaveta. Sem nada escolhido, cai no diálogo de
impressão do Windows — que funciona com qualquer impressora, inclusive folha A4,
e é o que garante que dá para imprimir no primeiro dia, antes de configurar coisa
nenhuma. Falha na térmica (desligada, sem papel) também cai no diálogo, em vez de
deixar o cliente sem comprovante.

A impressão direta usa ESC/POS, o dialeto que Bematech, Epson, Elgin e Daruma
entendem. Os bytes vão ao spooler do Windows com o tipo de dado **RAW** — sem
isso o Windows trataria os comandos como texto e eles sairiam impressos como lixo
no papel. É também a única forma de acionar guilhotina e gaveta, que não existem
no modelo de imprimir documento.

Dois detalhes que só aparecem no papel:

- **Acentos.** A impressora não fala UTF-8: tem uma tabela de 256 caracteres.
  O texto é convertido para CP850 antes de sair, senão "Pão" viraria "PÃ£o".
- **QR Code como imagem**, e não pelo comando nativo (`GS ( k`). O nativo existe,
  mas cada fabricante implementa uma variação e algumas ignoram em silêncio — o
  cupom sairia sem o código e ninguém perceberia até o cliente tentar consultar a
  nota. Imagem rasterizada é o denominador comum.

O botão **Imprimir teste** não é enfeite: é o único jeito de descobrir se a
largura e os acentos estão certos sem fazer uma venda de verdade para descobrir
no papel, com o cliente na frente.

A emissão passa pela Edge Function `emit-nfce`, e não sai do app direto para o
emissor, pelo mesmo motivo do `create-employee`: o token assina nota em nome da
loja e não pode viajar dentro de um app instalado no balcão. Os valores da nota
são lidos do banco, nunca do corpo da requisição — se viessem de fora, daria
para emitir nota de R$ 1 para uma venda de R$ 300.

```bash
supabase secrets set FOCUS_NFE_TOKEN=seu_token_do_emissor
supabase functions deploy emit-nfce
```

Falta ainda, do lado de fora do código: contratar o emissor (Focus NFe),
cadastrar o certificado digital A1 lá, e preencher a tela **Nota fiscal** com
CNPJ, IE, endereço e código IBGE do município. Enquanto o CSC/certificado não
estiver configurado, o botão de emitir responde dizendo o que falta e a venda
segue normalmente com o comprovante impresso.

Produto sem classificação fiscal usa o padrão da configuração (NCM, CFOP,
CSOSN/CST). É o que torna a coisa usável: classificar milhares de itens à mão
antes da primeira nota travaria o sistema inteiro. Quem tributa diferente ganha
os campos próprios no cadastro do produto.

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

**O dashboard soma no banco, não no app.** Antes a tela baixava as vendas do mês
e somava em memória. Isso funciona com pouca venda e para de funcionar sem
avisar: um mercadinho movimentado faz umas 300 vendas por dia, e o termômetro de
12 semanas precisaria de ~25 mil linhas trafegadas para desenhar 84
quadradinhos. As funções `dashboard_*` devolvem só o resultado, e cada uma
confere `is_admin()` por dentro — para o funcionário elas respondem vazio.

Os números vêm sempre com o período anterior do mesmo tamanho ao lado, porque
"R$ 8.400 este mês" não informa nada sozinho. Quando não dá para comparar
(período anterior zerado), a variação some em vez de mostrar "+100%".

O **termômetro de vendas** responde uma pergunta diferente do gráfico: não
"quanto vendi", e sim **qual dia da semana rende** — o que decide escala de
funcionário e quanta massa deixar pronta. A escala de cor é relativa ao melhor
dia do próprio período, senão uma loja de R$ 300/dia ficaria toda clara e uma de
R$ 8.000 toda escura. Dias sem movimento não entram na média: loja fechada
entraria como "vendeu zero" e afundaria a média daquele dia.

O ranking de produtos tem três leituras (faturamento, lucro, quantidade) porque
não são a mesma lista. O campeão de quantidade numa padaria é o pão, de margem
apertada; quem paga as contas costuma ser outro item, vendido bem menos. Ver só
"mais vendidos" leva a proteger o produto errado numa negociação com fornecedor.

**Lucro bruto ≠ caixa do mês.** O dashboard mostra faturamento menos o custo do
que saiu da prateleira. O gasto com reposição aparece num card separado, porque
comprar 200 caixas hoje não é prejuízo de hoje — é estoque.

### Excluir produto

Excluir apaga mesmo, e o histórico não vai junto. Venda, consumo de funcionário
e entrada de estoque guardam nome, quantidade e preço desde o momento em que
foram gravados — o vínculo com o produto é só um atalho, e ele fica nulo.
Faturamento, lucro e as contas do dashboard continuam idênticos depois.

**Desativar** continua existindo e é coisa diferente: some da lista mas segue
cadastrado, para o produto sazonal que vai voltar. Excluir libera o código de
barras para reuso, que costuma ser o motivo real de querer apagar.

Um detalhe que travou isso na primeira tentativa: apagar o produto faz o banco
zerar o `product_id` de quem apontava para ele (`on delete set null`), e esse
"zerar" chega como **UPDATE**. Os gatilhos que congelam o valor das vendas
recusavam qualquer update, então nenhum produto já vendido podia ser excluído.
Agora eles aceitam exatamente uma mudança — o vínculo virando nulo — e continuam
recusando qualquer alteração de valor.

### O nome da loja

`STORE_NAME`, em `lib/utils.js`. Fica numa constante porque aparece na barra
lateral, no login, na aba da janela e no cupom: espalhado pelas telas, trocar o
nome vira caça ao texto esquecido.

No cupom impresso ele é só o último recurso — a **razão social** cadastrada na
tela de Nota fiscal tem prioridade, porque é ela que o documento fiscal exige.

**Ao renomear o app, não mexa no `upgradeCode`.** O Tauri deriva esse GUID do
`productName`, e ele é o que diz ao Windows "este instalador substitui aquele".
Trocar o nome sem fixar o código faria cada máquina ficar com **duas** cópias
instaladas. O valor fixado em `tauri.conf.json` é o que o nome original
("Mercadinho") gerava — por isso a atualização continua trocando a instalação
que já existe.

### Nome do produto pelo código de barras

Ao cadastrar, bipar o código preenche o nome sozinho, consultando a base pública
do **Open Food Facts**. O nome vem marcado como sugestão, e não como verdade: a
base é colaborativa, e sai coisa como "Tio João União Refinado" (marca de arroz
em pacote de açúcar, porque o registro lista duas marcas). Quem confirma é quem
está com a embalagem na mão.

Falha de rede aqui não atrapalha nada — sem resposta, é só digitar o nome.

**Por que não baixar a base inteira.** É o caminho que parece óbvio e não
funciona. O arquivo que eles publicam tem **12 GB**, e o JavaScript não guarda
string maior que 512 MB: são 24 vezes o limite do motor, não do computador. Além
disso são ~4 milhões de produtos do mundo todo e **nenhum preço**, que é
justamente o que a loja precisa. A tela de importação agora recusa arquivo acima
de 80 MB dizendo isso — antes ela dizia "precisa estar salvo como CSV", mandando
conferir um formato que estava certo.

O mapeamento de colunas também entende cabeçalho em inglês (`code`,
`product_name`, `price`), com o português tendo prioridade quando o arquivo tem
os dois.
