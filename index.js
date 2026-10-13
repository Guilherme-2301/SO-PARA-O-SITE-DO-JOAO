const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs'); 

console.log('⏳ [PROCESSO] Iniciando Sistema de Pontos Puro (Sem IA)... Aguarde.');

// Caminhos dos arquivos de dados
const caminhoPontos = path.join(__dirname, 'bancoPontos.json');
const caminhoHistorico = path.join(__dirname, 'historicoPontos.json');
const caminhoParceiros = path.join(__dirname, 'parcerias.json'); 
const caminhoRecompensas = path.join(__dirname, 'recompensas.json');

// Inicialização segura dos bancos de dados JSON
let bancoPontos = fs.existsSync(caminhoPontos) ? JSON.parse(fs.readFileSync(caminhoPontos, 'utf8')) : {};
let historicoPontos = fs.existsSync(caminhoHistorico) ? JSON.parse(fs.readFileSync(caminhoHistorico, 'utf8')) : {};
let recompensas = fs.existsSync(caminhoRecompensas) ? JSON.parse(fs.readFileSync(caminhoRecompensas, 'utf8')) : [
    { id: 1, nome: "Miniatura Hot Wheels Premium", custo: 50 },
    { id: 2, nome: "Frete Grátis na próxima compra", custo: 20 }
];

// TRAVA DE SEGURANÇA CONTRA O ERRO DE PARCERIAS
let parcerias = [];
if (fs.existsSync(caminhoParceiros)) {
    try {
        const dadosParceiros = JSON.parse(fs.readFileSync(caminhoParceiros, 'utf8'));
        parcerias = Array.isArray(dadosParceiros) ? dadosParceiros : [];
    } catch (e) {
        parcerias = [];
    }
}

function salvarDados() {
    fs.writeFileSync(caminhoPontos, JSON.stringify(bancoPontos, null, 2));
    fs.writeFileSync(caminhoHistorico, JSON.stringify(historicoPontos, null, 2));
    fs.writeFileSync(caminhoParceiros, JSON.stringify(parcerias, null, 2));
    fs.writeFileSync(caminhoRecompensas, JSON.stringify(recompensas, null, 2));
}

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "sessao-pontos-floripa",
        dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: {
        headless: true, 
        executablePath: 'C:\\Users\\guida\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
            '--disable-gpu', '--mute-audio', '--disable-extensions'
        ]
    }
});

const idGrupoOficial = "120363408410938314@g.us"; 

// IDs dos administradores configurados com suporte anti-bug de LID
const listaAdmins = [
    "5548996890282@c.us", 
    "42979788087538@lid",
    "554896890282@c.us"
];

const listaPalavrasBloqueadas = [
    "fdp", "filho da puta", "vai tomar no cu", "viado", "lixo", "bosta", "arrombado"
];

// 🛡️ ENVIADOR SEGURO ANTI-BUG DE LID PARA MENSAGENS NO PRIVADO
async function enviarMensagemPrivado(idDestinatario, textoMensagem) {
    try {
        await client.sendMessage(idDestinatario, textoMensagem);
        return true;
    } catch (err) {
        console.log(`⚠️ Erro primário ao enviar PV para ${idDestinatario}: ${err.message}`);
        try {
            const numeroPuro = idDestinatario.split('@')[0];
            const JIDFormatado = `${numeroPuro}@c.us`;
            await client.sendMessage(JIDFormatado, textoMensagem);
            return true;
        } catch (segundoErro) {
            console.log(`❌ Falha crítica de envio para o privado de: ${idDestinatario}`);
            return false;
        }
    }
}

// Auxiliar para registrar histórico de movimentações
function registrarHistorico(usuario, qtd, motivo) {
    if (!historicoPontos[usuario]) historicoPontos[usuario] = [];
    historicoPontos[usuario].push({
        data: new Date().toLocaleString('pt-BR'),
        quantidade: qtd,
        motivo: motivo
    });
}

client.on('qr', (qr) => {
    console.log('⚠️ SESSÃO DESCONECTADA! Escaneie o QR Code abaixo:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.clear();
    console.log('\n========================================================================');
    console.log('    👑 BOT FAMÍLIA FLORIPA - MOTOR DE PONTOS COMANDOS PUROS 👑          ');
    console.log('========================================================================');
    console.log(`🤖 STATUS: Online como [${client.info.pushname}]`);
    console.log('⚙️ RECURSOS: Validação estrita de marcações (@) ativada nos comandos');
    console.log('========================================================================\n');
});

client.on('message', async (msg) => {
    const texto = msg.body.trim();
    const textoMinusculo = texto.toLowerCase();
    const remetente = msg.author || msg.from; 
    const ehAdmin = listaAdmins.includes(remetente) || msg.fromMe === true;
    const ehMensagemGrupo = msg.from.endsWith('@g.us');

    // ==========================================
    // 🛡️ SISTEMA DE SEGURANÇA E MODERAÇÃO (NO GRUPO)
    // ==========================================
    if (msg.from === idGrupoOficial && !ehAdmin) {
        if (textoMinusculo.includes('chat.whatsapp.com/') || textoMinusculo.includes('t.me/') || textoMinusculo.includes('wa.me/')) {
            try { 
                await msg.delete(true); 
                return;
            } catch {}
        }

        for (let palavra of listaPalavrasBloqueadas) {
            if (textoMinusculo.includes(palavra)) {
                try { await msg.delete(true); } catch {}
                return;
            }
        }
    }

    // ==========================================
    // 👑 COMANDOS DE ADMINISTRADOR
    // ==========================================

    // --- COMANDOS QUE SÓ FUNCIONAM DENTRO DO GRUPO ---
    if (textoMinusculo.startsWith('!addpontos ') || textoMinusculo.startsWith('!rempontos ')) {
        if (!ehAdmin) return;
        
        if (!ehMensagemGrupo) {
            await msg.reply('⚠️ Por segurança da comunidade, os comandos de alteração de pontos devem ser digitados apenas dentro do Grupo Oficial!');
            return;
        }

        // !addpontos @marcar quantidade motivo
        if (textoMinusculo.startsWith('!addpontos ')) {
            // VALIDAÇÃO: Se não houver nenhuma menção válida no array do WhatsApp, cancela com erro
            if (!msg.mentionedIds || msg.mentionedIds.length === 0) {
                await msg.reply('❌ *Erro de Comando!* Você precisa obrigatoriamente marcar alguém usando o *@* para adicionar pontos.\n\n*Exemplo:* `!addpontos @Membro 50 Evento`');
                return;
            }

            const argumentos = texto.split(/\s+/);
            if (argumentos.length < 3) { 
                await msg.reply('⚠️ Use: `!addpontos @marcar [pontos] [motivo]`\n\n*Exemplo:* `!addpontos @Membro 50 Evento`'); 
                return; 
            }
            
            let usuarioAlvo = msg.mentionedIds[0]; 
            const qtdPontos = parseInt(argumentos[2]);
            const motivo = argumentos.slice(3).join(' ') || "Creditado por Admin";

            if (isNaN(qtdPontos)) { await msg.reply('⚠️ Quantidade de pontos inválida.'); return; }

            bancoPontos[usuarioAlvo] = (bancoPontos[usuarioAlvo] || 0) + qtdPontos;
            registrarHistorico(usuarioAlvo, qtdPontos, motivo);
            salvarDados();

            const numeroExibicao = usuarioAlvo.split('@')[0];
            await msg.reply(`🪙 *PONTOS CREDITADOS!* 🪙\n\nAdicionados *${qtdPontos} pontos* para @${numeroExibicao}.\n📝 *Motivo:* ${motivo}`);
            return;
        }

        // !rempontos @marcar quantidade motivo
        if (textoMinusculo.startsWith('!rempontos ')) {
            // VALIDAÇÃO: Se não houver nenhuma menção válida no array do WhatsApp, cancela com erro
            if (!msg.mentionedIds || msg.mentionedIds.length === 0) {
                await msg.reply('❌ *Erro de Comando!* Você precisa obrigatoriamente marcar alguém usando o *@* para remover pontos.\n\n*Exemplo:* `!rempontos @Membro 10 Ajuste`');
                return;
            }

            const argumentos = texto.split(/\s+/);
            if (argumentos.length < 3) { 
                await msg.reply('⚠️ Use: `!rempontos @marcar [pontos] [motivo]`\n\n*Exemplo:* `!rempontos @Membro 10 Correção`'); 
                return; 
            }
            
            let usuarioAlvo = msg.mentionedIds[0]; 
            const qtdPontos = parseInt(argumentos[2]);
            const motivo = argumentos.slice(3).join(' ') || "Removido por Admin";

            if (isNaN(qtdPontos)) { await msg.reply('⚠️ Quantidade de pontos inválida.'); return; }

            bancoPontos[usuarioAlvo] = Math.max(0, (bancoPontos[usuarioAlvo] || 0) - qtdPontos);
            registrarHistorico(usuarioAlvo, -qtdPontos, motivo);
            salvarDados();

            const numeroExibicao = usuarioAlvo.split('@')[0];
            await msg.reply(`📉 *PONTOS REMOVIDOS!* 📉\n\nForam retirados *${qtdPontos} pontos* de @${numeroExibicao}.\n📝 *Motivo:* ${motivo}`);
            return;
        }
    }

    // --- COMANDOS QUE SÓ FUNCIONAM NO PRIVADO DOS ADMINS ---
    if (!ehMensagemGrupo) {
        if (!ehAdmin) return;

        // !resetarpontos (Comando de Reset Total)
        if (textoMinusculo === '!resetarpontos') {
            bancoPontos = {};
            historicoPontos = {};
            salvarDados();
            await msg.reply('🚨 *RESET TOTAL CONCLUÍDO!* Todos os saldos de pontos e históricos de membros foram apagados do sistema.');
            return;
        }

        // !addrecompensa [custo] [Nome do prêmio]
        if (textoMinusculo.startsWith('!addrecompensa ')) {
            const argumentos = texto.split(/\s+/);
            const custo = parseInt(argumentos[1]);
            const nomePremio = argumentos.slice(2).join(' ');

            if (isNaN(custo) || !nomePremio) {
                await msg.reply('⚠️ Use: `!addrecompensa [custo_em_pontos] [Nome do prêmio]`');
                return;
            }

            const novoId = recompensas.length > 0 ? Math.max(...recompensas.map(r => r.id)) + 1 : 1;
            recompensas.push({ id: novoId, nome: nomePremio, custo: custo });
            salvarDados();

            await msg.reply(`🎁 Recompensa *"${nomePremio}"* adicionada com sucesso! (ID: ${novoId} | Custo: ${custo} pts)`);
            return;
        }

        // !delrecompensa [ID]
        if (textoMinusculo.startsWith('!delrecompensa ')) {
            const idAlvo = parseInt(texto.split(/\s+/)[1]);
            const index = recompensas.findIndex(r => r.id === idAlvo);

            if (index === -1) { await msg.reply('⚠️ ID de recompensa não encontrado.'); return; }
            
            const removida = recompensas.splice(index, 1);
            salvarDados();
            await msg.reply(`🗑️ Recompensa *"${removida[0].nome}"* foi removida.`);
            return;
        }

        // !addparceiro [Nome/Link do Grupo]
        if (textoMinusculo.startsWith('!addparceiro ')) {
            const dadosParceiro = texto.substring(13).trim();
            if (!dadosParceiro) return;
            parcerias.push(dadosParceiro);
            salvarDados();
            await msg.reply('✅ Grupo parceiro cadastrado com sucesso!');
            return;
        }

        // !delparceiro [Indice]
        if (textoMinusculo.startsWith('!delparceiro ')) {
            const idx = parseInt(texto.split(/\s+/)[1]) - 1;
            if (isNaN(idx) || idx < 0 || idx >= parcerias.length) { await msg.reply('⚠️ Índice inválido.'); return; }
            const removido = parcerias.splice(idx, 1);
            salvarDados();
            await msg.reply(`🗑️ Parceiro "${removido}" removido.`);
            return;
        }
    }

    // ==========================================
    // 👥 COMANDOS PÚBLICOS E DE CONSULTA (GRUPO/PV)
    // ==========================================

    // 🔑 !meuid - COMANDO NO PRIVADO PARA VER O PRÓPRIO ID
    if (textoMinusculo === '!meuid') {
        if (ehMensagemGrupo) {
            await msg.reply('⚠️ Para manter o grupo limpo, use o comando *!meuid* diretamente no meu privado!');
            return;
        }
        await msg.reply(`📋 *SEU ID DO WHATSAPP:*\n\n🔑 \`${remetente}\`\n\n_Dica: Forneça esse código completo aos administradores se necessário._`);
        return;
    }

    // 🪙 !pontos - RESPOSTA DIRETAMENTE NO PRIVADO DO USUÁRIO
    if (textoMinusculo === '!pontos') {
        const saldo = bancoPontos[remetente] || 0;
        const contato = await msg.getContact();
        const nomeMembro = contato.pushname || 'Membro';

        let msgPrivado = `Oi *${nomeMembro}*, tudo bem? 👋\n\n`;
        msgPrivado += `🪙 *TEUS PONTOS NO PRIVÊ FAMÍLIA FLORIPA* 🪙\n\n`;
        msgPrivado += `💰 Saldo Atual: *${saldo} ponto(s)*\n\n`;
        
        const historico = historicoPontos[remetente] || [];
        if (historico.length > 0) {
            msgPrivado += `📋 *Últimas Movimentações:*\n`;
            const ultimos = historico.slice(-3).reverse();
            ultimos.forEach(h => {
                const sinal = h.quantidade > 0 ? `+` : ``;
                const dataFormatada = h.data ? h.data.split(' ')[0] : new Date().toLocaleDateString('pt-BR');
                msgPrivado += `• _${dataFormatada}_ | *${sinal}${h.quantidade} pts* » ${h.motivo}\n`;
            });
        }
        msgPrivado += `\n💡 _Para resgatar prêmios com seus pontos, use *!recompensas* para ver a loja._`;

        const enviadoComSucesso = await enviarMensagemPrivado(remetente, msgPrivado);

        if (ehMensagemGrupo) {
            if (enviadoComSucesso) {
                await msg.reply(`Olá *${nomeMembro}*, mandei as informações detalhadas dos teus pontos lá no teu Privê! Dá uma olhada lá. 😉📩`);
            } else {
                await msg.reply(`❌ Não consegui te chamar no privado. Por favor, envie uma mensagem para o meu PV primeiro e tente novamente!`);
            }
        }
        return;
    }

    // !extrato - Ver últimas movimentações
    if (textoMinusculo === '!extrato') {
        const historico = historicoPontos[remetente] || [];
        if (historico.length === 0) {
            await msg.reply('📝 Você ainda não possui movimentações registradas no seu extrato.');
            return;
        }

        let extratoMsg = `📋 *EXTRATO DE PONTOS* 📋\n\n`;
        const ultimos = historico.slice(-5).reverse(); 
        ultimos.forEach(h => {
            const sinal = h.quantidade > 0 ? `+` : ``;
            const dataFormatada = h.data ? h.data : new Date().toLocaleString('pt-BR');
            extratoMsg += `📅 _${dataFormatada}_\n🪙 *${sinal}${h.quantidade} pts* » ${h.motivo}\n\n`;
        });
        await msg.reply(extratoMsg);
        return;
    }

    // !recompensas - Lista prêmios disponíveis
    if (textoMinusculo === '!recompensas') {
        if (recompensas.length === 0) {
            await msg.reply('🎁 Nenhuma recompensa cadastrada no momento.');
            return;
        }

        let listaRec = `🎁 *LOJA DE RECOMPENSAS FAMÍLIA FLORIPA* 🎁\n\n`;
        recompensas.forEach(r => {
            listaRec += `🆔 *ID: ${r.id}* — ${r.nome}\n💰 Custo: *${r.custo} pontos*\n\n`;
        });
        listaRec += `🛒 _Para resgatar, use o comando: *!resgatar [ID]*_`;
        await msg.reply(listaRec);
        return;
    }

    // !resgatar [ID] - Troca de pontos por prêmio e Alerta os Admins
    if (textoMinusculo.startsWith('!resgatar ')) {
        const idAlvo = parseInt(texto.split(/\s+/)[1]);
        const premio = recompensas.find(r => r.id === idAlvo);

        if (!premio) { 
            await msg.reply('⚠️ ID de recompensa inválido. Digite *!recompensas* para ver as opções.'); 
            return; 
        }

        const saldoAtual = bancoPontos[remetente] || 0;
        
        if (saldoAtual < premio.custo) {
            await msg.reply(`❌ *Opa! Pontos Insuficientes!*\n\nVocê possui atualmente *${saldoAtual} pts*, mas o prêmio *${premio.nome}* exige *${premio.custo} pts*.\n\nContinue participando das atividades do grupo para acumular mais! 🚘🔥`);
            return; 
        }

        bancoPontos[remetente] = saldoAtual - premio.custo;
        registrarHistorico(remetente, -premio.custo, `Resgate do prêmio: ${premio.nome}`);
        salvarDados();

        const contato = await msg.getContact();
        const nomeUsuario = contato.pushname || "Membro";
        const telefoneUsuario = remetente.split('@')[0];

        await msg.reply(`🎉 *RESGATE EFETUADO COM SUCESSO!*\n\n🎁 Prêmio: *${premio.nome}*\n📉 Custo: *${premio.custo} pontos* retirados da sua conta.\n\nOs administradores foram avisados e vão entrar em contato com você no privado!`);

        // SISTEMA DE ALERTA: Envia detalhes completos para a lista de administradores no privado
        const alertaAdmin = `🔔 *ALERTA DE TROCA DE PONTOS* 🔔\n\n👤 *Membro:* ${nomeUsuario}\n🆔 *ID Interno:* \`${remetente}\`\n📱 *Contato Direto:* wa.me/${telefoneUsuario}\n🎁 *Prêmio Solicitado:* ${premio.nome}\n📉 *Custo do Prêmio:* ${premio.custo} pontos\n🪙 *Saldo Restante do Membro:* ${bancoPontos[remetente]} pontos\n\n_Chame o usuário para combinar os detalhes da entrega._`;
        
        for (const adminId of listaAdmins) {
            await enviarMensagemPrivado(adminId, alertaAdmin);
        }
        return;
    }

    // 🏆 !ranking - EXIBE NO GRUPO OS TOP PONTUADOS COM O NOME DE PERFIL REAL DO WHATSAPP
    if (textoMinusculo === '!ranking') {
        const usuariosOrdenados = Object.entries(bancoPontos)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); 

        if (usuariosOrdenados.length === 0) {
            await msg.reply('📊 O ranking ainda está vazio.');
            return;
        }

        let rankingMsg = `🏆 *TOP 10 - RANKING DE PONTOS FAMÍLIA FLORIPA* 🏆\n\n`;
        let medalhas = ["🥇", "🥈", "🥉", "👤", "👤", "👤", "👤", "👤", "👤", "👤"];

        for (let i = 0; i < usuariosOrdenados.length; i++) {
            const [jid, pts] = usuariosOrdenados[i];
            let nomeZap = "Participante";
            
            try {
                const dadosContato = await client.getContactById(jid);
                if (dadosContato && dadosContato.pushname) {
                    nomeZap = dadosContato.pushname;
                }
            } catch (err) {
                nomeZap = `Membro (${jid.split('@')[0].slice(-4)})`;
            }

            rankingMsg += `${medalhas[i]} *${i + 1}°* ${nomeZap} — *${pts} pts*\n`;
        }

        rankingMsg += `\n✨ _Participe ativamente e suba na classificação!_`;
        await client.sendMessage(msg.from, rankingMsg);
        return;
    }

    // !parceiros - Exibe os grupos parceiros
    if (textoMinusculo === '!parceiros') {
        if (!Array.isArray(parcerias) || parcerias.length === 0) {
            await msg.reply('🤝 Nenhum grupo parceiro listado no momento.');
            return;
        }

        let parceirosMsg = `🤝 *GRUPOS PARCEIROS - FAMÍLIA FLORIPA* 🤝\n\n`;
        parcerias.forEach((p, index) => {
            parceirosMsg += `${index + 1}. ${p}\n\n`;
        });
        parceirosMsg += `Visitem e apoiem nossos parceiros! 🚘`;
        await msg.reply(parceirosMsg);
        return;
    }

    // !ajuda ou !comandos
    if (textoMinusculo === '!ajuda' || textoMinusculo === '!comandos') {
        let ajudaMsg = `🤖 *CENTRAL DE AJUDA - FAMÍLIA FLORIPA* 🤖\n\n`;
        ajudaMsg += `🎫 *COMANDOS DOS PARTICIPANTES:*\n`;
        ajudaMsg += `• *!pontos* → Recebe de forma privada teus pontos e saldo no Privê.\n`;
        ajudaMsg += `• *!extrato* → Mostra o seu histórico detalhado.\n`;
        ajudaMsg += `• *!ranking* → Exibe o ranking geral com o nome de perfil do Zap.\n`;
        ajudaMsg += `• *!recompensas* → Abre a vitrine de prêmios da nossa loja.\n`;
        ajudaMsg += `• *!resgatar [ID]* → Troca seus pontos acumulados por um prêmio.\n`;
        ajudaMsg += `• *!parceiros* → Mostra a lista de parceiros oficiais.\n`;
        ajudaMsg += `• *!meuid* → Envie no privado do bot para descobrir seu código de identificação.\n\n`;

        if (ehAdmin) {
            ajudaMsg += `👑 *COMANDOS DE ADMIN (No Grupo Oficial):*\n`;
            ajudaMsg += `• *!addpontos @Membro [qtd] [motivo]* → Adiciona pontos por marcação.\n`;
            ajudaMsg += `• *!rempontos @Membro [qtd] [motivo]* → Remove pontos por marcação.\n\n`;
            ajudaMsg += `👑 *COMANDOS DE ADMIN (No Privado do Bot):*\n`;
            ajudaMsg += `• *!resetarpontos* → Zera e apaga todos os pontos do sistema.\n`;
            ajudaMsg += `• *!addrecompensa [custo] [Nome]* → Adiciona novo prêmio.\n`;
            ajudaMsg += `• *!delrecompensa [ID]* → Deleta um prêmio.\n`;
            ajudaMsg += `• *!addparceiro [Nome/Link]* → Cadastra grupo parceiro.\n`;
            ajudaMsg += `• *!delparceiro [N°]* → Remove parceiro pelo índice.\n`;
        }

        await msg.reply(ajudaMsg);
        return;
    }
});

client.initialize();