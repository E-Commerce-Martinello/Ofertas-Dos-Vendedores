// ============================================
// presenter/api.js — REQUISIÇÕES EXTERNAS
// ============================================

const API = {

    async rastrear(codigo, navegador) {
        // O coletor atual registra eventos de compartilhamento. O formulário legado
        // permanece desativado, inclusive no site oficial, salvo ativação explícita.
        if (CONFIG.rastreioFormularioLegado !== true) return { metodo: 'formulario-legado-desativado' };
        try {
            const fd = new FormData();
            fd.append(CONFIG.entryIdCodigo,  codigo);
            fd.append(CONFIG.entryIdBrowser, navegador);
            const ctrl = new AbortController();
            const to   = setTimeout(() => ctrl.abort(), CONFIG.rastreioTimeout);
            await fetch(CONFIG.googleFormUrl, { method: 'POST', mode: 'no-cors', body: fd, signal: ctrl.signal });
            clearTimeout(to);
        } catch { /* rastreio é best-effort */ }
    },

    async prepararCompartilhamento(texto, imagemUrl) {
        const src=String(imagemUrl||'').trim();
        if(!src)throw new Error('IMAGEM_OFERTA_AUSENTE');
        let blob;
        const match=/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,/i.exec(src);
        if(match){
            const mime=match[1].toLowerCase().replace('jpg','jpeg');
            let decodificado;
            try { decodificado=atob(src.slice(match[0].length)); }
            catch(_){throw new Error('IMAGEM_OFERTA_CORROMPIDA');}
            const bytes=new Uint8Array(decodificado.length);
            for(let i=0;i<decodificado.length;i++)bytes[i]=decodificado.charCodeAt(i);
            blob=new Blob([bytes],{type:mime});
        }else if(/^https:\/\//i.test(src)||/^img\//i.test(src)){
            const r=await fetch(src,{cache:'no-store'});
            if(!r.ok)throw new Error('IMAGEM_OFERTA_INDISPONIVEL');
            blob=await r.blob();
        }else{
            throw new Error('IMAGEM_OFERTA_INVALIDA');
        }
        if(!blob.size || !/^image\/(?:jpeg|png|gif|webp)$/i.test(blob.type))
            throw new Error('IMAGEM_OFERTA_INVALIDA');
        const extensao=blob.type==='image/jpeg'?'jpg':blob.type.slice(6);
        const arquivo=new File([blob],'oferta.'+extensao,{type:blob.type});
        return {texto:String(texto||''),file:arquivo};
    },

    compartilharPreparado(preparado) {
        if(!preparado?.file)throw new Error('IMAGEM_OFERTA_AUSENTE');
        if(typeof navigator.share!=='function' || typeof navigator.canShare!=='function' ||
           !navigator.canShare({files:[preparado.file]})){
            throw new Error('COMPARTILHAMENTO_IMAGEM_NAO_SUPORTADO');
        }
        // O Android recebe arquivo + texto no MESMO compartilhamento nativo,
        // chamado diretamente na ativação do botão, sem awaits anteriores.
        return navigator.share({files:[preparado.file],text:preparado.texto})
            .then(()=>({metodo:'share-com-imagem'}));
    },

    // Compatibilidade com outros componentes que usam a API antiga.
    async compartilhar(texto,imagemUrl) {
        const preparado=await this.prepararCompartilhamento(texto,imagemUrl);
        return this.compartilharPreparado(preparado);
    }
};
