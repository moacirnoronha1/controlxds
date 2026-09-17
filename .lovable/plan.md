# Corrigir devolução de empréstimos

## Objetivo
Corrigir somente a devolução de itens tomados emprestados, sem refazer a aba.

## Alterações
- Na devolução, validar a quantidade como número e considerar o saldo positivo total do produto no local escolhido.
- Permitir selecionar o local e um lote com saldo; ignorar o lote original quando estiver zerado.
- Manter como opção o lote temporário criado na entrada, quando ele ainda tiver saldo.
- Baixar exatamente a quantidade devolvida, registrar “Devolução de empréstimo” e só então marcar o empréstimo como devolvido.
- Executar tudo em uma única operação: em caso de erro, estoque, movimentação e status permanecem inalterados.
- Preservar a devolução de itens que o GX Control emprestou, que continua fazendo a entrada inversa.

## Validação
- Conferir o caso informado e testar saldo igual à quantidade, lote zerado com outro lote disponível e saldo insuficiente.
- Confirmar que o registro não entra como consumo ou requisição.
