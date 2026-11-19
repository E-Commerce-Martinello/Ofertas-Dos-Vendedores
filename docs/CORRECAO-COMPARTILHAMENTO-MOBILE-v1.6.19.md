# Correção oficial: compartilhamento mobile, cache e telefone solicitado
19/11/2026 — implementação no frontend e fonte do coletor

## Diagnóstico não invasivo no Firebase OFICIAL
A consulta agregada a `ofertasMartinello`, sem imprimir texto, imagem, IDs ou telefones, identificou:
- 10 ofertas;
- 10 com imagem base64 válida (PNG/JPEG/GIF/WebP; assinatura e formato reconhecidos);
- 0 sem imagem;
- 0 com U+FFFD (`�`) no texto original;
- 0 imagens base64 inválidas;
- 0 imagens acima de 5 MB.

**Logo, a ausência de foto e a perda de emojis reportadas podem ocorrer depois que o navegador carrega a oferta, no fluxo de compartilhamento.** O teste não prova comportamento do WhatsApp real.

## Comportamento do vendedor
1. Digita matrícula e toca **PREPARAR OFERTA PARA COMPARTILHAR**.
2. Consulta matrícula, pedido prévio de telefone e campanha, gera redirect UTM, prepara legenda UTF-8 e converte imagem base64 para File.
3. Toca **COMPARTILHAR OFERTA COM IMAGEM**. O código chama `navigator.share({files:[file],text})` diretamente durante o toque, sem `await` anterior. Seleciona WhatsApp no menu.
4. Se o WhatsApp não transferir a legenda como esperado, **COPIAR LEGENDA PARA O WHATSAPP** permite colar a legenda. Se navegador não suportar arquivos via Web Share, o portal mostra 3 ações explícitas: baixar imagem, copiar texto, abrir WhatsApp e anexar manualmente. **Não existe fallback silencioso para só texto.**
5. O registro de início de compartilhamento continua sendo indicativo; não prova envio.

**Atenção:** uma oferta que veio do cache local sem imagem não será compartilhada com imagem genérica. O portal solicitará recarregamento.

## Atualização automática
- `shared/auto-update.js` consulta o próprio HTML com query exclusiva e `cache:'no-store'`, compara build e URLs dos scripts/estilos.
- Portal do vendedor recarrega ao encontrar nova versão **quando não há oferta preparada, compartilhamento em andamento nem modal de telefone**. Restaura a matrícula de sessão.
- Admin e Gerentes com sessão/edição em andamento mostram aviso manual para evitar perder alterações.
- Não apaga tema, matrícula, sessão do admin ou quaisquer chaves do Firebase/Sheets.
- **Regra para futuras publicações:** alterar o meta `martinello-build` e a query `?v=` de JS/CSS modificados nas páginas HTML. Sem uma alteração observável no HTML, uma atualização somente em .js não será detectada. A consulta automática não permite sobrescrever arquivos antigos no cache sem mudar a URL.
- Quem **já está com HTML muito antigo, sem o verificador**, precisará carregar esta versão uma vez via URL renovada. A partir daí a detecção é automática.

## Telefone já solicitado
- Frontend guarda solicitação local por até 90 dias, e consulta `solicitado` quando backend responder esse booleano.
- O COLETOR versionado incorpora `martEvtTelefoneJaSolicitado_` e devolve apenas `solicitado:true/false` junto de `validado`, sem transmitir telefone ou qualquer outro dado pessoal.
- Se o coletor em uso ainda não devolver `solicitado`, o portal **não exige automaticamente novo número**, por não conseguir verificar pedidos já existentes. Solicitação voluntária permanece disponível.
- **Atenção: atualização do .gs no GitHub NÃO altera o Google Apps Script publicado**. Para a regra entre navegadores e aparelhos, comparar com o Code.gs que está implantado no **COLETOR OFICIAL**, integrar `doGet`, `martEvtTelefoneJaSolicitado_` e invalidação do cache após `solicitarTelefone`, publicar nova versão da implantação `/exec` existente, sem modificar URL/planilha/manifesto nem os registros históricos.
- Use o workflow de diagnóstico existente para conferir chamadas oficiais; não copiar o coletor de TESTE.

## Validação
- `node --test tests/*.test.cjs` incluindo testes do compartilhamento nativo com imagem e Unicode, ativação do toque, versões, pedido anterior e comportamento com coletor antigo.
- Workflow `diagnostico-ofertas.yml` verifica apenas números agregados no Firebase.
- Para validar o WhatsApp real, usar Samsung/Chrome e Samsung Internet com uma oferta de teste e verificar foto **e** legenda. Este comportamento não é reproduzível apenas por teste Node.
