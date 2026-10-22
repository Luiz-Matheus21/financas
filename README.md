# Finanças Desktop

Aplicativo desktop de controle financeiro pessoal para Windows. Os lançamentos
ficam em um arquivo local e o reconhecimento de prints roda na própria máquina.
Login e sincronização usam serviços externos quando configurados; este
repositório contém somente o aplicativo desktop, sem a API ou dados pessoais.

A pergunta que o app existe para responder é uma só: **quanto dá para gastar
neste mês, e no mês que vem?**

## O que ele faz

- **Cartões** com limite, dia de fechamento e dia de vencimento. O fechamento
  decide em qual fatura a compra entra; o vencimento, em qual mês o dinheiro
  sai. Cada cartão aparece com a cor e a marca do banco.
- **Compras parceladas**: informa o total e em quantas vezes, e o app espalha
  as parcelas pelas faturas dos próximos meses. Antes de salvar ele mostra em
  qual mês cada parcela vai cair.
- **Limite comprometido** de verdade: soma as parcelas que ainda vão vencer, e
  libera conforme as faturas são pagas.
- **Ganhos e gastos fixos**, mensais ou de uma vez só (13º, bônus, férias).
- **Faturas** mês a mês, com o valor calculado, o valor informado pelo banco
  (quando houver diferença) e uma matriz dos próximos 12 meses por cartão.
- **Visões por pessoa**: cada um separado e os dois somados. A soma das visões
  individuais sempre bate com o total.
- **Ler print** (OCR): cola um print com `Ctrl+V` e o app extrai valor,
  parcelas, data e em qual cartão foi. Se o print for uma lista de
  lançamentos da fatura, dá para importar vários de uma vez.
- **Backup** em JSON, para levar para outra máquina.

## Rodando

```powershell
npm install
Copy-Item .env.example .env  # PowerShell; configure a API que você controla
npm run dev                 # abre o app em modo desenvolvimento
```

Se o Electron reclamar que não foi instalado corretamente:

```bash
node node_modules/electron/install.js
```

> Terminais dentro de editores Electron (VS Code, Cursor) exportam
> `ELECTRON_RUN_AS_NODE=1`. Se isso vazar para o processo filho, o Electron sobe
> como Node puro e o erro que aparece não tem nada a ver com o código
> (`app` vem `undefined`). Todo script que lança o Electron passa por
> `scripts/rodar-electron.mjs`, que limpa essa variável.

## Gerando o instalador

```bash
npm run gerar:icone   # só quando o desenho do ícone mudar
npm run dist          # gera release/Financas-Setup-1.0.0.exe
```

O ícone é desenhado em código (`scripts/gerar-icone.mjs`), que escreve o `.ico`
multi-tamanho na mão. Não precisa de editor de imagem, e o desenho é conferido
a 16px — é o tamanho que decide se ainda se entende o que é.

## Atualização automática

O app instalado se atualiza sozinho: ao abrir, procura release nova no GitHub,
baixa em segundo plano e avisa quando está pronta. A troca só acontece quando
você clica em reiniciar, ou no próximo fechamento — nunca no meio do uso.

### Lançando uma versão

```bash
npm run lancar -- correcao    # 1.2.3 -> 1.2.4
npm run lancar -- melhoria    # 1.2.3 -> 1.3.0
npm run lancar -- reforma     # 1.2.3 -> 2.0.0
```

O script confere tudo antes: árvore limpa, ramo `main`, `typecheck` e os
testes passando. Só então sobe o número, empacota, publica a release, comita a
versão e empurra a tag. Se o empacotamento falhar, o número volta atrás — não
fica versão furada no repositório.

### Que número usar

| Tipo | Vira | Quando |
| --- | --- | --- |
| `correcao` | 1.2.3 → 1.2.**4** | Bug, texto, ordem de lista, ajuste visual. Nada muda no jeito de usar. |
| `melhoria` | 1.2.3 → 1.**3.0** | Funcionalidade nova, tela nova, mudança de fluxo. É o caso mais comum. |
| `reforma` | 1.2.3 → **2**.0.0 | Muda o formato dos dados salvos e exige migração, ou reorganiza o app inteiro. |

A regra prática: se você precisa **explicar** o que mudou, é `melhoria`. Se
alguém pode **perder dado** ao atualizar, é `reforma`. Todo o resto é
`correcao`.

### Configuração da API e da sincronização

O desktop precisa de uma API para login e dados compartilhados. Configure
`VITE_API_URL` no `.env` com o endereço da sua própria API; sem configuração,
o app tenta `http://localhost:3100`. A API não está incluída neste repositório.

As releases deste repositório são públicas, então a atualização automática não
precisa de token de leitura. Para oferecer sincronização entre dispositivos,
configure `BOLSO_REPO_DADOS` no ambiente antes de compilar, apontando para um
repositório privado de dados seu. A sincronização fica desativada quando essa
variável está vazia. O Git instalado deve estar autenticado para acessar esse
repositório privado.

Para publicar uma release, autentique o GitHub CLI (`gh auth login`) ou defina
`GH_TOKEN`. Essa credencial é usada só pelo script de publicação e não é
incluída no aplicativo.

## Testes

```bash
npm run testar              # roda os dois abaixo
npm run testar:financeiro   # fatura, parcela, limite, rateio por pessoa
npm run testar:ocr          # OCR ponta a ponta com prints sintéticos
```

O teste de OCR renderiza prints de mentira (notificação de compra e lista de
fatura), captura como imagem, passa pelo Tesseract e confere o que o parser
extraiu — é o que garante que a leitura não regrediu.

## Como está organizado

```
electron/          processo principal: janela, arquivo de dados, OCR
  main.ts          janela e canais de IPC
  store.ts         leitura e gravação atômica do JSON, com backup
  ocr.ts           Tesseract rodando no processo principal
src/lib/
  types.ts         o modelo de dados
  finance.ts       o motor: fatura, parcela, limite, resumo do mês
  mes.ts           contas com mês de referência ('YYYY-MM')
  ocr.ts           parser: tira valor, parcelas, data e cartão do texto lido
  bancos.ts        catálogo de bancos com cor e marca
src/pages/         uma tela por assunto
src/components/    biblioteca de UI própria do app
```

Os dados ficam em `%APPDATA%/Bolso/dados/bolso.json`, com um
`bolso.backup.json` ao lado. A gravação é atômica: escreve num temporário e só
então troca, então uma queda no meio nunca deixa o arquivo pela metade.

## Decisões que valem saber

- **A competência é o mês do vencimento**, não o do fechamento. É o mês em que
  o dinheiro realmente sai da conta, que é o que interessa para planejar.
- **Valor informado pelo banco ganha do calculado**, e quando há filtro de
  pessoa ele é rateado na proporção das parcelas de cada um — assim a soma das
  visões continua batendo com o total.
- **Nada do OCR é salvo sem confirmação.** O que o parser não encontrou no
  texto aparece marcado como "palpite" na tela.
