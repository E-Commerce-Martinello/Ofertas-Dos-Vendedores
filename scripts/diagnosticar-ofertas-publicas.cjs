// Diagnóstico SOMENTE de dados de ofertas já públicos no Firebase Realtime Database.
// Não registra títulos, imagens, textos, links, matrículas ou IDs de ofertas nos logs.
'use strict';
(async()=>{
 const url='https://portal-de-oferta-default-rtdb.firebaseio.com/ofertasMartinello.json';
 const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Firebase respondeu HTTP '+response.status);
 const dados=await response.json();
 const ofertas=Array.isArray(dados)?dados.filter(Boolean):
   dados&&typeof dados==='object'?Object.values(dados).filter(Boolean):[];
 const res={quantidade:ofertas.length,comEmojisCorrompidos:0,
   comImagemBase64:0,comImagemUrl:0,semImagem:0,comMensagemVazia:0,
   comImagemBase64Invalida:0,comImagemMaior5mb:0};
 for(const o of ofertas){
   const txt=String(o?.textoOferta||'');
   if(!txt.trim())res.comMensagemVazia++;
   if(txt.includes('\uFFFD'))res.comEmojisCorrompidos++;
   const img=String(o?.urlImagem||'');
   if(/^data:image\/(png|jpeg|gif|webp);base64,/.test(img)){
     res.comImagemBase64++;
     const parts=img.split(',');
     const base64=parts.slice(1).join(',');
     const bytes=Buffer.from(base64,'base64');
     if(bytes.length>5*1024*1024)res.comImagemMaior5mb++;
     const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
     const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
     const gif=bytes.subarray(0,3).toString()==='GIF';
     const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
     if(!/^[A-Za-z0-9+/=]+$/.test(base64)||!(png||jpg||gif||webp))res.comImagemBase64Invalida++;
   }else if(/^https:\/\//.test(img))res.comImagemUrl++;
   else res.semImagem++;
 }
 console.log('Diagnóstico agregado das ofertas públicas do Firebase OFICIAL:');
 for(const [k,v]of Object.entries(res))console.log(k+': '+v);
 console.log('Nenhum conteúdo de oferta ou identificador foi exibido.');
})().catch(e=>{console.error('Diagnóstico não concluído:',e?.name||'Erro');process.exitCode=1;});
