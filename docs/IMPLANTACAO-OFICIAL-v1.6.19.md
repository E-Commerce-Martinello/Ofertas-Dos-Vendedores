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


## Comparação com os códigos enviados do ambiente funcionando (19/11/2026)

O responsável forneceu versões **em uso** do Worker, regras Firebase, manifestos e arquivos `Code.gs` ADMIN/COLETOR, anteriormente não confirmadas. Foi efetuada uma análise das funções e dependências do código disponibilizado. A implantação real do serviço não foi consultada; confira se o conteúdo fornecido é exatamente o publicado antes de substituí-lo.

### ADMIN — versão atual 1.6.18 → v1.6.19
- Na versão atual enviada foram identificadas 64 funções declaradas em `Code.gs`. O novo `Code.gs` mantém 59 das assinaturas; **cinco funções legadas de edição direta foram intencionalmente removidas**: `salvarVendedorV153_`, `criarVendedorV153_`, `telefoneValidoV153_`, `normalizarTelefoneV153_`, `mart1618_salvarTelefones_`. Não reintroduzir gravações antigas: a nova operação `salvarCadastroCompleto` implementa um lote único com revisão em `Refinamento.gs`. A criação manual antiga precisa ser testada como fluxo novo para garantir que continua atendida.
- Mantidas operações autenticadas de eventos, telefones extras/leitura, participantes WhatsApp, verificação de links, contatos, configurações, campanhas, auditoria, administradores e backups. Novas ações: sincronização, edição completa e gerentes.
- `Refinamento.gs`, `Gerentes.gs` e `Telefones.gs` devem ser **arquivos separados** no Apps Script administrativo, não substituir todos pelo mesmo arquivo.

### COLETOR — versão atual 1.6.3.2 → v1.6.19
- O código enviado possuía 20 funções; as 20 assinaturas continuam disponíveis no novo arquivo, incluindo visitas, cliques, ranking, status de matrícula e solicitações. A configuração de campanhas passa a incluir `mart1614_configRastreio_` para fornecer `utm_source` e `utm_id`, além da campanha geral.
- Validar que `MART_EVT_SHEET_ID` e `MART_V153_SHEET_ID` de produção consultem a mesma planilha/aba `Config_Campanhas` ou que a arquitetura permita que ambos leiam a configuração pertinente.

### Worker
- O código enviado pelo responsável apresentava diagnósticos `FALHA_POST_GOOGLE`, `FALHA_GET_REDIRECIONAMENTO`, e `RESPOSTA_NAO_JSON_...`. Foram restaurados com classificação segura (sem conteúdo de resposta nem credenciais) no Worker v1.6.19; preservados POST único, retentativas só de GET e restrição de origem.
- As duas ações públicas de gerentes (`consultarPainelGerente` e `criarSolicitacaoGerente`) foram mantidas; **outras ações exigem token Firebase** no Worker e verificação do token no Apps Script.
- **ATENÇÃO:** o comentário no Worker fornecido menciona explicitamente "ambiente de teste". Confirmar no console Cloudflare se foi copiado do Worker oficial e se a propriedade `APPS_SCRIPT_URL` do Worker OFICIAL aponta exclusivamente ao Apps Script oficial.

### Firebase
- Criado `infrastructure/firebase/database.rules.OFICIAL.json` com os nomes reais do ambiente oficial: `ofertasMartinello`, `gestaoVendedores`, `adminUids`, `aparenciaPortal`, `rascunhosOfertas`; sem sufixos `_TESTE`.
- Preservadas as condições de autorização existentes e criada regra **restrita** de leitura para `adminSync` com `".write": false` para clientes. Com push desativado, publicar novas regras **não é necessário**. Este arquivo é uma PROPOSTA; comparar com as regras publicadas antes de aplicar.
- O conteúdo do Firebase foi colado duas vezes na conversa: foi consolidado em um único JSON válido, sem repetir a chave `rules`.

### Manifestos
- Ambos preservam `webapp.executeAs=USER_DEPLOYING` e `webapp.access=ANYONE_ANONYMOUS` do serviço atual, necessários à API pública de eventos e ao transporte pelo Worker. A autenticação administrativa é no código do Apps Script, **não** na configuração `ANYONE_ANONYMOUS`.
- O ADMIN acrescenta serviço avançado Sheets v4 e escopos para ScriptApp/push; a concessão de permissões deve ser conferida ao implantar.
- **Diferença funcional ainda a validar:** os manifestos atuais enviados usam `America/Cuiaba`; a v1.6.19 preparada usa `America/Sao_Paulo`, conforme os códigos da homologação. Isso muda a virada de `hoje`, contagens diárias e agrupamentos por mês. Confirmar que a regra de negócio desejada é Brasília antes de implantar.

### Validações automatizadas
- `tests/integracao-oficial.test.cjs` cobre manifestos, isolamento/permissões Firebase, erros de rede do Worker, POST único com redirecionamento, ausência de divulgação de payload e ações administrativas bloqueadas sem login.
- Os testes em CI simulam chamadas, **não** provam autenticação real, Web App implantado, permissão Google ou compatibilidade da planilha oficial.
