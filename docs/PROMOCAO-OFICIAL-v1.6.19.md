# Preparação da versão 1.6.19 para o repositório OFICIAL

**19/11/2026 · STATUS: CANDIDATO A PUBLICAÇÃO, NÃO IMPLANTADO.**

Esta versão foi preparada com os fontes do commit **659a67bcf5eddb5fa82c22636787420a5014786c** da homologação e com a configuração compartilhada existente no oficial, a partir de **78ad21664822f1495d66d2e9137b4bfe09a08c10**. **Não mesclar na `main` nem publicar a interface nova antes de confirmar compatibilidade do backend oficial**: algumas telas chamam ações que não existiam na versão anterior.

## Alterações incluídas
- Visual padronizado do admin e Portal de Gerentes; acesso por matrícula e cadastros/situação/estatísticas da filial.
- Refinamento e sincronização automática, dois telefones e contratos temporários; proteção de edição por revisão.
- Correções de interfaces, campanhas com `utm_source`, `utm_campaign`, `utm_id` e opção avançada de origem/ID; `redirect` em parceiros.
- Painel de medições por sessão do admin. **Não é medição de consumo faturado do Firebase.**
- Fontes do Apps Script administrativo, coletor público e Cloudflare Worker para implantação manual, **sem propriedades secretas**.
- Testes de regressão em `tests/` para executar com `node --test tests/*.test.cjs`.

## Inventário da publicação externa — OBRIGATÓRIO

1. **Backup privado completo:** exportar regras/árvore de dados e permissões Firebase OFICIAL (não somente ofertas), planilha oficial, versões do Apps Script/Worker e link do commit anterior. Não enviar dados privados ao GitHub.
2. **Apps Script ADMIN OFICIAL:** verificar scripts já implantados e integrar `infrastructure/apps-script/admin/Code.gs`, `Refinamento.gs`, `Telefones.gs`, `Gerentes.gs` e `appsscript.json`. Validar Google Sheets API v4, propriedades `MART_AMBIENTE=OFICIAL`, `MART_V153_SHEET_ID` da planilha **OFICIAL**, `MART_FIREBASE_WEB_API_KEY` do projeto **OFICIAL**, `MART_V153_ADMIN_EMAIL`, e manter push desabilitado até validar as credenciais. Não copiar IDs da homologação.
3. **Coletor público OFICIAL:** verificar o projeto implantado e integrar `infrastructure/apps-script/coletor/Code.gs`, `Telefones.gs` e `appsscript.json`. Garantir `MART_EVT_SHEET_ID` da planilha OFICIAL e que o coletor continua em projeto separado.
4. **Cloudflare Worker OFICIAL:** revisar `infrastructure/cloudflare/worker.mjs`, configurar `APPS_SCRIPT_URL` com o `/exec` da API administrativa **OFICIAL**. Validar CORS, redirect Google, autenticação e método POST. Nenhum segredo no GitHub.
5. **Regras Firebase OFICIAL:** comparar com regras **realmente ativas** no Console e acrescentar apenas o que for necessário de modo restrito. **NÃO** publicar `database.rules.TESTE.json` no projeto OFICIAL. A permissão de `adminSync` e a escrita pelo servidor devem ser ensaiadas na homologação antes de adaptar as regras.
6. **Inicialização das abas:** rodar os preparadores no Apps Script ADMIN OFICIAL após backup e somente se cabeçalhos estiverem corretos; não regravar planilhas inteiras. Checar `Gerentes_Autorizados`, `Solicitacoes_Gerentes`, `Telefones_Vendedores`.
7. **Pré-publicação:** confirmar que `consultarCapacidades`, `sincronizarAdmin`, `listarCadastroGerentes`, `salvarCadastroGerente`, `consultarPainelGerente`, `criarSolicitacaoGerente`, e `listarCampanhas` funcionam com o backend OFICIAL. Não remover as travas de incompatibilidade.
8. **Publicação do site:** só após o backend estar compatível e confirmado, mesclar o PR na `main` oficial. Verificar deploy do GitHub Pages, acesso a /admin.html e /gerentes.html em desktop/celular, sem mudança de destinos.

## Testes de aceite
- Login de duas contas administrativas; conta não autorizada recusada; edição simultânea sem sobrescrita.
- Acesso do gerente por matrícula, filial correspondente, resultados e solicitações; verificar limites e filtragem de dados pessoais.
- Verificação e importação de vendedores; dois números e grupo; telefones preservados; seleção de filial com nomes completos.
- Criação, edição e remoção de ofertas/rascunhos, destaque, imagens, WhatsApp, campanhas e UTMs com `redirect`.
- Dashboard, registros de uso, campanhas e exportação do diagnóstico sem PII.
- Nenhuma chamada de TESTE nas sessões oficiais e nenhuma chamada do oficial nos testes.
- Os dois ambientes e seus dados permanecem isolados.

## Risco que precisa ser aceito explicitamente
A tela dos gerentes usa **somente matrícula**, sem prova de identidade. Qualquer pessoa com a matrícula de um gerente ativo poderá consultar dados limitados de sua filial e criar solicitações em seu nome. Isso é **uma limitação de segurança para publicação com dados reais**, embora as ações administrativas permaneçam protegidas por login Google. Antes de liberar amplamente, avaliar autenticação ou segundo fator.

**Rollback:** restaurar a revisão anterior de Apps Script e Worker, depois fazer novo commit restaurando o frontend do SHA anterior; **nunca** restaurar dados antigos por cima de registros novos sem reconciliação. 

Consulta de consumo e migração: [docs/AVALIACAO-FIREBASE-MIGRACAO-SHEETS.md](AVALIACAO-FIREBASE-MIGRACAO-SHEETS.md).
