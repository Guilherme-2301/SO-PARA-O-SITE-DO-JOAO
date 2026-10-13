// Exemplo conceitual de como funcionaria a lógica do bot

// Criando uma rifa de 1 a 100 (iniciando todos como "Disponível")
const totalNumeros = 100;
let rifa = {};
for (let i = 1; i <= totalNumeros; i++) {
    rifa[i] = "Disponível";
}

// Função executada quando uma nova mensagem chega
function processarMensagem(usuario, textoMensagem) {
    // Expressão regular para identificar o padrão "quero X números" ou "quero X numeros"
    const regex = /quero\s+(\d+)\s+n[úu]meros/i;
    const match = textoMensagem.match(regex);

    if (match) {
        const quantidadeSolicitada = parseInt(match[1]);
        let numerosReservados = [];

        // Busca pelos próximos números disponíveis
        for (let i = 1; i <= totalNumeros; i++) {
            if (rifa[i] === "Disponível") {
                rifa[i] = usuario; // Reserva o número com o nome/telefone do usuário
                numerosReservados.push(i);
            }
            
            // Se já encontramos a quantidade que o usuário queria, paramos a busca
            if (numerosReservados.length === quantidadeSolicitada) {
                break;
            }
        }

        // Verifica se conseguiu todos os números solicitados
        if (numerosReservados.length < quantidadeSolicitada) {
            return `Desculpe, não temos essa quantidade de números disponíveis. Restam apenas alguns!`;
        }

        // Monta a resposta de confirmação
        let resposta = `✅ Sucesso, ${usuario}! Seus números são: ${numerosReservados.join(', ')}\n\n`;
        resposta += `📝 **LISTA DA RIFA ATUALIZADA:**\n`;
        
        for (let i = 1; i <= totalNumeros; i++) {
            resposta += `${i} - ${rifa[i]}\n`;
        }

        return resposta;
    }
    
    return null; // Ignora se não for o comando da rifa
}

// Exemplo de teste no terminal:
console.log(processarMensagem("João Silva", "Quero 3 números"));