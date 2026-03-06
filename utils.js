// ============================================
// presenter/api.js — REQUISIÇÕES EXTERNAS
// ============================================

const API = {

    async rastrear(codigo, navegador) {
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

    async compartilhar(texto, imagemUrl) {
        try {
            const res  = await fetch(imagemUrl);
            const blob = await res.blob();
            const file = new File([blob], 'oferta.png', { type: blob.type });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text: texto });
                return { metodo: 'share' };
            }
        } catch { /* fallback abaixo */ }
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
        return { metodo: 'whatsapp' };
    },

    async copiarTexto(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            return true;
        } catch { return false; }
    },
};
