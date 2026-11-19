# Integração controlada — Portal de Ofertas OFICIAL v1.6.19

**Estado em 19/11/2026:** código preparado na branch `release/portal-v1.6.19-integracao`. NÃO publicar na `main` antes de preparar e testar os serviços externos OFICIAIS.

## Origem, preservação e escopo
- Fonte: `E-Commerce-Martinello/Ofertas-Dos-Vendedores-Teste` no commit `659a67bcf5eddb5fa82c22636787420a5014786c`.
- Base de produção: `78ad21664822f1495d66d2e9137b4bfe09a08c10`; ponto de retorno: `backup/main-2026-11-19-antes-v1619`.
- Foram incorporados o Portal de Gerentes, cadastro e fila de solicitações, UTMs geral/individual e opções avançadas, diagnóstico de uso, sincronização por revisões, interface, validações, scripts de backend e testes.
- `shared/config.js` e `model/firebase-config.js` permanecem exatamente como na base oficial, com roteamento por domínio/caminho e recursos oficiais separados dos de TESTE.
- Não importar os códigos históricos em `infrastructure/registro-atual/homologacao`, nem regras completas `database.rules.TESTE.json`, documentação exclusiva de TESTE, credenciais ou planilhas.

## Bloqueio crítico de publicação
O frontend v1.6.19 requer que o Apps Script ADMIN reconheça `consultarCapacidades`, `sincronizarAdmin`, `salvarCadastroCompleto` e ações de gerentes. Se o backend ainda for v1.6.18, a interface impede alterações em cadastros/telefones/contatos; o Portal de Gerentes não consulta a filial. Portanto não mesclar a PR na main antes de validar os novos serviços.

## Procedimento de implantação no ambiente OFICIAL
1. Exportar o código **realmente implantado** do Apps Script ADMIN, Apps Script COLETOR e Worker OFICIAIS, bem como backup da planilha e regras Firebase. Comparar fonte implantada com este pacote antes de qualquer substituição; os arquivos preparados se baseiam em versões anteriores e não necessariamente correspondem às implantações atuais.
2. No Apps Script ADMIN OFICIAL, integrar os arquivos individuais `infrastructure/apps-script/admin/Code.gs`, `Refinamento.gs`, `Telefones.gs`, `Gerentes.gs` e `appsscript.json`. Habilitar a API avançada **Google Sheets v4** e revisar escopos do manifesto. Não manter funções duplicadas.
3. Conferir Script Properties do ADMIN OFICIAL: `MART_AMBIENTE=OFICIAL`, `MART_V153_SHEET_ID` (planilha oficial), `MART_FIREBASE_WEB_API_KEY` (Firebase oficial) e `MART_V153_ADMIN_EMAIL` (administrador oficial). Manter `MART19_PUSH_ATIVO=false` inicialmente; não copiar variáveis ou URLs do ambiente de teste.
4. Rodar `diagnosticarBackendV1619` e conferir os cabeçalhos/estrutura de `Telefones_Vendedores` antes de usar edição segura. Se necessário, preparar a aba após backup sem substituir registros existentes. Rodar `prepararEstruturaGerentesV1619` para criar ou adaptar `Gerentes_Autorizados` e `Solicitacoes_Gerentes` somente após conferir o esquema. Parar em caso de cabeçalhos desconhecidos.
5. No Apps Script COLETOR OFICIAL, integrar `infrastructure/apps-script/coletor/Code.gs`, `Telefones.gs` e `appsscript.json`. Validar `MART_EVT_SHEET_ID` apontando para a planilha oficial e o acesso à mesma aba `Config_Campanhas` onde o ADMIN salva a campanha geral e UTMs avançadas.
6. Publicar nova versão das implantações existentes dos dois Apps Scripts, preservando seus `/exec` configurados. Implantar `infrastructure/cloudflare/worker.mjs` no Worker ADMIN OFICIAL, preservando a variável `APPS_SCRIPT_URL` apontando somente ao Apps Script ADMIN OFICIAL. Confirmar autenticação de administrador e a rejeição de solicitações inválidas.
7. **Não** publicar `database.rules.TESTE.json` no Firebase oficial. Com o push opcional desligado, a sincronização periódica por consulta não precisa de novo nó Firebase. Para push futuro, revisar regras oficiais existentes e permitir leitura do nó `adminSync` apenas aos admins autorizados; configurar IAM e acionadores de maneira separada.
8. Validar login da conta principal/segunda conta, `consultarCapacidades` (`sincronizacao:true` e `edicaoCompleta:true`), duas sessões sem F5, cadastro seguro, campanhas geral/individual e UTMs, gerentes ativos/inativos, pedidos, ofertas/imagens, importações, contatos, histórico e relatórios. Testar também smartphone.
9. Apenas depois da validação integrada, mesclar esta branch na `main` oficial. Se houver falha, reverta código usando o backup, mas **não** restaure uma planilha completa sobre dados novos sem avaliação.

## Segurança e limites
- Matrícula identifica a filial do gerente, mas **não autentica sua identidade**. Quem obtiver matrícula ativa pode tentar visualizar dados filtrados daquela filial e solicitar alterações. Não tratar como acesso seguro para informações sensíveis.
- O diagnóstico mede duração/falhas de requisições e eventos Firebase na sessão, não o consumo faturado, tamanho integral do banco ou atividade global.
- Execute `node --test tests/*.test.cjs` num checkout local/CI. Os testes de homologação foram isolados e não substituem testes reais do OFICIAL.
- Esta publicação no repositório GitHub não modifica automaticamente Firebase, Cloudflare, Google Apps Script ou Google Sheets.
