# Medição do Firebase e decisão sobre migrar o Google Sheets

**19/11/2026 · Portal de Ofertas Martinello**  
**Situação:** plano de observação. **Nenhuma migração, alteração de banco, cobrança ou serviço externo foi executada.**

## 1. O que já existe
O painel **Admin → Configurações → Desempenho e uso da sessão** (v1.6.19) mede tempos e falhas das operações de API, leituras explícitas das ofertas no Firebase, quantidade de callbacks de ofertas, situação da sincronização, tamanho lógico de ofertas em memória e permite exportar JSON agregado. Não recolhe telefones, matrículas, nomes, tokens ou conteúdo dos erros.

**Limite:** não mede bytes reais cobrados, picos de conexão, crescimento da base, leituras de visitantes ou atraso real em outro dispositivo. Não é monitoramento de consumo do Firebase; as medições oficiais vêm dos consoles.

## 2. Observar os DOIS ambientes durante 30 dias

| Indicador | Onde obter | Intervalo | Por quê |
|---|---|---|---|
| Plano (Spark ou Blaze) | Configurações do Firebase | agora | Verificar garantia de custo zero |
| Armazenamento total do Realtime Database | Firebase Console → Realtime Database → Uso; ou Cloud Monitoring `storage/total_bytes` | início, semanal e fim | Projetar crescimento |
| Downloads/saída total | Realtime Database → Uso; Cloud Monitoring `network/sent_bytes_count` | semanal, acumulado em 30 dias | Inclui tráfego de leitura e sobrecarga |
| Conexões simultâneas (pico) | Realtime Database → Uso | 24 h e 30 dias | Conferir limite de conexões |
| Carga por operação | Realtime Database → Uso; Cloud Monitoring `io/database_load` por tipo | horários de pico | Descobrir gargalos |
| Latências e falhas das chamadas administrativas | Painel de sessão → exportar JSON | ao menos 3 sessões por semana, sob conexões distintas | Isolar o impacto da API/Sheets |
| Tempo de propagação entre dois admins | Cronômetro entre alteração A e visualização B | 10 alterações pequenas de teste | Verificar sincronização real |
| Quantidade de vendedores, solicitações e eventos | Contagem por abas no Sheets (sem exportar PII) | início e fim | Estimar volume da migração |
| Tamanho das imagens em `urlImagem` | Amostra local de ofertas; painel JSON de ofertas carregadas | início, fim | Evitar repetir imagens pesadas no banco |

Em separado: `portal-de-oferta` (**OFICIAL**) e `ofertas-do-vendedor` (**TESTE**). Não somar as medições como se viessem do mesmo projeto.

Documentação:
- https://firebase.google.com/docs/database/usage/monitor-usage
- https://firebase.google.com/docs/database/usage/billing
- https://firebase.google.com/pricing
- https://developers.google.com/apps-script/guides/services/quotas

## 3. Limites a respeitar no Spark gratuito

**Realtime Database:** **1 GB** armazenado, **10 GB/mês** de downloads e **100 conexões simultâneas**. São limites oficiais, não metas de planejamento. O plano Spark não cobra excedentes, mas o serviço fica sujeito a restrições; Blaze passa a cobrar uso acima da franquia. Não mudar plano sem decisão explícita.

Como margem inicial **sugerida, não limite do Firebase**, considerar a migração somente quando projeções de pico e de crescimento deixarem espaço confortável: menos de ~50% da franquia de download, menos de ~50% do armazenamento e picos abaixo de ~50 conexões, com alarmes e novas medições após qualquer mudança estrutural. Se exceder, reduzir payloads/escutar caminhos menores ou rever a arquitetura antes de migrar.

## 4. Por que a migração pode melhorar o portal

O Google Sheets funciona como base operacional, mas cada requisição passa por Worker → Apps Script → Sheets. O Realtime Database permite listeners para alterações com baixa latência. Isso reduz a necessidade de consultas periódicas, **desde que** sejam escolhidos nós de dados pequenos e regras de segurança específicas. Tempo de resposta inclui rede; a sincronização por polling também inclui espera até a próxima verificação.

O consumo atual do Firebase concentra ofertas, rascunhos e aparência. Parte das imagens está embutida como **base64 em JSON**, aumentando armazenamento e tráfego. Uma migração cega de todos os cadastros e eventos para o mesmo nó pode multiplicar downloads.

## 5. Arquitetura alvo a avaliar (NÃO implementada)

- `/cadastrosVendedores/{matricula}`: dados mínimos para listagem; impedir leitura pública.
- `/telefonesVendedores/{matricula}`: telefone pessoal/profissional, validação, conflitos; acesso apenas autorizado.
- `/filiais/{codigo}`: informações públicas não sensíveis.
- `/gerentesAutorizados/{matricula}`: gerentes, filial e status; **não disponibilizar telefones em leitura pública**.
- `/solicitacoesGerentes/{id}`: pedidos revisáveis e histórico; acesso administrativo restrito.
- `/configuracoes/contatos`, `/campanhas`: nós pequenos, controle de revisão.
- `/estatisticas/mensais/{anoMes}/... `: agregados compactos por vendedor/campanha/filial.

**Eventos brutos:** não migrar um histórico ilimitado de cliques/visitas para um nó Realtime Database com download integral. Avaliar agregação mensal, retenção, exportação de arquivo de auditoria e consultas com limites.

**Segurança essencial:** a matrícula do gerente não comprova identidade. Uma migração de dados pessoais para leitura direta no cliente só pode ocorrer com autenticação adicional ou um endpoint restrito que retorne respostas minimizadas, com limites de taxa. Não abrir regras `.read` / `.write` para cadastros e telefones.

**Imagens:** avaliar manter URLs CDN e armazenar apenas as URLs no Realtime Database; a criação de imagens não deve depender de disponibilizar um bucket pago sem validação.

## 6. Etapas de migração e pontos de retorno

1. Medir 30 dias; exportar históricos e contagens **privadamente**, nunca no GitHub.
2. Fazer backup completo do Sheets e de todos os nós relevantes do Firebase, inclusive rascunhos e permissões. Inspecionar integridade.
3. Construir migração **somente em TESTE**, com registros sintéticos/anonimizados e schema documentado.
4. Importar em lotes pequenos, manter o Sheets como fonte de verdade, comparar totais, amostras, hashes e autorizações. Sem dupla gravação automática desprotegida.
5. Validar operações concorrentes, formulários em edição, histórico, telefones, dois números, campanhas, métricas e rollback com testes reais.
6. Introduzir os leitores novos com feature flag e monitorar uso; só depois cortar gravações do Sheets de forma controlada.
7. Após período de observação, manter Sheets como backup temporário e documentar processo de restauração. Desativá-lo apenas após aceite explícito.

**Decisão atual: medir e otimizar primeiro; NÃO remover o Sheets neste momento.**
