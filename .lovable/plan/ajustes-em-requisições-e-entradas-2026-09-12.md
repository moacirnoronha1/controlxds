# Ajustes em Requisições e Entradas

## Resultado esperado

- Estoquista, Líder e Mestre poderão ajustar uma requisição pendente antes da liberação.
- Entradas existentes poderão ser corrigidas sem duplicar lotes ou movimentos.
- Todas as alterações ficarão registradas com responsável, data, hora e valores anteriores/novos.

## Requisições

- Adicionar um histórico próprio para alterações de itens da requisição.
- Criar uma operação transacional para salvar o conjunto final de itens enquanto a requisição estiver pendente.
- Permitir alterar quantidade, trocar produto, excluir item e adicionar item, exigindo uma observação da alteração.
- Registrar no histórico inclusões, exclusões, substituições e mudanças de quantidade, incluindo produto original e substituto quando aplicável.
- Restringir a edição aos perfis Estoquista, Líder e Mestre; Requisitante continuará apenas consultando após o envio.
- Bloquear qualquer edição após liberação ou cancelamento.
- Na tela de análise, incluir modo de edição simples e exibir o histórico abaixo dos dados da requisição.
- Manter a liberação transacional atual; ela continuará validando estoque e aplicando FEFO somente sobre os itens finais e quantidades liberadas.

## Entradas

- Adicionar histórico próprio para edições de entrada/lote.
- Criar uma operação transacional para editar o lote e o movimento de entrada já existentes, sem criar nova entrada.
- Permitir corrigir custo unitário, validade, fornecedor, observação e quantidade.
- Ao alterar somente preço, validade, fornecedor ou observação, manter o saldo do estoque intacto.
- Ao alterar quantidade, aplicar apenas a diferença ao saldo do lote e do produto; bloquear reduções que deixariam o lote ou o produto negativos.
- Atualizar o movimento original para preservar uma única entrada e manter os relatórios e custos consistentes.
- Na tela Entradas, adicionar ação de edição nas entradas recentes e uma consulta para entradas anteriores.
- Atualizar automaticamente Produtos, Movimentações, Histórico de Custo e Validade e Custo após salvar.

## Segurança e validação

- Validar permissões e estado atual também no banco, não apenas na tela.
- Executar cada alteração em uma única transação para garantir rollback completo em caso de erro.
- Usar o usuário autenticado como responsável pela auditoria.
- Validar números decimais, produtos duplicados, quantidade positiva e saldo suficiente.

## Verificação

- Testar edição, substituição, inclusão e exclusão em requisição pendente; confirmar bloqueio após liberação.
- Testar edição de entrada sem mudança de quantidade e confirmar que o estoque não muda.
- Testar aumento e redução de quantidade e confirmar ajuste apenas pela diferença.
- Conferir histórico, custos, validade, movimentos e visual em celular e computador.
