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
        // Tentar Web Share API com imagem (funciona no Safari/iOS e Android)
        try {
            let file = null;

            if (imagemUrl && imagemUrl.startsWith('data:')) {
                // Imagem base64 — converter direto para Blob sem fetch()
                // (fetch de data: URL falha no GitHub Pages / HTTP2)
                const arr    = imagemUrl.split(',');
                const mime   = arr[0].match(/:(.*?);/)[1];
                const bstr   = atob(arr[1]);
                const bytes  = new Uint8Array(bstr.length);
                for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
                const blob   = new Blob([bytes], { type: mime });
                file = new File([blob], 'oferta.png', { type: mime });
                console.log('🖼️ Imagem base64 convertida para blob:', Math.round(blob.size / 1024), 'KB');

            } else if (imagemUrl && imagemUrl.startsWith('http')) {
                // URL externa — buscar normalmente
                const res  = await fetch(imagemUrl);
                const blob = await res.blob();
                file = new File([blob], 'oferta.png', { type: blob.type });
                console.log('🖼️ Imagem buscada da URL:', imagemUrl.substring(0, 50));
            }

            if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
                console.log('📤 Compartilhando via Web Share API com imagem...');
                await navigator.share({ files: [file], text: texto });
                return { metodo: 'share-com-imagem' };
            }

            if (navigator.share) {
                // Share sem imagem (browser não suporta canShare com files)
                console.log('📤 Compartilhando via Web Share API sem imagem...');
                await navigator.share({ text: texto });
                return { metodo: 'share-sem-imagem' };
            }
        } catch (e) {
            console.warn('⚠️ Web Share API falhou:', e.message, '— usando fallback WhatsApp');
        }

        // Fallback: abrir WhatsApp Web
        console.log('📤 Abrindo WhatsApp Web...');
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
