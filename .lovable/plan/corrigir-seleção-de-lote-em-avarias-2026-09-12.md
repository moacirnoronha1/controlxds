# Corrigir seleção de lote em Avarias

## O que será ajustado
- Carregar todos os lotes com saldo do produto escolhido e mostrar validade, saldo, custo unitário e local.
- Permitir filtrar a escolha pelo local de estoque, sem ocultar lotes válidos do produto.
- Manter a seleção de lote obrigatória para “Avaria depois da chegada”.
- Quando houver saldo atual sem vínculo com lotes, oferecer “Estoque sem lote” e exigir o local; ao registrar, criar internamente um lote padrão de ajuste apenas para esse saldo.
- Bloquear somente quando não houver saldo suficiente no lote escolhido ou no saldo sem lote.

## Segurança e histórico
- Fazer criação da avaria, eventual criação do lote padrão, baixa do lote escolhido e registro da movimentação na mesma transação.
- Nunca escolher lote automaticamente por FEFO para avarias.
- Registrar no histórico o produto, lote, validade, quantidade, usuário e motivo.
- Validar novamente o saldo no banco no momento do registro para impedir saldo negativo ou baixas concorrentes.

## Verificação
- Conferir produtos com lotes normais, com vários locais e com saldo sem lote.
- Confirmar que a baixa afeta somente o lote selecionado e que o histórico identifica a avaria.
- Validar a tela em celular e conferir a compilação final.
