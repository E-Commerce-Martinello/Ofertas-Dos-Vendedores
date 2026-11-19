/**
 * Gateway administrativo Martinello v1.6.21 — com rota pública do coletor.
 * Variáveis: APPS_SCRIPT_URL (admin), COLETOR_APPS_SCRIPT_URL (coletor), PAGES_ORIGIN (opcional).
 * A autenticação administrativa permanece no Apps Script; somente duas ações de gerente são públicas.
 */
const ORIGEM_PERMITIDA = 'https://e-commerce-martinello.github.io';
const LIMITE_BYTES = 600000;

function validarOrigem(request, env) {
  const origem = request.headers.get('Origin');
  if (origem === ORIGEM_PERMITIDA) return origem;
  const pages = String(env.PAGES_ORIGIN || '').trim().replace(/\/$/, '');
  return /^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(pages) && origem === pages ? origem : null;
}

function responder(corpo, status = 200, origem = ORIGEM_PERMITIDA) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Access-Control-Allow-Origin': origem,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));

async function receberJsonGoogle(upstream, campos) {
  // Nunca repetir o POST: operações como importação/edição não são idempotentes.
  const inicio = await fetch(upstream, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: campos.toString()
  }).catch(() => { throw new Error('FALHA_POST_GOOGLE'); });

  let resposta = inicio;
  if ([301, 302, 303].includes(inicio.status)) {
    const destino = inicio.headers.get('Location') || '';
    let url;
    try { url = new URL(destino); } catch (_) { throw new Error('REDIRECT_INVALIDO'); }
    if (url.protocol !== 'https:' || url.hostname !== 'script.googleusercontent.com') {
      throw new Error('REDIRECT_INVALIDO');
    }
    // O ContentService fornece o resultado por um URL de uso temporário.
    // Caso esse GET dê 404, repetir somente o GET do MESMO endereço.
    // Isso não executa novamente o doPost nem duplica alterações.
    for (const espera of [0, 500, 1400, 2800]) {
      if (espera) await pausa(espera);
      resposta = await fetch(url.href, { method: 'GET', redirect: 'manual' })
        .catch(() => { throw new Error('FALHA_GET_REDIRECIONAMENTO'); });
      if (resposta.status !== 404) break;
    }
  }

  if (!resposta.ok) {
    throw new Error('HTTP_APPS_SCRIPT_' + resposta.status);
  }
  try { return JSON.parse(await resposta.text()); }
  catch (_) {
    const tipo = String(resposta.headers.get('content-type') || '').toLowerCase();
    let host = '';
    try { host = new URL(resposta.url).hostname; } catch (_) {}
    const origem = host === 'script.googleusercontent.com' ? 'REDIRECIONAMENTO_GOOGLE'
      : host === 'script.google.com' ? 'APPS_SCRIPT' : 'OUTRO';
    const formato = tipo.includes('html') ? 'HTML' : tipo.includes('json') ? 'JSON' : 'OUTRO';
    // Nunca inclui a resposta, identificadores de planilha, token ou URL do Google.
    throw new Error('RESPOSTA_NAO_JSON_' + origem + '_' + formato);
  }
}

// Leitura pública limitada do COLETOR, SEM alterar as rotas administrativas.
// A proteção de origem é adicional, NÃO uma autenticação. O Apps Script já expõe
// os mesmos booleanos/campanha via JSONP. Nenhum nome ou telefone é retornado.
const PORTAL_ACOES = Object.freeze({
  consultarMatricula: {prefix:'ma_', callback:'MartinelloMatriculaReceber'},
  consultarTelefone: {prefix:'q_', callback:'MartinelloTelefoneReceber'},
  consultarCampanha: {prefix:'cp_', callback:'MartinelloCampanhaReceber'},
  rankingOfertas: {prefix:'rk_', callback:'MartinelloRankingReceber'}
});

async function consultarColetorPublico(request, env, retorno) {
  const url=new URL(request.url);
  const acao=String(url.searchParams.get('action')||'');
  const conf=PORTAL_ACOES[acao];
  if(!conf)return retorno({erro:'Ação pública não permitida.'},400);
  const req=String(url.searchParams.get('requestId')||'');
  if(!req.startsWith(conf.prefix)||!new RegExp('^'+conf.prefix+'[A-Za-z0-9_-]{8,48}$').test(req))
    return retorno({erro:'Identificador de consulta inválido.'},400);
  const upstream=String(env.COLETOR_APPS_SCRIPT_URL||'').trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(upstream))
    return retorno({erro:'Configure COLETOR_APPS_SCRIPT_URL no Worker.'},503);

  // Somente parâmetros conhecidos. Nunca permitir URLs, ações administrativas,
  // nomes, telefones ou redirecionamento arbitrário nos dados solicitados.
  const qs=new URLSearchParams({action:acao,requestId:req});
  if(acao==='consultarMatricula'||acao==='consultarTelefone'){
    const matricula=String(url.searchParams.get('matricula')||'');
    if(!/^\d{3,5}$/.test(matricula))return retorno({erro:'Matrícula inválida.'},400);
    qs.set('matricula',matricula);
  }else if(acao==='rankingOfertas'){
    const ids=String(url.searchParams.get('ids')||'');
    const partes=ids.split(',');
    if(!ids||ids.length>1600||partes.length>40||
       !partes.every(id=>/^[A-Za-z0-9_-]{1,40}$/.test(id)))
      return retorno({erro:'Identificadores de oferta inválidos.'},400);
    qs.set('ids',ids);
  }
  if([...url.searchParams.keys()].some(k=>!['action','requestId','matricula','ids'].includes(k)))
    return retorno({erro:'Parâmetro público não permitido.'},400);

  const destino=new URL(upstream);
  destino.search=qs.toString();
  let resposta;
  try {
    // Google ContentService pode responder 302 e uma URL temporária; em alguns
    // celulares/logins esse redirecionamento é bloqueado. Aqui o Worker o resolve.
    const inicio=await fetch(destino.href,{method:'GET',redirect:'manual'});
    resposta=inicio;
    if([301,302,303].includes(inicio.status)){
      let temp;
      try{temp=new URL(inicio.headers.get('Location')||'');}catch(_){throw Error('REDIRECT_INVALIDO');}
      if(temp.protocol!=='https:'||temp.hostname!=='script.googleusercontent.com')
        throw Error('REDIRECT_INVALIDO');
      for(const espera of [0,400,1100,2400]){
        if(espera)await pausa(espera);
        resposta=await fetch(temp.href,{method:'GET',redirect:'manual'});
        if(resposta.status!==404)break;
      }
    }
    if(!resposta.ok)throw Error('HTTP_GOOGLE_'+resposta.status);
    const txt=await resposta.text();
    if(txt.length>160000)throw Error('RESPOSTA_EXCESSIVA');
    // JSONP transformado em JSON por leitura de texto. Nunca executar eval!
    const prefixo='window.'+conf.callback+'&&window.'+conf.callback+'(';
    const js=txt.trim();
    if(!js.startsWith(prefixo)||!js.endsWith(');'))throw Error('JSONP_INVALIDO');
    const dados=JSON.parse(js.slice(prefixo.length,-2));
    if(dados?.requestId!==req||
       (acao!=='rankingOfertas'&&typeof dados.disponivel!=='boolean'))
      throw Error('JSONP_INVALIDO');
    const resultado={ok:true,requestId:req,disponivel:acao==='rankingOfertas'?true:dados.disponivel};
    if(acao==='consultarMatricula'){
      if(typeof dados.ativo!=='boolean')throw Error('STATUS_INVALIDO');
      resultado.ativo=dados.ativo;
    }else if(acao==='consultarTelefone'){
      if(typeof dados.validado!=='boolean')throw Error('STATUS_INVALIDO');
      resultado.validado=dados.validado;
      if(typeof dados.solicitado==='boolean')resultado.solicitado=dados.solicitado;
    }else if(acao==='consultarCampanha'){
      if(typeof dados.campanha!=='string'||typeof dados.utmSource!=='string'||typeof dados.utmId!=='string')
        throw Error('CAMPANHA_INVALIDA');
      resultado.campanha=dados.campanha;
      resultado.utmSource=dados.utmSource;
      resultado.utmId=dados.utmId;
    }else{
      if(typeof dados.ofertaId!=='string')throw Error('RANKING_INVALIDO');
      resultado.ofertaId=dados.ofertaId;
    }
    return retorno(resultado);
  } catch(e) {
    // Não incluir request URL, matrícula, corpo da resposta ou tokens em logs.
    const tipo=String(e?.message||'INDEFINIDO');
    console.warn('Coletor público indisponível:',tipo.slice(0,65));
    return retorno({erro:'O coletor não respondeu corretamente. Verifique a implantação do Apps Script e tente novamente.'},502);
  }
}

export default {
  async fetch(request, env) {
    // A origem é uma restrição adicional; a autenticação REAL acontece na API.
    const origem = validarOrigem(request, env);
    if (!origem) return new Response('Origem não autorizada.', { status: 403 });
    const retorno = (corpo, status = 200) => responder(corpo, status, origem);
    if (request.method === 'OPTIONS') return retorno({ ok: true });
    const caminho=new URL(request.url).pathname;
    if(caminho==='/portal-status'){
      if(request.method!=='GET')return retorno({erro:'Método não permitido.'},405);
      return consultarColetorPublico(request,env,retorno);
    }
    if (request.method !== 'POST') return retorno({ erro: 'Método não permitido.' }, 405);

    const upstream = String(env.APPS_SCRIPT_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(upstream)) {
      return retorno({ erro: 'Configure a variável APPS_SCRIPT_URL com o /exec da API administrativa.' }, 503);
    }
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > LIMITE_BYTES) return retorno({ erro: 'Solicitação muito grande.' }, 413);

    let dados;
    try {
      const texto = await request.text();
      if (texto.length > LIMITE_BYTES) return retorno({ erro: 'Solicitação muito grande.' }, 413);
      dados = JSON.parse(texto);
    } catch (_) { return retorno({ erro: 'JSON inválido.' }, 400); }

    if (!dados || typeof dados !== 'object' ||
        typeof dados.action !== 'string' || !/^[A-Za-z]{2,40}$/.test(dados.action) ||
        typeof dados.firebaseIdToken !== 'string' || dados.firebaseIdToken.length > 6000 ||
        typeof dados.requestId !== 'string' || !/^req_[A-Za-z0-9_]+$/.test(dados.requestId)) {
      return retorno({ erro: 'Campos inválidos.' }, 400);
    }

    // Somente as duas ações limitadas do gerente funcionam sem login.
    // Uma matrícula identifica a filial, mas NÃO autentica a pessoa.
    const consultaGerente = dados.action === 'consultarPainelGerente';
    const pedidoGerente = dados.action === 'criarSolicitacaoGerente';
    const publicoGerente = consultaGerente || pedidoGerente;
    if (publicoGerente) {
      if (dados.firebaseIdToken !== '' || JSON.stringify(dados.payload || {}).length > 2500)
        return retorno({ erro: 'Requisição de gerente inválida.' }, 400);
    } else if (dados.firebaseIdToken.length < 200) {
      return retorno({ erro: 'Login administrativo obrigatório.' }, 401);
    }

    const campos = new URLSearchParams({
      action: dados.action,
      firebaseIdToken: dados.firebaseIdToken,
      requestId: dados.requestId,
      parentOrigin: ORIGEM_PERMITIDA,
      transport: 'proxy',
      payload: JSON.stringify(dados.payload || {})
    });

    try {
      const json = await receberJsonGoogle(upstream, campos);
      if (json.tipo !== 'MART_VENDEDORES_API' || json.requestId !== dados.requestId || typeof json.ok !== 'boolean') {
        return retorno({ erro: 'Resposta inesperada da API. Confira a versão publicada do Code.gs.' }, 502);
      }
      return retorno(json);
    } catch (erro) {
      const motivo = String(erro && erro.message || 'DESCONHECIDO');
      if (motivo.startsWith('RESPOSTA_NAO_JSON_') ||
          motivo === 'FALHA_POST_GOOGLE' || motivo === 'FALHA_GET_REDIRECIONAMENTO' ||
          motivo === 'REDIRECT_INVALIDO') {
        return retorno({ erro: 'Diagnóstico: ' + motivo }, 502);
      }
      if (motivo.startsWith('HTTP_APPS_SCRIPT_')) {
        const status = motivo.slice('HTTP_APPS_SCRIPT_'.length);
        return retorno({ erro: `O Google devolveu HTTP ${status}. Confira a implantação do Apps Script e os registros de execução.` }, 502);
      }
      return retorno({ erro: 'Não foi possível obter a resposta JSON do Apps Script. Confira o Code.gs publicado e as execuções.' }, 502);
    }
  }
};
