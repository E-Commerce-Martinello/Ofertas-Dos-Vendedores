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

    // Preparação pode esperar rede e decodificação, SEM consumir o gesto do usuário.
    // Deve ser chamada antes de mostrar o botão final COMPARTILHAR.
    async prepararCompartilhamento(texto, imagemUrl) {
        const src=String(imagemUrl||'').trim();
        if(!src)throw new Error('IMAGEM_OFERTA_AUSENTE');
        let blob;
        if(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(src)) {
            const pos=src.indexOf(',');
            const mime=src.slice(5,src.indexOf(';')).replace('jpg','jpeg');
            let bytes;
            try{bytes=atob(src.slice(pos+1));}
            catch(_){throw new Error('IMAGEM_OFERTA_CORROMPIDA');}
            const bin=new Uint8Array(bytes.length);
            for(let i=0;i<bytes.length;i++)bin[i]=bytes.charCodeAt(i);
            blob=new Blob([bin],{type:mime});
        } else if(/^https:\/\//i.test(src)||/^img\//.test(src)) {
            const response=await fetch(src,{cache:'no-store'});
            if(!response.ok)throw new Error('IMAGEM_OFERTA_INDISPONIVEL');
            blob=await response.blob();
        } else {
            throw new Error('IMAGEM_OFERTA_INVALIDA');
        }
        if(!blob||!blob.size||!/^image\/(png|jpeg|gif|webp)$/i.test(blob.type))
            throw new Error('IMAGEM_OFERTA_INVALIDA');
        const ext=blob.type==='image/jpeg'?'jpg':blob.type.split('/')[1];
        const file=new File([blob],'oferta.'+ext,{type:blob.type});
        return {texto:String(texto||''),file,imagemUrl:src};
    },

    // Chamar DIRETAMENTE do segundo toque no botão. É essencial não fazer nenhum
    // await antes de navigator.share: o Android perde a ativação do usuário.
    compartilharPreparado(preparado) {
        const file=preparado?.file;
        if(!file)throw new Error('IMAGEM_OFERTA_AUSENTE');
        if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'
           ||!navigator.canShare({files:[file]}))
            throw new Error('COMPARTILHAMENTO_IMAGEM_NAO_SUPORTADO');
        // Promise criada sincronamente no mesmo evento de clique.
        return navigator.share({files:[file],text:preparado.texto})
            .then(()=>({metodo:'share-com-imagem'}));
    },

    // Compatibilidade para consumidores antigos. O Portal de Vendedores utiliza
    // o fluxo de dois toques acima para não perder a autorização do Web Share.
    async compartilhar(texto,imagemUrl) {
        const dados=await this.prepararCompartilhamento(texto,imagemUrl);
        return this.compartilharPreparado(dados);
    },
};
