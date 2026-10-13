client.on('message', async (msg) => {
    const texto = msg.body.trim();
    console.log(`📩 MENSAGEM RECEBIDA: "${texto}" | Tipo: ${typeof texto}`);

    // Teste super simples: se digitar a palavra "oi", ele TEM que responder
    if (texto.toLowerCase() === 'oi') {
        msg.reply('👋 Olá! Estou te ouvindo perfeitamente!');
        return;
    }

    const partes = texto.split(/\s+/);
    const saoApenasNumeros = partes.every(p => /^\d+$/.test(p));
    console.log(`📊 Análise: São apenas números? ${saoApenasNumeros} | Quantidade de itens: ${partes.length}`);
});